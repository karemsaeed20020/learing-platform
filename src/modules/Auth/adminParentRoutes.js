// import express from 'express';
// import User from '../models/User.js';
// import { protect } from '../middlewares/auth.middleware.js';
// import { asyncHandler } from '../utils/asyncHandler.js';
// import { StatusCodes } from 'http-status-codes';
// import AppError from '../utils/AppError.js';
// import sendEmail from '../utils/emails.js';
import express from 'express'
import { StatusCodes } from "http-status-codes";
import AppError from "../../utils/AppError.js";
import asyncHandler from "../../utils/asyncHandler.js";
import User from "../../../DB/models/user.model.js";
import { protect } from "../../middlewares/auth.middleware.js";
import sendEmail from '../../utils/emails.js';

const router = express.Router();
// In your admin parent creation route - FIX THE VALIDATION ERROR
router.post('/parents', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتنفيذ هذا الإجراء', StatusCodes.FORBIDDEN));
  }

  const { 
    username, 
    email, 
    phone, 
    password = '123456', // Default password
    children = [] // Array of student IDs
  } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return next(new AppError('البريد الإلكتروني أو اسم المستخدم موجود مسبقاً', StatusCodes.BAD_REQUEST));
  }

  // Verify that all children exist and are students
  if (children.length > 0) {
    const students = await User.find({ 
      _id: { $in: children },
      role: 'student'
    });
    
    if (students.length !== children.length) {
      return next(new AppError('بعض الطلاب غير موجودين أو ليسوا طلاب', StatusCodes.BAD_REQUEST));
    }
  }

  // Create parent account - FIX: Include confirmPassword
  const parent = await User.create({
    username,
    email,
    phone,
    password,
    confirmPassword: password, // ✅ ADD THIS LINE - set same as password
    role: 'parent',
    isVerified: true, // Auto-verify for admin-created accounts
    isActive: true,   // Ensure account is active
    children: children
  });

  // Link parent to children (update student records)
  if (children.length > 0) {
    await User.updateMany(
      { _id: { $in: children } },
      { $set: { parent: parent._id } }
    );
  }

  // ✅ REMOVE EMAIL SENDING if you don't want it
  // Or keep it but remove OTP verification

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'تم إنشاء حساب ولي الأمر بنجاح',
    data: {
      parent: {
        id: parent._id,
        username: parent.username,
        email: parent.email,
        password: password, // ✅ Return password so admin can see it
        childrenCount: children.length
      }
    }
  });
}));

// ✅ Get all parents with their children (Admin only)
router.get('/parents', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const { page = 1, limit = 10, search } = req.query;

  let query = { role: 'parent' };

  // Search in username and email
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const parents = await User.find(query)
    .populate('children', 'username email grade')
    .select('-password -refreshTokens')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(query);

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: parents.length,
    data: { parents },
    pagination: {
      current: parseInt(page),
      total: Math.ceil(total / limit),
      results: total
    }
  });
}));

// ✅ Link student to existing parent (Admin only)
router.post('/parents/:parentId/link-student', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتنفيذ هذا الإجراء', StatusCodes.FORBIDDEN));
  }

  const { parentId } = req.params;
  const { studentId } = req.body;

  // Check if parent exists and is actually a parent
  const parent = await User.findOne({ _id: parentId, role: 'parent' });
  if (!parent) {
    return next(new AppError('ولي الأمر غير موجود', StatusCodes.NOT_FOUND));
  }

  // Check if student exists and is actually a student
  const student = await User.findOne({ _id: studentId, role: 'student' });
  if (!student) {
    return next(new AppError('الطالب غير موجود', StatusCodes.NOT_FOUND));
  }

  // Check if already linked
  if (parent.children.includes(studentId)) {
    return next(new AppError('الطالب مرتبط مسبقاً بهذا ولي الأمر', StatusCodes.BAD_REQUEST));
  }

  // Link parent to student
  parent.children.push(studentId);
  await parent.save();

  // Link student to parent
  student.parent = parentId;
  await student.save();

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم ربط الطالب بولي الأمر بنجاح',
    data: {
      parent: {
        id: parent._id,
        username: parent.username,
        childrenCount: parent.children.length
      },
      student: {
        id: student._id,
        username: student.username
      }
    }
  });
}));

// ✅ Unlink student from parent (Admin only)
router.delete('/parents/:parentId/unlink-student/:studentId', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتنفيذ هذا الإجراء', StatusCodes.FORBIDDEN));
  }

  const { parentId, studentId } = req.params;

  // Remove student from parent's children array
  await User.findByIdAndUpdate(
    parentId,
    { $pull: { children: studentId } }
  );

  // Remove parent reference from student
  await User.findByIdAndUpdate(
    studentId,
    { $set: { parent: null } }
  );

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم فصل الطالب عن ولي الأمر بنجاح'
  });
}));

// ✅ Get all students (for dropdown when creating parent)
router.get('/students', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const { search } = req.query;

  let query = { role: 'student' };

  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const students = await User.find(query)
    .select('username email grade')
    .sort({ username: 1 })
    .limit(50); // Limit results for dropdown

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: students.length,
    data: { students }
  });
}));

export default router;