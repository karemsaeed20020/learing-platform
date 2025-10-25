import express from 'express';
import { Message, Conversation } from '../../../DB/models/Chat.model.js';
import { protect } from '../../middlewares/auth.middleware.js';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';

const router = express.Router();

// ✅ إرسال رسالة مع Socket.io
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

  // التحقق من الصلاحيات: الطلاب يمكنهم المراسلة مع معلميهم فقط
  if (req.user.role === 'student' && receiver.role === 'student') {
    return next(new AppError('الطلاب لا يمكنهم المراسلة مع طلاب آخرين', StatusCodes.FORBIDDEN));
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
  const currentUnread = conversation.unreadCount[receiverId] || 0;
  conversation.unreadCount[receiverId] = currentUnread + 1;
  
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

  // الطلاب يمكنهم المحادثة مع معلميهم فقط
  if (req.user.role === 'student' && targetUser.role === 'student') {
    return next(new AppError('غير مسموح بالدخول إلى هذه المحادثة', StatusCodes.FORBIDDEN));
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
  conversation.unreadCount[req.user._id] = 0;
  await conversation.save();

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      conversation,
      messages: messages.reverse() // عكس الترتيب لعرض الأقدم أولاً
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
    totalUnread += conversation.unreadCount[req.user._id] || 0;
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
    _id: { $ne: req.user._id } // استبعاد المستخدم الحالي
  };

  // تحديد من يمكن للمستخدم رؤيته
  if (req.user.role === 'student') {
    // الطلاب يمكنهم رؤية معلميهم فقط
    query.role = 'teacher';
    query.grade = req.user.grade; // معلمي نفس الصف فقط
  } else if (req.user.role === 'teacher') {
    // المعلمون يمكنهم رؤية طلابهم والإداريين والمعلمين الآخرين
    query.$or = [
      { role: 'student', grade: req.user.grade }, // طلاب نفس الصف
      { role: 'teacher' }, // المعلمون الآخرون
      { role: 'admin' } // الإداريون
    ];
  } else if (req.user.role === 'admin') {
    // الإداريون يمكنهم رؤية الجميع
    query.role = { $in: ['student', 'teacher', 'admin'] };
  }

  const users = await User.find(query).select('username email role profilePicture grade');

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { users }
  });
}));

// ✅ الحصول على معلمي الطالب
router.get('/my-teachers', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'student') {
    return next(new AppError('هذه الخدمة للطلاب فقط', StatusCodes.FORBIDDEN));
  }

  const User = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  
  const teachers = await User.find({
    role: 'teacher',
    grade: req.user.grade // معلمو نفس الصف
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
    grade: req.user.grade // طلاب نفس الصف
  }).select('username email profilePicture grade');

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { students }
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

export default router;