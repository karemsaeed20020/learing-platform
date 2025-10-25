// import express from 'express';
// import Homework from '../../../DB/models/Homework.model.js';
// import { protect } from '../../middlewares/auth.middleware.js';
// import AppError from "../../utils/AppError.js";
// import { asyncHandler } from "../../utils/asyncHandler.js";
// import { StatusCodes } from 'http-status-codes';
// import { homeworkUpload } from '../../middlewares/multer.middleware.js';
// import cloudinary from '../../utils/cloudinary.js';

// const router = express.Router();

// // Get all homeworks for student (حسب الصف)
// router.get('/student', protect, asyncHandler(async (req, res, next) => {
//   const homeworks = await Homework.find({ 
//     grade: req.user.grade,
//     status: 'active'
//   })
//     .populate('teacher', 'username email')
//     .sort({ createdAt: -1 });

//   res.status(StatusCodes.OK).json({
//     status: 'success',
//     results: homeworks.length,
//     data: { homeworks }
//   });
// }));

// // Get all homeworks for teacher
// router.get('/teacher', protect, asyncHandler(async (req, res, next) => {
//   if (!['teacher', 'admin'].includes(req.user.role)) {
//     return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
//   }

//   const homeworks = await Homework.find({ teacher: req.user._id })
//     .sort({ createdAt: -1 });

//   res.status(StatusCodes.OK).json({
//     status: 'success',
//     results: homeworks.length,
//     data: { homeworks }
//   });
// }));

// // Create new homework (Teacher/Admin only) - بدون طالب
// router.post('/', protect, homeworkUpload.array('files', 5), asyncHandler(async (req, res, next) => {
//   if (!['teacher', 'admin'].includes(req.user.role)) {
//     return next(new AppError('غير مصرح لك بإنشاء واجبات', StatusCodes.FORBIDDEN));
//   }

//   const { title, description, grade, dueDate, textContent } = req.body;

//   const homework = await Homework.create({
//     title,
//     description,
//     teacher: req.user._id,
//     grade,
//     dueDate,
//     subject: 'اللغة العربية',
//     'content.text': textContent,
//     type: textContent ? 'text' : 'file'
//   });

//   // Handle file uploads
//   if (req.files && req.files.length > 0) {
//     homework.content.files = req.files.map(file => ({
//       filename: file.filename,
//       originalName: file.originalname,
//       path: file.path,
//       size: file.size,
//       mimetype: file.mimetype
//     }));
//     homework.type = textContent ? 'mixed' : 'file';
//     await homework.save();
//   }

//   res.status(StatusCodes.CREATED).json({
//     status: 'success',
//     data: { homework }
//   });
// }));

// // Update homework (Teacher/Admin only)
// // في ملف API route الخاص بك
// router.put('/:id', protect, asyncHandler(async (req, res, next) => {
//   if (!['teacher', 'admin'].includes(req.user.role)) {
//     return next(new AppError('غير مصرح لك بتعديل الواجبات', StatusCodes.FORBIDDEN));
//   }

//   const { title, description, grade, dueDate, textContent, status } = req.body;

//   const homework = await Homework.findOneAndUpdate(
//     {
//       _id: req.params.id,
//       teacher: req.user._id
//     },
//     {
//       title,
//       description,
//       grade,
//       dueDate,
//       'content.text': textContent,
//       status: status || 'active'
//     },
//     { new: true, runValidators: true }
//   );

//   if (!homework) {
//     return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
//   }

//   res.status(StatusCodes.OK).json({
//     status: 'success',
//     message: 'تم تحديث الواجب بنجاح',
//     data: { homework }
//   });
// }));

// // Get single homework
// router.get('/:id', protect, asyncHandler(async (req, res, next) => {
//   const homework = await Homework.findById(req.params.id)
//     .populate('teacher', 'username email');

//   if (!homework) {
//     return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
//   }

//   // Check if user has access to this homework
//   const isOwner = homework.teacher._id.toString() === req.user._id.toString() ||
//                   req.user.role === 'admin' ||
//                   (req.user.role === 'student' && homework.grade === req.user.grade);

//   if (!isOwner) {
//     return next(new AppError('غير مصرح لك بالوصول إلى هذا الواجب', StatusCodes.FORBIDDEN));
//   }

//   res.status(StatusCodes.OK).json({
//     status: 'success',
//     data: { homework }
//   });
// }));

// // Delete homework (Teacher/Admin only)
// router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
//   if (!['teacher', 'admin'].includes(req.user.role)) {
//     return next(new AppError('غير مصرح لك بحذف الواجبات', StatusCodes.FORBIDDEN));
//   }

//   const homework = await Homework.findOneAndDelete({
//     _id: req.params.id,
//     teacher: req.user._id
//   });

//   if (!homework) {
//     return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
//   }

//   res.status(StatusCodes.OK).json({
//     status: 'success',
//     message: 'تم حذف الواجب بنجاح'
//   });
// }));

// /// Add this route to your homework router
// // In your homework router file
// // In your homework router
// // Single download route - ADD THIS AND REMOVE THE OTHER TWO
// // Add this route to your homework router
// // Replace the existing download route with this fixed version

// router.get('/:id/download/:fileIndex', protect, asyncHandler(async (req, res, next) => {
//   const homework = await Homework.findById(req.params.id);

//   if (!homework) {
//     return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
//   }

//   // Check permissions
//   const hasAccess = req.user.role === 'admin' || 
//                    homework.teacher.toString() === req.user._id.toString() ||
//                    (req.user.role === 'student' && homework.grade === req.user.grade);
  
//   if (!hasAccess) {
//     return next(new AppError('غير مصرح لك بالوصول إلى هذا الملف', StatusCodes.FORBIDDEN));
//   }

//   const fileIndex = parseInt(req.params.fileIndex);
//   if (fileIndex < 0 || fileIndex >= homework.content.files.length) {
//     return next(new AppError('الملف غير موجود', StatusCodes.NOT_FOUND));
//   }

//   const file = homework.content.files[fileIndex];
  
//   console.log('File details:', {
//     path: file.path,
//     mimetype: file.mimetype,
//     originalName: file.originalName
//   });

//   // Handle Cloudinary files
//   if (file.path.includes('cloudinary.com')) {
//     try {
//       // Extract public_id from Cloudinary URL
//       // URL format: https://res.cloudinary.com/CLOUD_NAME/RESOURCE_TYPE/upload/v1234567890/folder/filename.ext
//       const url = new URL(file.path);
//       const pathParts = url.pathname.split('/');
      
//       // Find the 'upload' index
//       const uploadIndex = pathParts.indexOf('upload');
      
//       if (uploadIndex === -1) {
//         throw new Error('Invalid Cloudinary URL format');
//       }
      
//       // Get everything after upload/vXXXXXXXXXX/
//       // Skip the version number (vXXXXXXXXXX)
//       const publicIdWithExtension = pathParts.slice(uploadIndex + 2).join('/');
      
//       // Remove the file extension to get the public_id
//       const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, '');
      
//       console.log('Extracted public_id:', publicId);
      
//       // Determine resource_type based on file extension
//       const extension = file.originalName.split('.').pop().toLowerCase();
//       const rawExtensions = ['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'rar'];
//       const resourceType = rawExtensions.includes(extension) ? 'raw' : 'image';
      
//       console.log('Resource type:', resourceType, 'Extension:', extension);
      
//       // Generate download URL using Cloudinary SDK
//       const downloadUrl = cloudinary.url(publicId, {
//         resource_type: resourceType,
//         secure: true,
//         flags: 'attachment',
//         attachment: file.originalName.replace(/\.[^/.]+$/, '') // Filename without extension
//       });
      
//       console.log('Generated download URL:', downloadUrl);
      
//       // Redirect to the download URL
//       return res.redirect(downloadUrl);
      
//     } catch (error) {
//       console.error('Cloudinary URL parsing error:', error);
      
//       // Fallback: Try direct URL with attachment flag
//       try {
//         const directUrl = file.path.replace('/upload/', '/upload/fl_attachment/');
//         console.log('Fallback URL:', directUrl);
//         return res.redirect(directUrl);
//       } catch (fallbackError) {
//         return next(new AppError('فشل في إنشاء رابط التحميل', StatusCodes.INTERNAL_SERVER_ERROR));
//       }
//     }
//   }
  
//   // Handle local files (if any)
//   if (file.path.startsWith('uploads/') || file.path.includes('uploads\\')) {
//     const filePath = path.resolve(file.path);
    
//     if (!fs.existsSync(filePath)) {
//       return next(new AppError('الملف غير موجود على الخادم', StatusCodes.NOT_FOUND));
//     }

//     res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
//     res.setHeader('Content-Type', file.mimetype);
    
//     return res.sendFile(filePath);
//   }
  
//   return next(new AppError('نوع الملف غير معروف', StatusCodes.BAD_REQUEST));
// }));

// // Alternative: Server-side proxy download (more reliable for PDFs)
// router.get('/:id/proxy-download/:fileIndex', protect, asyncHandler(async (req, res, next) => {
//   const homework = await Homework.findById(req.params.id);

//   if (!homework) {
//     return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
//   }

//   const hasAccess = req.user.role === 'admin' || 
//                    homework.teacher.toString() === req.user._id.toString() ||
//                    (req.user.role === 'student' && homework.grade === req.user.grade);
  
//   if (!hasAccess) {
//     return next(new AppError('غير مصرح لك بالوصول إلى هذا الملف', StatusCodes.FORBIDDEN));
//   }

//   const fileIndex = parseInt(req.params.fileIndex);
//   if (fileIndex < 0 || fileIndex >= homework.content.files.length) {
//     return next(new AppError('الملف غير موجود', StatusCodes.NOT_FOUND));
//   }

//   const file = homework.content.files[fileIndex];
  
//   if (!file.path.includes('cloudinary.com')) {
//     return next(new AppError('هذه الطريقة تدعم فقط ملفات Cloudinary', StatusCodes.BAD_REQUEST));
//   }

//   try {
//     // Fetch the file from Cloudinary
//     const fetch = (await import('node-fetch')).default;
//     const response = await fetch(file.path);
    
//     if (!response.ok) {
//       throw new Error('Failed to fetch file from Cloudinary');
//     }

//     // Set proper headers for download
//     res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
//     res.setHeader('Content-Type', file.mimetype);
//     res.setHeader('Content-Length', response.headers.get('content-length'));

//     // Stream the file to the client
//     response.body.pipe(res);
    
//   } catch (error) {
//     console.error('Proxy download error:', error);
//     return next(new AppError('فشل في تحميل الملف', StatusCodes.INTERNAL_SERVER_ERROR));
//   }
// }));


// export default router;

import express from 'express';
import Homework from '../../../DB/models/Homework.model.js';
import { protect } from '../../middlewares/auth.middleware.js';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';
import { homeworkUpload } from '../../middlewares/multer.middleware.js';
import cloudinary from '../../utils/cloudinary.js';
import https from 'https';
import http from 'http';

const router = express.Router();

// Get all homeworks for student (حسب الصف)
router.get('/student', protect, asyncHandler(async (req, res, next) => {
  const homeworks = await Homework.find({ 
    grade: req.user.grade,
    status: 'active'
  })
    .populate('teacher', 'username email')
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: homeworks.length,
    data: { homeworks }
  });
}));

// Get all homeworks for teacher
router.get('/teacher', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const homeworks = await Homework.find({ teacher: req.user._id })
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: homeworks.length,
    data: { homeworks }
  });
}));

router.get('/:id/download/:fileIndex', protect, asyncHandler(async (req, res, next) => {
  const homework = await Homework.findById(req.params.id);

  if (!homework) {
    return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
  }

  const hasAccess = req.user.role === 'admin' || 
                   homework.teacher.toString() === req.user._id.toString() ||
                   (req.user.role === 'student' && homework.grade === req.user.grade);
  
  if (!hasAccess) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذا الملف', StatusCodes.FORBIDDEN));
  }

  const fileIndex = parseInt(req.params.fileIndex);
  if (fileIndex < 0 || fileIndex >= homework.content.files.length) {
    return next(new AppError('الملف غير موجود', StatusCodes.NOT_FOUND));
  }

  const file = homework.content.files[fileIndex];
  
  // استخدم proxy - حمل من Cloudinary وأرسل للمستخدم
  try {
    const protocol = file.path.startsWith('https') ? https : http;
    
    protocol.get(file.path, (cloudinaryRes) => {
      if (cloudinaryRes.statusCode !== 200) {
        return next(new AppError('فشل في تحميل الملف', StatusCodes.INTERNAL_SERVER_ERROR));
      }

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.setHeader('Content-Type', file.mimetype);
      
      cloudinaryRes.pipe(res);
      
    }).on('error', (error) => {
      console.error('Download error:', error);
      return next(new AppError('فشل في تحميل الملف', StatusCodes.INTERNAL_SERVER_ERROR));
    });
    
  } catch (error) {
    console.error('Download error:', error);
    return next(new AppError('فشل في تحميل الملف', StatusCodes.INTERNAL_SERVER_ERROR));
  }
}));
// Create new homework (Teacher/Admin only)
router.post('/', protect, homeworkUpload.array('files', 5), asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بإنشاء واجبات', StatusCodes.FORBIDDEN));
  }

  const { title, description, grade, dueDate, textContent } = req.body;

  const homework = await Homework.create({
    title,
    description,
    teacher: req.user._id,
    grade,
    dueDate,
    subject: 'اللغة العربية',
    'content.text': textContent,
    type: textContent ? 'text' : 'file'
  });

  // Handle file uploads
  if (req.files && req.files.length > 0) {
    homework.content.files = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    }));
    homework.type = textContent ? 'mixed' : 'file';
    await homework.save();
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: { homework }
  });
}));

// Update homework (Teacher/Admin only)
router.put('/:id', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بتعديل الواجبات', StatusCodes.FORBIDDEN));
  }

  const { title, description, grade, dueDate, textContent, status } = req.body;

  const homework = await Homework.findOneAndUpdate(
    {
      _id: req.params.id,
      teacher: req.user._id
    },
    {
      title,
      description,
      grade,
      dueDate,
      'content.text': textContent,
      status: status || 'active'
    },
    { new: true, runValidators: true }
  );

  if (!homework) {
    return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تحديث الواجب بنجاح',
    data: { homework }
  });
}));

// Get single homework
router.get('/:id', protect, asyncHandler(async (req, res, next) => {
  const homework = await Homework.findById(req.params.id)
    .populate('teacher', 'username email');

  if (!homework) {
    return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
  }

  // Check if user has access to this homework
  const isOwner = homework.teacher._id.toString() === req.user._id.toString() ||
                  req.user.role === 'admin' ||
                  (req.user.role === 'student' && homework.grade === req.user.grade);

  if (!isOwner) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذا الواجب', StatusCodes.FORBIDDEN));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { homework }
  });
}));

// Delete homework (Teacher/Admin only)
router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بحذف الواجبات', StatusCodes.FORBIDDEN));
  }

  const homework = await Homework.findOneAndDelete({
    _id: req.params.id,
    teacher: req.user._id
  });

  if (!homework) {
    return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم حذف الواجب بنجاح'
  });
}));

// Get homework files list
router.get('/:id/files', protect, asyncHandler(async (req, res, next) => {
  const homework = await Homework.findById(req.params.id);

  if (!homework) {
    return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { files: homework.content.files }
  });
}));

// ============================================
// DOWNLOAD ROUTES - ADD THESE
// ============================================

// Simple direct download with Cloudinary redirect
router.get('/:id/direct-download/:fileIndex', protect, asyncHandler(async (req, res, next) => {
  const homework = await Homework.findById(req.params.id);

  if (!homework) {
    return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
  }

  const hasAccess = req.user.role === 'admin' || 
                   homework.teacher.toString() === req.user._id.toString() ||
                   (req.user.role === 'student' && homework.grade === req.user.grade);
  
  if (!hasAccess) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذا الملف', StatusCodes.FORBIDDEN));
  }

  const fileIndex = parseInt(req.params.fileIndex);
  if (fileIndex < 0 || fileIndex >= homework.content.files.length) {
    return next(new AppError('الملف غير موجود', StatusCodes.NOT_FOUND));
  }

  const file = homework.content.files[fileIndex];
  
  console.log('File path:', file.path);
  
  if (!file.path.includes('cloudinary.com')) {
    return next(new AppError('هذه الطريقة تدعم فقط ملفات Cloudinary', StatusCodes.BAD_REQUEST));
  }

  // Simply add fl_attachment flag to force download
  let downloadUrl = file.path;
  if (downloadUrl.includes('/upload/')) {
    downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
  }
  
  console.log('Redirecting to:', downloadUrl);
  return res.redirect(downloadUrl);
}));

// Server-side proxy download
router.get('/:id/proxy-download/:fileIndex', protect, asyncHandler(async (req, res, next) => {
  const homework = await Homework.findById(req.params.id);

  if (!homework) {
    return next(new AppError('الواجب غير موجود', StatusCodes.NOT_FOUND));
  }

  const hasAccess = req.user.role === 'admin' || 
                   homework.teacher.toString() === req.user._id.toString() ||
                   (req.user.role === 'student' && homework.grade === req.user.grade);
  
  if (!hasAccess) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذا الملف', StatusCodes.FORBIDDEN));
  }

  const fileIndex = parseInt(req.params.fileIndex);
  if (fileIndex < 0 || fileIndex >= homework.content.files.length) {
    return next(new AppError('الملف غير موجود', StatusCodes.NOT_FOUND));
  }

  const file = homework.content.files[fileIndex];
  
  if (!file.path.includes('cloudinary.com')) {
    return next(new AppError('هذه الطريقة تدعم فقط ملفات Cloudinary', StatusCodes.BAD_REQUEST));
  }

  try {
    const url = new URL(file.path);
    const protocol = url.protocol === 'https:' ? https : http;

    // Set response headers
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', file.mimetype);

    // Make request and pipe to response
    protocol.get(file.path, (cloudinaryResponse) => {
      if (cloudinaryResponse.statusCode !== 200) {
        console.error('Cloudinary response status:', cloudinaryResponse.statusCode);
        return next(new AppError('فشل في تحميل الملف من Cloudinary', StatusCodes.INTERNAL_SERVER_ERROR));
      }

      if (cloudinaryResponse.headers['content-length']) {
        res.setHeader('Content-Length', cloudinaryResponse.headers['content-length']);
      }

      cloudinaryResponse.pipe(res);
      
    }).on('error', (error) => {
      console.error('Cloudinary fetch error:', error);
      if (!res.headersSent) {
        return next(new AppError('فشل في الاتصال بـ Cloudinary', StatusCodes.INTERNAL_SERVER_ERROR));
      }
    });
    
  } catch (error) {
    console.error('Proxy download error:', error);
    return next(new AppError('فشل في تحميل الملف', StatusCodes.INTERNAL_SERVER_ERROR));
  }
}));

export default router;