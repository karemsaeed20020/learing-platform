// routes/checkout.routes.js
import express from 'express';
import Cart from '../../../DB/models/Cart.model.js';
import Course from '../../../DB/models/Course.model.js';
import Order from '../../../DB/models/Order.model.js';
import { protect } from '../../middlewares/auth.middleware.js';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';

const router = express.Router();

// Available cash payment methods
const PAYMENT_METHODS = {
  VODAFONE_CASH: 'vodafone_cash',
  MOBINIL_CASH: 'mobinil_cash'
};

// Payment instructions for each method
const PAYMENT_INSTRUCTIONS = {
  [PAYMENT_METHODS.VODAFONE_CASH]: {
    name: 'Vodafone Cash',
    instructions: [
      'اتصل بـ *858#',
      'اختر "إرسال أموال"',
      'أدخل رقم الهاتف: 01012345678',
      'أدخل المبلغ: {{amount}} جنيه',
      'أدخل الرقم السري',
      'احتفظ بصورة من إيصال الدفع'
    ],
    phoneNumber: '01012345678',
    accountName: 'E-Learning Platform'
  },
  [PAYMENT_METHODS.MOBINIL_CASH]: {
    name: 'MobiNil Cash',
    instructions: [
      'اتصل بـ *589#',
      'اختر "تحويل أموال"',
      'أدخل رقم الهاتف: 01234567890',
      'أدخل المبلغ: {{amount}} جنيه',
      'أدخل الرقم السري',
      'احتفظ بصورة من إيصال الدفع'
    ],
    phoneNumber: '01234567890',
    accountName: 'E-Learning Platform'
  }
};

// Create cash payment order
router.post('/create-cash-order', protect, asyncHandler(async (req, res, next) => {
  const { paymentMethod, phoneNumber } = req.body;

  // Validate payment method
  if (!Object.values(PAYMENT_METHODS).includes(paymentMethod)) {
    return next(new AppError('طريقة الدفع غير صالحة', StatusCodes.BAD_REQUEST));
  }

  // Get user's cart
  const cart = await Cart.findOne({ user: req.user._id })
    .populate({
      path: 'items.course',
      select: 'title price discountPrice instructor studentsEnrolled thumbnail totalVideos totalDuration'
    });

  if (!cart || cart.items.length === 0) {
    return next(new AppError('السلة فارغة', StatusCodes.BAD_REQUEST));
  }

  // Validate courses and check if user already enrolled
  const enrolledCourses = [];
  for (const item of cart.items) {
    if (!item.course) {
      return next(new AppError('أحد الكورسات غير موجود', StatusCodes.BAD_REQUEST));
    }

    if (item.course.studentsEnrolled.includes(req.user._id)) {
      enrolledCourses.push(item.course.title);
    }
  }

  if (enrolledCourses.length > 0) {
    return next(new AppError(
      `أنت مسجل بالفعل في الكورسات التالية: ${enrolledCourses.join(', ')}`,
      StatusCodes.BAD_REQUEST
    ));
  }

  // Create order with cash payment
  const order = new Order({
    user: req.user._id,
    items: cart.items.map(item => ({
      course: item.course._id,
      price: item.course.discountPrice || item.course.price,
      title: item.course.title,
      thumbnail: item.course.thumbnail
    })),
    totalAmount: cart.totalAmount,
    paymentMethod: paymentMethod,
    paymentStatus: 'pending',
    status: 'pending_payment',
    customerPhone: phoneNumber,
    paymentInstructions: PAYMENT_INSTRUCTIONS[paymentMethod]
  });

  await order.save();

  // Populate order for response
  const populatedOrder = await Order.findById(order._id)
    .populate('items.course', 'title thumbnail instructor totalVideos totalDuration')
    .populate('user', 'username email');

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم إنشاء الطلب بنجاح',
    data: { 
      order: populatedOrder,
      paymentInstructions: {
        ...PAYMENT_INSTRUCTIONS[paymentMethod],
        instructions: PAYMENT_INSTRUCTIONS[paymentMethod].instructions.map(instruction => 
          instruction.replace('{{amount}}', cart.totalAmount)
        )
      }
    }
  });
}));

// Confirm payment (upload receipt)
router.post('/confirm-payment/:orderId', protect, asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const { receiptImage, transactionId } = req.body;

  if (!receiptImage) {
    return next(new AppError('صورة الإيصال مطلوبة', StatusCodes.BAD_REQUEST));
  }

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id
  });

  if (!order) {
    return next(new AppError('الطلب غير موجود', StatusCodes.NOT_FOUND));
  }

  if (order.status !== 'pending_payment') {
    return next(new AppError('لا يمكن تأكيد الدفع لهذا الطلب', StatusCodes.BAD_REQUEST));
  }

  // Update order with payment confirmation
  order.paymentStatus = 'processing';
  order.status = 'processing';
  order.paymentProof = {
    receiptImage,
    transactionId,
    submittedAt: new Date()
  };

  await order.save();

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم استلام تأكيد الدفع بنجاح، جاري مراجعة الإيصال',
    data: { order }
  });
}));

// Admin: Verify payment and enroll student
router.patch('/verify-payment/:orderId', protect, asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const { approved, adminNotes } = req.body;

  // Check if user is admin (you'll need to implement this middleware)
  if (!req.user.isAdmin) {
    return next(new AppError('غير مصرح لك بهذا الإجراء', StatusCodes.FORBIDDEN));
  }

  const order = await Order.findById(orderId)
    .populate('user')
    .populate('items.course');

  if (!order) {
    return next(new AppError('الطلب غير موجود', StatusCodes.NOT_FOUND));
  }

  if (approved) {
    // Enroll student in courses
    for (const item of order.items) {
      await Course.findByIdAndUpdate(item.course._id, {
        $addToSet: { studentsEnrolled: order.user._id }
      });
    }

    order.paymentStatus = 'completed';
    order.status = 'completed';
    order.completedAt = new Date();
    order.adminNotes = adminNotes;

    // Clear user's cart
    await Cart.findOneAndUpdate(
      { user: order.user._id },
      { $set: { items: [], totalAmount: 0 } }
    );

    await order.save();

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'تم تأكيد الدفع وتسجيل الطالب في الكورسات',
      data: { order }
    });
  } else {
    order.paymentStatus = 'rejected';
    order.status = 'cancelled';
    order.adminNotes = adminNotes;
    await order.save();

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'تم رفض الإيصال',
      data: { order }
    });
  }
}));

// Get user orders
router.get('/my-orders', protect, asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('items.course', 'title thumbnail instructor')
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { orders }
  });
}));

// Get order details
router.get('/order/:orderId', protect, asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id
  }).populate('items.course', 'title thumbnail instructor totalVideos totalDuration');

  if (!order) {
    return next(new AppError('الطلب غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { order }
  });
}));
// In your routes/checkout.routes.js - Add this endpoint if not exists

// Get user orders
router.get('/my-orders', protect, asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id })
    .populate({
      path: 'items.course',
      select: 'title thumbnail instructor',
      populate: {
        path: 'instructor',
        select: 'username'
      }
    })
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { orders }
  });
}));
export default router;