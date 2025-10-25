// routes/cart.routes.js
import express from 'express';

import Cart from '../../../DB/models/Cart.model.js';
import Course from '../../../DB/models/Course.model.js';

import { protect } from '../../middlewares/auth.middleware.js';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';

const router = express.Router();

// Add course to cart
// Add course to cart
router.post('/add', protect, asyncHandler(async (req, res, next) => {
  const { courseId } = req.body;

  if (!courseId) {
    return next(new AppError('معرف الكورس مطلوب', StatusCodes.BAD_REQUEST));
  }

  // Check if course exists and is published
  const course = await Course.findOne({
    _id: courseId,
    isPublished: true,
    status: 'published'
  });

  if (!course) {
    return next(new AppError('الكورس غير موجود', StatusCodes.NOT_FOUND));
  }

  // Check if user already enrolled in the course
  if (course.studentsEnrolled.includes(req.user._id)) {
    return next(new AppError('أنت مسجل بالفعل في هذا الكورس', StatusCodes.BAD_REQUEST));
  }

  // Find or create cart for user
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = new Cart({ 
      user: req.user._id, 
      items: [] 
    });
  }

  // Check if course already in cart
  const existingItem = cart.items.find(item => 
    item.course.toString() === courseId
  );

  if (existingItem) {
    return next(new AppError('الكورس مضاف بالفعل إلى السلة', StatusCodes.BAD_REQUEST));
  }

  // Add course to cart
  cart.items.push({ 
    course: courseId,
    addedAt: new Date()
  });

  await cart.save();

  // Populate cart items with course details for response
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: 'items.course',
      select: 'title shortDescription price discountPrice thumbnail instructor totalVideos totalDuration',
      populate: {
        path: 'instructor',
        select: 'username profilePicture'
      }
    });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم إضافة الكورس إلى السلة بنجاح',
    data: { cart: populatedCart }
  });
}));

// Remove course from cart
router.delete('/remove/:courseId', protect, asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;

  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return next(new AppError('السلة فارغة', StatusCodes.NOT_FOUND));
  }

  // Check if course exists in cart
  const itemExists = cart.items.some(item => 
    item.course.toString() === courseId
  );

  if (!itemExists) {
    return next(new AppError('الكورس غير موجود في السلة', StatusCodes.NOT_FOUND));
  }

  // Remove course from cart
  cart.items = cart.items.filter(item => 
    item.course.toString() !== courseId
  );

  await cart.save();

  // Populate for response
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: 'items.course',
      select: 'title shortDescription price discountPrice thumbnail instructor totalVideos totalDuration',
      populate: {
        path: 'instructor',
        select: 'username profilePicture'
      }
    });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم إزالة الكورس من السلة',
    data: { cart: populatedCart }
  });
}));

// Get user cart
router.get('/my-cart', protect, asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user._id })
    .populate({
      path: 'items.course',
      select: 'title shortDescription price discountPrice thumbnail instructor totalVideos totalDuration',
      populate: {
        path: 'instructor',
        select: 'username profilePicture'
      }
    });

  if (!cart) {
    // Create empty cart if doesn't exist
    cart = new Cart({
      user: req.user._id,
      items: [],
      totalAmount: 0
    });
    await cart.save();
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { cart }
  });
}));

// Clear cart
router.delete('/clear', protect, asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = new Cart({
      user: req.user._id,
      items: [],
      totalAmount: 0
    });
  }

  cart.items = [];
  cart.totalAmount = 0;
  await cart.save();

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تفريغ السلة',
    data: { cart }
  });
}));

// Get cart count
router.get('/count', protect, asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  
  const count = cart ? cart.items.length : 0;

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { count }
  });
}));


export default router;