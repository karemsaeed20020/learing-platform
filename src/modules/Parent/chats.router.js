// modules/Chat/chat.router.js
import express from 'express';
import { Message, Conversation } from '../../../DB/models/Chat.model.js';
import { protect } from '../../middlewares/auth.middleware.js';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';

const router = express.Router();

// ✅ إرسال رسالة
router.post('/messages', protect, asyncHandler(async (req, res, next) => {
  const { receiverId, message, messageType = 'text', fileUrl, fileName } = req.body;

  if (!receiverId || !message) {
    return next(new AppError('المستلم والرسالة مطلوبان', StatusCodes.BAD_REQUEST));
  }

  // التحقق من أن المستلم موجود
  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    return next(new AppError('المستلم غير موجود', StatusCodes.NOT_FOUND));
  }

  // التحقق من الصلاحيات بناءً على دور المستخدم
  if (req.user.role === 'student') {
    // الطلاب يمكنهم المراسلة مع معلميهم فقط
    if (receiver.role === 'student') {
      return next(new AppError('الطلاب لا يمكنهم المراسلة مع طلاب آخرين', StatusCodes.FORBIDDEN));
    }
  } else if (req.user.role === 'parent') {
    // أولياء الأمور يمكنهم المراسلة مع معلمي أبنائهم والإداريين
    if (receiver.role === 'student') {
      return next(new AppError('أولياء الأمور لا يمكنهم المراسلة مع الطلاب مباشرة', StatusCodes.FORBIDDEN));
    }
  }

  // إنشاء الرسالة
  const newMessage = await Message.create({
    sender: req.user._id,
    receiver: receiverId,
    message,
    messageType,
    fileUrl,
    fileName
  });

  // البحث عن المحادثة أو إنشاء جديدة
  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, receiverId] }
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, receiverId],
      unreadCount: {}
    });
  }

  // تحديث المحادثة
  conversation.lastMessage = newMessage._id;
  
  // زيادة عدد الرسائل غير المقروءة للمستلم
  const receiverUnread = conversation.unreadCount.get(receiverId.toString()) || 0;
  conversation.unreadCount.set(receiverId.toString(), receiverUnread + 1);
  
  conversation.updatedAt = new Date();
  await conversation.save();

  // إرجاع الرسالة مع بيانات المرسل والمستلم
  const populatedMessage = await Message.findById(newMessage._id)
    .populate('sender', 'username role profilePicture grade')
    .populate('receiver', 'username role profilePicture grade');

  // إرسال الرسالة عبر Socket.io إذا كان المستلم متصلاً
  if (req.io) {
    req.io.to(receiverId).emit('newMessage', populatedMessage);
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: { message: populatedMessage }
  });
}));

// ✅ الحصول على المحادثات
router.get('/conversations', protect, asyncHandler(async (req, res, next) => {
  const conversations = await Conversation.find({
    participants: { $in: [req.user._id] }
  })
    .populate('participants', 'username email role profilePicture grade')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { conversations }
  });
}));

// ✅ الحصول على رسائل محادثة محددة
router.get('/conversations/:userId', protect, asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  // التحقق من الصلاحيات
  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  const targetUser = await User.findById(userId);
  
  if (!targetUser) {
    return next(new AppError('المستخدم غير موجود', StatusCodes.NOT_FOUND));
  }

  // التحقق من الصلاحيات بناءً على الدور
  if (req.user.role === 'student') {
    if (targetUser.role === 'student') {
      return next(new AppError('غير مسموح بالدخول إلى هذه المحادثة', StatusCodes.FORBIDDEN));
    }
  } else if (req.user.role === 'parent') {
    if (targetUser.role === 'student') {
      return next(new AppError('غير مسموح بالدخول إلى هذه المحادثة', StatusCodes.FORBIDDEN));
    }
  }

  // البحث عن المحادثة بين المستخدمين
  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, userId] }
  });

  if (!conversation) {
    // إنشاء محادثة جديدة إذا لم تكن موجودة
    conversation = await Conversation.create({
      participants: [req.user._id, userId],
      unreadCount: {}
    });
  }

  // الحصول على الرسائل
  const messages = await Message.find({
    $or: [
      { sender: req.user._id, receiver: userId },
      { sender: userId, receiver: req.user._id }
    ]
  })
    .populate('sender', 'username role profilePicture grade')
    .populate('receiver', 'username role profilePicture grade')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // تحديث الرسائل غير المقروءة كمقروءة
  await Message.updateMany(
    {
      receiver: req.user._id,
      sender: userId,
      isRead: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );

  // تحديث عدد الرسائل غير المقروءة
  conversation.unreadCount.set(req.user._id.toString(), 0);
  await conversation.save();

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      conversation,
      messages: messages.reverse()
    }
  });
}));

// ✅ الحصول على عدد الرسائل غير المقروءة
router.get('/unread-count', protect, asyncHandler(async (req, res, next) => {
  const conversations = await Conversation.find({
    participants: { $in: [req.user._id] }
  });

  let totalUnread = 0;
  conversations.forEach(conversation => {
    totalUnread += conversation.unreadCount.get(req.user._id.toString()) || 0;
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { unreadCount: totalUnread }
  });
}));

// ✅ الحصول على قائمة المستخدمين للمحادثة (حسب الصلاحيات)
router.get('/users', protect, asyncHandler(async (req, res, next) => {
  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  
  let query = {
    _id: { $ne: req.user._id }
  };

  // تحديد من يمكن للمستخدم رؤيته بناءً على الدور
  if (req.user.role === 'student') {
    query.role = 'teacher';
    query.grade = req.user.grade;
  } else if (req.user.role === 'parent') {
    // أولياء الأمور يمكنهم رؤية معلمي أبنائهم والإداريين
    query.$or = [
      { role: 'teacher' },
      { role: 'admin' }
    ];
  } else if (req.user.role === 'teacher') {
    query.$or = [
      { role: 'student', grade: req.user.grade },
      { role: 'teacher' },
      { role: 'admin' },
      { role: 'parent' }
    ];
  } else if (req.user.role === 'admin') {
    query.role = { $in: ['student', 'teacher', 'admin', 'parent'] };
  }

  const users = await User.find(query).select('username email role profilePicture grade');

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { users }
  });
}));

// ✅ الحصول على معلمي الطالب (لأولياء الأمور والطلاب)
router.get('/my-teachers', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'student' && req.user.role !== 'parent') {
    return next(new AppError('هذه الخدمة للطلاب وأولياء الأمور فقط', StatusCodes.FORBIDDEN));
  }

  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  
  let gradeFilter = req.user.grade;
  
  // إذا كان ولي أمر، نحتاج للحصول على صف الابن/الابنة
  if (req.user.role === 'parent') {
    // هنا يمكنك إضافة منطق للحصول على صف الأبناء
    // حالياً سنستخدم الصف المخزن في بيانات ولي الأمر إن وجد
    if (!gradeFilter) {
      return next(new AppError('لا يوجد بيانات صف للأبناء', StatusCodes.BAD_REQUEST));
    }
  }

  const teachers = await User.find({
    role: 'teacher',
    grade: gradeFilter
  }).select('username email profilePicture grade');

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { teachers }
  });
}));

// ✅ الحصول على طلاب المعلم
router.get('/my-students', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return next(new AppError('هذه الخدمة للمعلمين فقط', StatusCodes.FORBIDDEN));
  }

  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  
  const students = await User.find({
    role: 'student',
    grade: req.user.grade
  }).select('username email profilePicture grade');

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { students }
  });
}));

// ✅ الحصول على أولياء أمور الطلاب (للمعلمين والإداريين)
router.get('/my-students-parents', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return next(new AppError('هذه الخدمة للمعلمين والإداريين فقط', StatusCodes.FORBIDDEN));
  }

  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  
  let gradeFilter = req.user.grade;
  
  // إذا كان مدير، يمكنه رؤية جميع أولياء الأمور
  if (req.user.role === 'admin') {
    gradeFilter = undefined;
  }

  const query = {
    role: 'parent'
  };

  if (gradeFilter) {
    query.grade = gradeFilter;
  }

  const parents = await User.find(query).select('username email profilePicture grade');

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { parents }
  });
}));

// ✅ حذف محادثة
router.delete('/conversations/:userId', protect, asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const conversation = await Conversation.findOneAndDelete({
    participants: { $all: [req.user._id, userId] }
  });

  if (!conversation) {
    return next(new AppError('المحادثة غير موجودة', StatusCodes.NOT_FOUND));
  }

  // حذف جميع الرسائل المرتبطة
  await Message.deleteMany({
    $or: [
      { sender: req.user._id, receiver: userId },
      { sender: userId, receiver: req.user._id }
    ]
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم حذف المحادثة بنجاح'
  });
}));

// ========== PARENT-ADMIN SPECIFIC ROUTES ==========

// ✅ الحصول على الإداريين لأولياء الأمور
router.get('/parent/admins', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('هذه الخدمة لأولياء الأمور فقط', StatusCodes.FORBIDDEN));
  }

  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  
  const admins = await User.find({
    role: 'admin',
    isActive: true
  }).select('username email profilePicture phone grade');

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { admins }
  });
}));

// ✅ بدء محادثة جديدة مع الإدارة
router.post('/parent/start-conversation', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('هذه الخدمة لأولياء الأمور فقط', StatusCodes.FORBIDDEN));
  }

  const { message, messageType = 'text' } = req.body;

  if (!message) {
    return next(new AppError('الرسالة مطلوبة', StatusCodes.BAD_REQUEST));
  }

  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  
  // البحث عن أي مدير نشط
  const admin = await User.findOne({
    role: 'admin',
    isActive: true
  });

  if (!admin) {
    return next(new AppError('لا يوجد إداريون متاحون حالياً', StatusCodes.NOT_FOUND));
  }

  // إنشاء الرسالة
  const newMessage = await Message.create({
    sender: req.user._id,
    receiver: admin._id,
    message,
    messageType
  });

  // البحث عن المحادثة أو إنشاء جديدة
  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, admin._id] }
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, admin._id],
      unreadCount: {}
    });
  }

  // تحديث المحادثة
  conversation.lastMessage = newMessage._id;
  conversation.unreadCount.set(admin._id.toString(), 1);
  conversation.updatedAt = new Date();
  await conversation.save();

  // إرجاع الرسالة مع البيانات
  const populatedMessage = await Message.findById(newMessage._id)
    .populate('sender', 'username role profilePicture grade')
    .populate('receiver', 'username role profilePicture grade');

  // إرسال الرسالة عبر Socket.io
  if (req.io) {
    req.io.to(admin._id).emit('newMessage', populatedMessage);
    req.io.to(admin._id).emit('newParentMessage', {
      message: populatedMessage,
      parent: req.user
    });
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: { 
      message: populatedMessage,
      admin: {
        _id: admin._id,
        username: admin.username,
        profilePicture: admin.profilePicture,
        role: admin.role
      }
    }
  });
}));

// ✅ الحصول على محادثات ولي الأمر مع الإدارة فقط
router.get('/parent/conversations', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('هذه الخدمة لأولياء الأمور فقط', StatusCodes.FORBIDDEN));
  }

  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  
  // الحصول على جميع المحادثات مع الإداريين فقط
  const conversations = await Conversation.find({
    participants: { $in: [req.user._id] }
  })
    .populate({
      path: 'participants',
      select: 'username email role profilePicture grade phone'
    })
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

  // تصفية المحادثات التي تحتوي على إداريين
  const adminConversations = conversations.filter(conv => 
    conv.participants.some(p => p.role === 'admin')
  );

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { conversations: adminConversations }
  });
}));

export default router;