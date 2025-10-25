import express from 'express';
import { StatusCodes } from 'http-status-codes';
import NotificationService from '../../services/notificationService.js';
import Notification from '../../../DB/models/Notification.model.js';
import User from '../../../DB/models/user.model.js';

import { protect } from '../../middlewares/auth.middleware.js';
import asyncHandler from '../../utils/asyncHandler.js';
import AppError from '../../utils/AppError.js';

const router = express.Router();

// ✅ الحصول على جميع إشعارات المستخدم
router.get('/', protect, asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, unreadOnly = false } = req.query;
  
  let query = { recipient: req.user._id };
  
  if (unreadOnly === 'true') {
    query.isRead = false;
  }

  const notifications = await Notification.find(query)
    .populate('sender', 'username role')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({ 
    recipient: req.user._id, 
    isRead: false 
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: notifications.length,
    unreadCount,
    data: { notifications }
  });
}));

// ✅ وضع علامة مقروء على إشعار
router.patch('/:id/read', protect, asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    { 
      _id: req.params.id, 
      recipient: req.user._id 
    },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return next(new AppError('الإشعار غير موجود', StatusCodes.NOT_FOUND));
  }

  const unreadCount = await Notification.countDocuments({ 
    recipient: req.user._id, 
    isRead: false 
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم وضع علامة مقروء على الإشعار',
    data: { notification, unreadCount }
  });
}));

// ✅ وضع علامة مقروء على جميع الإشعارات
router.patch('/read-all', protect, asyncHandler(async (req, res, next) => {
  await Notification.updateMany(
    { 
      recipient: req.user._id,
      isRead: false 
    },
    { isRead: true }
  );

  const unreadCount = await Notification.countDocuments({ 
    recipient: req.user._id, 
    isRead: false 
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم وضع علامة مقروء على جميع الإشعارات',
    data: { unreadCount }
  });
}));

// ✅ حذف إشعار
router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user._id
  });

  if (!notification) {
    return next(new AppError('الإشعار غير موجود', StatusCodes.NOT_FOUND));
  }

  const unreadCount = await Notification.countDocuments({ 
    recipient: req.user._id, 
    isRead: false 
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم حذف الإشعار بنجاح',
    data: { unreadCount }
  });
}));

// ✅ الحصول على عدد الإشعارات غير المقروءة
router.get('/unread-count', protect, asyncHandler(async (req, res, next) => {
  const unreadCount = await Notification.countDocuments({ 
    recipient: req.user._id, 
    isRead: false 
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { unreadCount }
  });
}));

// 📨 FROM STUDENT TO ADMIN
router.post('/student/send', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'student') {
    return next(new AppError('غير مصرح لك بإرسال إشعارات', StatusCodes.FORBIDDEN));
  }

  const { subject, message } = req.body;

  try {
    console.log('Student sending message to admin:', req.user.username);
    await NotificationService.notifySupportRequest(req.user, subject, message);
    
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'تم إرسال الرسالة بنجاح للمشرفين'
    });
  } catch (error) {
    console.error('Error in student send route:', error);
    return next(new AppError('فشل في إرسال الرسالة: ' + error.message, StatusCodes.INTERNAL_SERVER_ERROR));
  }
}));

// 📨 FROM ADMIN TO STUDENT
router.post('/admin/send', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بإرسال إشعارات', StatusCodes.FORBIDDEN));
  }

  const { recipientType, specificStudent, specificGrade, title, message, priority } = req.body;

  try {
    console.log('Admin sending notification:', { recipientType, specificStudent, specificGrade, title });

    if (recipientType === 'all') {
      await NotificationService.notifyAllStudentsFromAdmin(req.user, title, message, priority);
    } else if (recipientType === 'grade') {
      if (!specificGrade) {
        return next(new AppError('يرجى تحديد الصف', StatusCodes.BAD_REQUEST));
      }
      await NotificationService.notifyGradeStudentsFromAdmin(req.user, specificGrade, title, message, priority);
    } else if (recipientType === 'student') {
      if (!specificStudent) {
        return next(new AppError('يرجى تحديد الطالب', StatusCodes.BAD_REQUEST));
      }
      const student = await User.findById(specificStudent);
      if (!student) {
        return next(new AppError('الطالب غير موجود', StatusCodes.NOT_FOUND));
      }
      await NotificationService.notifyStudentFromAdmin(req.user, student, title, message, priority);
    } else {
      return next(new AppError('نوع المستلم غير صحيح', StatusCodes.BAD_REQUEST));
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'تم إرسال الإشعار بنجاح'
    });
  } catch (error) {
    console.error('Error in admin send route:', error);
    return next(new AppError('فشل في إرسال الإشعار: ' + error.message, StatusCodes.INTERNAL_SERVER_ERROR));
  }
}));

export default router;