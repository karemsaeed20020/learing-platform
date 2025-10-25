import express from 'express';
import Video from '../../../DB/models/Video.model.js';
import { protect } from '../../middlewares/auth.middleware.js';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';
import localVideoUpload from '../../utils/videoUpload.js';
import { megaService } from '../../services/megaService.js';
const router = express.Router();

// ✅ GET ALL VIDEOS (For Admin Panel)
router.get('/', protect, asyncHandler(async (req, res, next) => {
  const { grade, chapter, page = 1, limit = 50 } = req.query;
  
  console.log('📥 Fetching videos with filters:', { grade, chapter });
  
  // Build filter - only show published videos
  const filter = { isPublished: true };
  
  // Add grade filter if provided
  if (grade && grade !== 'الكل') {
    filter.grade = grade;
  }
  
  // Add chapter filter if provided
  if (chapter && chapter !== 'الكل') {
    filter.chapter = chapter;
  }
  
  console.log('🔍 Final filter:', filter);

  const videos = await Video.find(filter)
    .populate('uploader', 'username')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean(); // Better performance

  const total = await Video.countDocuments(filter);

  console.log(`✅ Found ${videos.length} videos`);

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: videos.length,
    data: {
      videos,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
}));

// ✅ GET SINGLE VIDEO
router.get('/:id', protect, asyncHandler(async (req, res, next) => {
  const video = await Video.findById(req.params.id)
    .populate('uploader', 'username email');

  if (!video) {
    return next(new AppError('الفيديو غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { video }
  });
}));

// ✅ MEGA.NZ UPLOAD - FIXED
router.post('/upload-mega', protect, 
  // Multer middleware
  (req, res, next) => {
    console.log('📦 Starting Mega.nz upload process...');
    
    // Set longer timeouts for large files
    req.setTimeout(30 * 60 * 1000); // 30 minutes
    res.setTimeout(30 * 60 * 1000);
    
    localVideoUpload.single('video')(req, res, (err) => {
      if (err) {
        console.error('❌ Local upload error:', err);
        return next(new AppError(`فشل في رفع الملف: ${err.message}`, StatusCodes.BAD_REQUEST));
      }
      console.log('✅ Local file uploaded successfully');
      next();
    });
  }, 
  
  // Main upload handler
  asyncHandler(async (req, res, next) => {
    // Check admin permissions
    if (req.user.role !== 'admin') {
      return next(new AppError('غير مصرح لك برفع الفيديوهات', StatusCodes.FORBIDDEN));
    }

    const { title, description, grade, chapter, tags } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return next(new AppError('العنوان مطلوب', StatusCodes.BAD_REQUEST));
    }
    if (!description || !description.trim()) {
      return next(new AppError('الوصف مطلوب', StatusCodes.BAD_REQUEST));
    }
    if (!grade) {
      return next(new AppError('الصف مطلوب', StatusCodes.BAD_REQUEST));
    }
    if (!chapter) {
      return next(new AppError('الفصل مطلوب', StatusCodes.BAD_REQUEST));
    }

    if (!req.file) {
      return next(new AppError('يرجى اختيار ملف فيديو', StatusCodes.BAD_REQUEST));
    }

    const fileSizeMB = req.file.size / (1024 * 1024);
    
    console.log('📹 Processing Mega.nz upload:', {
      fileName: req.file.originalname,
      fileSize: fileSizeMB.toFixed(2) + 'MB',
      title: title,
      grade: grade,
      chapter: chapter
    });

    // Check file size limit (2GB)
    if (fileSizeMB > 2000) {
      // Clean up local file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return next(new AppError('حجم الفيديو كبير جداً. الحد الأقصى 2GB', StatusCodes.BAD_REQUEST));
    }

    try {
      console.log('🔄 Uploading to Mega.nz...');
      
      // Upload to Mega.nz
      const megaResult = await megaService.uploadFile(
        req.file.path,
        req.file.originalname
      );

      console.log('✅ Mega.nz upload successful:', {
        fileName: megaResult.fileName,
        fileSize: megaResult.fileSize,
        downloadLink: megaResult.downloadLink
      });

      // Create video record in database
      const video = await Video.create({
        title: title.trim(),
        description: description.trim(),
        videoUrl: megaResult.downloadLink,
        storageType: 'mega',
        megaFileId: megaResult.fileId,
        fileName: megaResult.fileName,
        thumbnailUrl: null, // Mega.nz doesn't generate thumbnails
        duration: 0, // You can extract duration later if needed
        fileSize: megaResult.fileSize,
        format: path.extname(req.file.originalname).replace('.', ''),
        grade: grade.trim(),
        chapter: chapter.trim(),
        subject: 'اللغة العربية',
        uploader: req.user._id,
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        isPublished: true, // ✅ IMPORTANT: Make video visible
        views: 0,
        likes: []
      });

      // Clean up local file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🧹 Cleaned up local temporary file');
      }

      console.log('✅ Video record created in database:', video._id);

      res.status(StatusCodes.CREATED).json({
        status: 'success',
        message: 'تم رفع الفيديو إلى Mega.nz بنجاح',
        data: { 
          video: {
            _id: video._id,
            title: video.title,
            videoUrl: video.videoUrl,
            fileName: video.fileName,
            fileSize: video.fileSize,
            grade: video.grade,
            chapter: video.chapter,
            storageType: video.storageType,
            isPublished: video.isPublished,
            createdAt: video.createdAt
          }
        }
      });

    } catch (error) {
      console.error('❌ Mega.nz upload error:', error);
      
      // Clean up local file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🧹 Cleaned up local file after error');
      }
      
      next(new AppError(`فشل في رفع الفيديو إلى Mega.nz: ${error.message}`, StatusCodes.INTERNAL_SERVER_ERROR));
    }
  })
);

// ✅ DELETE VIDEO
router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بحذف الفيديوهات', StatusCodes.FORBIDDEN));
  }

  const video = await Video.findById(req.params.id);
  
  if (!video) {
    return next(new AppError('الفيديو غير موجود', StatusCodes.NOT_FOUND));
  }

  // TODO: Add logic to delete from Mega.nz if needed
  
  await Video.findByIdAndDelete(req.params.id);

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم حذف الفيديو بنجاح'
  });
}));

// ✅ UPDATE VIDEO
router.patch('/:id', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتعديل الفيديوهات', StatusCodes.FORBIDDEN));
  }

  const { title, description, grade, chapter, tags, isPublished } = req.body;
  
  const video = await Video.findByIdAndUpdate(
    req.params.id,
    {
      ...(title && { title: title.trim() }),
      ...(description && { description: description.trim() }),
      ...(grade && { grade }),
      ...(chapter && { chapter }),
      ...(tags && { tags: tags.split(',').map(tag => tag.trim()) }),
      ...(isPublished !== undefined && { isPublished })
    },
    { new: true, runValidators: true }
  );

  if (!video) {
    return next(new AppError('الفيديو غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تحديث الفيديو بنجاح',
    data: { video }
  });
}));
// ✅ Increment view count
router.post('/:id/view', protect, asyncHandler(async (req, res, next) => {
  const video = await Video.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  );

  if (!video) {
    return next(new AppError('الفيديو غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تحديث عدد المشاهدات',
    data: { views: video.views }
  });
}));

// ✅ Like/Unlike video
router.post('/:id/like', protect, asyncHandler(async (req, res, next) => {
  const video = await Video.findById(req.params.id);
  
  if (!video) {
    return next(new AppError('الفيديو غير موجود', StatusCodes.NOT_FOUND));
  }

  const hasLiked = video.likes.includes(req.user._id);
  
  if (hasLiked) {
    // Unlike
    video.likes = video.likes.filter(like => like.toString() !== req.user._id.toString());
  } else {
    // Like
    video.likes.push(req.user._id);
  }

  await video.save();

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: hasLiked ? 'تم إزالة الإعجاب' : 'تم إضافة الإعجاب',
    data: { 
      likes: video.likes,
      likesCount: video.likes.length 
    }
  });
}));

// ✅ Track video downloads
router.post('/:id/download', protect, asyncHandler(async (req, res, next) => {
  const video = await Video.findByIdAndUpdate(
    req.params.id,
    { $inc: { downloads: 1 } },
    { new: true }
  );

  if (!video) {
    return next(new AppError('الفيديو غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تسجيل التحميل',
    data: { downloads: video.downloads || 0 }
  });
}));
export default router;