import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

import { StatusCodes } from 'http-status-codes';
import cloudinary from './cloudinary.js';
import AppError from './AppError.js';

// ✅ Video Upload Configuration
export const createVideoUpload = () => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'learning-platform/videos',
      resource_type: 'video',
      chunk_size: 10000000, // 10MB chunks for better upload
      timeout: 1800000, // 30 minutes timeout
      format: async (req, file) => {
        const ext = file.originalname.split('.').pop();
        return ext || 'mp4';
      },
      public_id: (req, file) => {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        return `video-${timestamp}-${random}`;
      }
    },
  });

  const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new AppError('يسمح برفع ملفات الفيديو فقط', StatusCodes.BAD_REQUEST), false);
      }
    },
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB
    }
  });

  return upload;
};

// ✅ Avatar Upload Configuration
export const createAvatarUpload = () => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'education-platform/avatars',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
      transformation: [{ width: 500, height: 500, crop: 'limit' }],
    },
  });

  return multer({ 
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    }
  });
};

// ✅ Homework Upload Configuration
export const createHomeworkUpload = () => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const extension = file.originalname.split('.').pop().toLowerCase();
      const isRawFile = ['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx'].includes(extension);
      
      return {
        folder: 'education-platform/homework',
        allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'png', 'jpeg', 'txt'],
        resource_type: isRawFile ? 'raw' : 'image',
      };
    }
  });

  return multer({ 
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5
    }
  });
};

// ✅ Content Upload Configuration
export const createContentUpload = () => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'education-platform/content',
      resource_type: 'auto',
      allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'txt'],
      use_filename: true,
      unique_filename: true,
    },
  });

  return multer({ 
    storage,
    limits: {
      fileSize: 15 * 1024 * 1024, // 15MB
      files: 5
    }
  });
};

// Handle upload errors gracefully
export const handleUploadError = (error, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return next(new AppError('حجم الملف كبير جداً', StatusCodes.BAD_REQUEST));
  }
  if (error.message.includes('timeout')) {
    return next(new AppError('انتهت مدة الرفع. يرجى المحاولة مرة أخرى', StatusCodes.REQUEST_TIMEOUT));
  }
  next(error);
};