// routes/review.routes.js
import express from 'express';
// import Review from '../models/Review.model.js';
// import Course from '../models/Course.model.js';
// import { protect } from '../middlewares/auth.middleware.js';
// import AppError from "../utils/AppError.js";
// import { asyncHandler } from "../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../utils/asyncHandler.js';
import Course from '../../../DB/models/Course.model.js';
import AppError from '../../utils/AppError.js';
import Review from '../../../DB/models/Review.model.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Get reviews for a course
router.get('/course/:courseId', asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  // Check if course exists
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError('الكورس غير موجود', StatusCodes.NOT_FOUND));
  }

  const reviews = await Review.find({ course: courseId })
    .populate('user', 'username profilePicture')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Review.countDocuments({ course: courseId });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: reviews.length,
    data: { reviews },
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Create a review
router.post('/', protect, asyncHandler(async (req, res, next) => {
  const { courseId, rating, comment } = req.body;

  // Validation
  if (!courseId || !rating || !comment) {
    return next(new AppError('جميع الحقول مطلوبة', StatusCodes.BAD_REQUEST));
  }

  if (rating < 1 || rating > 5) {
    return next(new AppError('التقييم يجب أن يكون بين 1 و 5', StatusCodes.BAD_REQUEST));
  }

  // Check if course exists and user is enrolled
  const course = await Course.findOne({
    _id: courseId,
    studentsEnrolled: req.user._id
  });

  if (!course) {
    return next(new AppError('يجب أن تكون مسجلاً في الكورس لتتمكن من التقييم', StatusCodes.FORBIDDEN));
  }

  // Check if user already reviewed this course
  const existingReview = await Review.findOne({
    user: req.user._id,
    course: courseId
  });

  if (existingReview) {
    return next(new AppError('لقد قمت بتقييم هذا الكورس مسبقاً', StatusCodes.BAD_REQUEST));
  }

  // Create review
  const review = await Review.create({
    user: req.user._id,
    course: courseId,
    rating,
    comment,
    isVerified: true // Auto-verify since user is enrolled
  });

  await review.populate('user', 'username profilePicture');

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'تم إضافة التقييم بنجاح',
    data: { review }
  });
}));

// Update a review
router.patch('/:id', protect, asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;

  const review = await Review.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!review) {
    return next(new AppError('التقييم غير موجود', StatusCodes.NOT_FOUND));
  }

  if (rating && (rating < 1 || rating > 5)) {
    return next(new AppError('التقييم يجب أن يكون بين 1 و 5', StatusCodes.BAD_REQUEST));
  }

  review.rating = rating || review.rating;
  review.comment = comment || review.comment;
  await review.save();

  await review.populate('user', 'username profilePicture');

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تحديث التقييم بنجاح',
    data: { review }
  });
}));

// Delete a review
router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
  const review = await Review.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!review) {
    return next(new AppError('التقييم غير موجود', StatusCodes.NOT_FOUND));
  }

  await Review.findByIdAndDelete(req.params.id);

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم حذف التقييم بنجاح'
  });
}));

// Get user's review for a course
router.get('/my-review/:courseId', protect, asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;

  const review = await Review.findOne({
    user: req.user._id,
    course: courseId
  }).populate('user', 'username profilePicture');

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { review }
  });
}));

export default router;