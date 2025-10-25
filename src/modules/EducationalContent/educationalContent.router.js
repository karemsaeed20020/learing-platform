import express from 'express';
import { contentUpload } from '../../middlewares/multer.middleware.js';
import { StatusCodes } from 'http-status-codes';
import EducationalContent from "../../../DB/models/EducationalContent.model.js";
import { protect } from '../../middlewares/auth.middleware.js';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
const router = express.Router();

// الحصول على جميع المحتويات (للمعلم)
router.get('/teacher', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const contents = await EducationalContent.find({ teacher: req.user._id })
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: contents.length,
    data: { contents }
  });
}));

// الحصول على محتويات الطالب حسب صفه
router.get('/student', protect, asyncHandler(async (req, res, next) => {
  const contents = await EducationalContent.find({
    $or: [
      { grade: req.user.grade },
      { grade: 'كلاهما' }
    ],
    status: 'active'
  })
    .populate('teacher', 'username')
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: contents.length,
    data: { contents }
  });
}));

// إنشاء محتوى جديد
router.post('/', protect, contentUpload.array('files', 5), asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بإنشاء محتوى', StatusCodes.FORBIDDEN));
  }

  const {
    title,
    description,
    type,
    fileType,
    category,
    grade,
    content,
    isImportant,
    publishDate,
    expiryDate
  } = req.body;

  const educationalContent = await EducationalContent.create({
    title,
    description,
    teacher: req.user._id,
    type,
    fileType,
    category,
    grade,
    content,
    isImportant: isImportant === 'true',
    publishDate: publishDate || new Date(),
    expiryDate
  });

  // Handle file uploads
  if (req.files && req.files.length > 0) {
    educationalContent.files = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    }));
    await educationalContent.save();
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: { educationalContent }
  });
}));

// تحديث محتوى
router.put('/:id', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بتعديل المحتوى', StatusCodes.FORBIDDEN));
  }

  const {
    title,
    description,
    type,
    fileType,
    category,
    grade,
    content,
    isImportant
  } = req.body;

  const educationalContent = await EducationalContent.findOneAndUpdate(
    {
      _id: req.params.id,
      teacher: req.user._id
    },
    {
      title,
      description,
      type,
      fileType,
      category,
      grade,
      content,
      isImportant: isImportant === 'true'
    },
    { new: true, runValidators: true }
  );

  if (!educationalContent) {
    return next(new AppError('المحتوى غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تحديث المحتوى بنجاح',
    data: { educationalContent }
  });
}));

// حذف محتوى
router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بحذف المحتوى', StatusCodes.FORBIDDEN));
  }

  const educationalContent = await EducationalContent.findOneAndDelete({
    _id: req.params.id,
    teacher: req.user._id
  });

  if (!educationalContent) {
    return next(new AppError('المحتوى غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم حذف المحتوى بنجاح'
  });
}));

// تحميل ملف
router.get('/:id/download/:fileIndex', protect, asyncHandler(async (req, res, next) => {
  const educationalContent = await EducationalContent.findById(req.params.id);

  if (!educationalContent) {
    return next(new AppError('المحتوى غير موجود', StatusCodes.NOT_FOUND));
  }

  const fileIndex = parseInt(req.params.fileIndex);
  if (fileIndex < 0 || fileIndex >= educationalContent.files.length) {
    return next(new AppError('الملف غير موجود', StatusCodes.NOT_FOUND));
  }

  const file = educationalContent.files[fileIndex];
  
  let downloadUrl = file.path;
  
  if (downloadUrl.includes('cloudinary.com')) {
    downloadUrl = downloadUrl.replace('/image/upload/', '/raw/upload/');
    downloadUrl += '?fl_attachment';
  }
  
  res.redirect(downloadUrl);
}));

export default router;