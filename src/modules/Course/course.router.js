// routes/course.routes.js
import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';


import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../utils/asyncHandler.js';
import cloudinary from '../../utils/cloudinary.js';
import { protect } from '../../middlewares/auth.middleware.js';
import AppError from '../../utils/AppError.js';
import Video from '../../../DB/models/Video.model.js';
import Course from '../../../DB/models/Course.model.js';

const router = express.Router();

// Cloudinary storage for course thumbnails
const thumbnailStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'learning-platform/courses/thumbnails',
    resource_type: 'image',
    format: 'jpg',
    public_id: (req, file) => {
      return `thumbnail-${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    }
  },
});

const uploadThumbnail = multer({
  storage: thumbnailStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError('يسمح برفع ملفات الصور فقط', StatusCodes.BAD_REQUEST), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Create new course (Admin/Teacher only)
router.post('/', protect, uploadThumbnail.single('thumbnail'), asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return next(new AppError('غير مصرح لك بإنشاء كورسات', StatusCodes.FORBIDDEN));
  }

  const {
    title,
    description,
    shortDescription,
    price,
    discountPrice,
    grade,
    subject,
    level,
    tags,
    requirements,
    learningOutcomes,
    chapters
  } = req.body;

  // Validation
  if (!title || !description || !shortDescription || !price || !grade) {
    return next(new AppError('جميع الحقول الأساسية مطلوبة', StatusCodes.BAD_REQUEST));
  }

  if (!req.file) {
    return next(new AppError('صورة الكورس مطلوبة', StatusCodes.BAD_REQUEST));
  }

  // Parse JSON arrays
  let tagsArray = [];
  let requirementsArray = [];
  let learningOutcomesArray = [];
  let chaptersArray = [];

  try {
    tagsArray = tags ? JSON.parse(tags) : [];
    requirementsArray = requirements ? JSON.parse(requirements) : [];
    learningOutcomesArray = learningOutcomes ? JSON.parse(learningOutcomes) : [];
    chaptersArray = chapters ? JSON.parse(chapters) : [];
  } catch (error) {
    return next(new AppError('خطأ في تنسيق البيانات', StatusCodes.BAD_REQUEST));
  }

  // Validate that chapters have videos
  for (const chapter of chaptersArray) {
    if (!chapter.title || !chapter.order) {
      return next(new AppError('جميع الفصول يجب أن تحتوي على عنوان وترتيب', StatusCodes.BAD_REQUEST));
    }

    // Validate videos in chapters
    for (const video of chapter.videos) {
      if (!video.video) {
        return next(new AppError('جميع الدروس يجب أن تحتوي على فيديو', StatusCodes.BAD_REQUEST));
      }

      // Check if video exists
      const videoExists = await Video.findById(video.video);
      if (!videoExists) {
        return next(new AppError(`الفيديو ${video.video} غير موجود`, StatusCodes.BAD_REQUEST));
      }
    }
  }

  const course = await Course.create({
    title,
    description,
    shortDescription,
    price: parseFloat(price),
    discountPrice: discountPrice ? parseFloat(discountPrice) : undefined,
    thumbnail: req.file.path,
    instructor: req.user._id,
    grade,
    subject: subject || 'اللغة العربية',
    level: level || 'مبتدئ',
    tags: tagsArray,
    requirements: requirementsArray,
    learningOutcomes: learningOutcomesArray,
    chapters: chaptersArray,
    // status: 'draft'
    status: 'published', // Change from 'draft' to 'published'
  isPublished: true  
  });

  await course.populate('instructor', 'username profilePicture');
  
  // Populate videos in chapters
  await course.populate({
    path: 'chapters.videos.video',
    select: 'title description duration videoUrl thumbnailUrl'
  });

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'تم إنشاء الكورس بنجاح',
    data: { course }
  });
}));

// Get all courses for students (published only)
router.get('/', asyncHandler(async (req, res, next) => {
  const { grade, subject, level, page = 1, limit = 12, search, instructor } = req.query;
  
  let query = { isPublished: true, status: 'published' };
  
  if (grade) query.grade = grade;
  if (subject) query.subject = subject;
  if (level) query.level = level;
  if (instructor) query.instructor = instructor;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { shortDescription: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const courses = await Course.find(query)
    .populate('instructor', 'username profilePicture bio')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .select('-chapters.videos.video'); // Exclude video details for listing

  const total = await Course.countDocuments(query);

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: courses.length,
    data: { courses },
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Get single course for students
router.get('/:id', asyncHandler(async (req, res, next) => {
  const course = await Course.findOne({
    _id: req.params.id,
    isPublished: true,
    status: 'published'
  })
    .populate('instructor', 'username profilePicture bio')
    .populate({
      path: 'chapters.videos.video',
      select: 'title description videoUrl thumbnailUrl duration isPreview'
    });

  if (!course) {
    return next(new AppError('الكورس غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { course }
  });
}));

// Get teacher's courses (for admin dashboard)
router.get('/instructor/my-courses', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه الصفحة', StatusCodes.FORBIDDEN));
  }

  const { page = 1, limit = 10, status } = req.query;
  
  let query = { instructor: req.user._id };
  if (status) query.status = status;

  const courses = await Course.find(query)
    .populate('instructor', 'username profilePicture')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Course.countDocuments(query);

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: courses.length,
    data: { courses },
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Update course
router.patch('/:id', protect, uploadThumbnail.single('thumbnail'), asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new AppError('الكورس غير موجود', StatusCodes.NOT_FOUND));
  }

  if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتعديل هذا الكورس', StatusCodes.FORBIDDEN));
  }

  const updateData = { ...req.body };
  
  if (req.file) {
    updateData.thumbnail = req.file.path;
    
    // Delete old thumbnail from Cloudinary
    if (course.thumbnail) {
      const publicId = course.thumbnail.split('/').pop().split('.')[0];
      try {
        await cloudinary.uploader.destroy(`learning-platform/courses/thumbnails/${publicId}`);
      } catch (error) {
        console.error('Error deleting old thumbnail:', error);
      }
    }
  }

  // Parse JSON fields if they exist
  if (updateData.tags) updateData.tags = JSON.parse(updateData.tags);
  if (updateData.requirements) updateData.requirements = JSON.parse(updateData.requirements);
  if (updateData.learningOutcomes) updateData.learningOutcomes = JSON.parse(updateData.learningOutcomes);
  if (updateData.chapters) updateData.chapters = JSON.parse(updateData.chapters);

  const updatedCourse = await Course.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('instructor', 'username profilePicture')
   .populate({
     path: 'chapters.videos.video',
     select: 'title description videoUrl thumbnailUrl duration'
   });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تحديث الكورس بنجاح',
    data: { course: updatedCourse }
  });
}));

// Publish course
router.patch('/:id/publish', protect, asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new AppError('الكورس غير موجود', StatusCodes.NOT_FOUND));
  }

  if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بنشر هذا الكورس', StatusCodes.FORBIDDEN));
  }

  // Check if course has at least one chapter with one video
  const hasVideos = course.chapters.some(chapter => chapter.videos.length > 0);
  if (!hasVideos) {
    return next(new AppError('لا يمكن نشر كورس بدون فيديوهات', StatusCodes.BAD_REQUEST));
  }

  course.isPublished = true;
  course.status = 'published';
  await course.save();

  await course.populate('instructor', 'username profilePicture');

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم نشر الكورس بنجاح',
    data: { course }
  });
}));

// Unpublish course
router.patch('/:id/unpublish', protect, asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new AppError('الكورس غير موجود', StatusCodes.NOT_FOUND));
  }

  if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بإلغاء نشر هذا الكورس', StatusCodes.FORBIDDEN));
  }

  course.isPublished = false;
  course.status = 'draft';
  await course.save();

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم إلغاء نشر الكورس بنجاح',
    data: { course }
  });
}));

// Delete course
router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new AppError('الكورس غير موجود', StatusCodes.NOT_FOUND));
  }

  if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بحذف هذا الكورس', StatusCodes.FORBIDDEN));
  }

  // Delete thumbnail from Cloudinary
  if (course.thumbnail) {
    const publicId = course.thumbnail.split('/').pop().split('.')[0];
    try {
      await cloudinary.uploader.destroy(`learning-platform/courses/thumbnails/${publicId}`);
    } catch (error) {
      console.error('Error deleting thumbnail:', error);
    }
  }

  await Course.findByIdAndDelete(req.params.id);

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم حذف الكورس بنجاح'
  });
}));

// Add video to course chapter
router.post('/:courseId/chapters/:chapterId/videos', protect, asyncHandler(async (req, res, next) => {
  const { courseId, chapterId } = req.params;
  const { videoId, title, order, isPreview } = req.body;

  if (!videoId) {
    return next(new AppError('معرف الفيديو مطلوب', StatusCodes.BAD_REQUEST));
  }

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError('الكورس غير موجود', StatusCodes.NOT_FOUND));
  }

  // Check if user owns the course
  if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتعديل هذا الكورس', StatusCodes.FORBIDDEN));
  }

  const video = await Video.findById(videoId);
  if (!video) {
    return next(new AppError('الفيديو غير موجود', StatusCodes.NOT_FOUND));
  }

  const chapter = course.chapters.id(chapterId);
  if (!chapter) {
    return next(new AppError('الفصل غير موجود', StatusCodes.NOT_FOUND));
  }

  // Check if video already exists in chapter
  const videoExists = chapter.videos.some(v => v.video.toString() === videoId);
  if (videoExists) {
    return next(new AppError('الفيديو مضاف بالفعل إلى هذا الفصل', StatusCodes.BAD_REQUEST));
  }

  // Add video to chapter
  chapter.videos.push({
    video: videoId,
    title: title || video.title,
    duration: video.duration,
    order: order || chapter.videos.length,
    isPreview: isPreview || false
  });

  await course.save();
  await course.populate('chapters.videos.video');

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم إضافة الفيديو إلى الفصل بنجاح',
    data: { course }
  });
}));

// Remove video from course chapter
router.delete('/:courseId/chapters/:chapterId/videos/:videoId', protect, asyncHandler(async (req, res, next) => {
  const { courseId, chapterId, videoId } = req.params;

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError('الكورس غير موجود', StatusCodes.NOT_FOUND));
  }

  // Check if user owns the course
  if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتعديل هذا الكورس', StatusCodes.FORBIDDEN));
  }

  const chapter = course.chapters.id(chapterId);
  if (!chapter) {
    return next(new AppError('الفصل غير موجود', StatusCodes.NOT_FOUND));
  }

  chapter.videos = chapter.videos.filter(v => v._id.toString() !== videoId);
  await course.save();

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم إزالة الفيديو من الفصل بنجاح',
    data: { course }
  });
}));

export default router;