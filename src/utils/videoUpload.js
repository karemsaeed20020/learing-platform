import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AppError from "./AppError.js";
import { StatusCodes } from 'http-status-codes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/videos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadsDir);
}

// Configure multer for local storage (temporary)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + extension);
  }
});

export const localVideoUpload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const videoMimeTypes = [
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
      'video/x-ms-wmv', 'video/webm', 'video/3gpp', 'video/mp2t',
      'video/avi', 'video/mov', 'video/wmv', 'video/flv'
    ];
    
    if (file.mimetype.startsWith('video/') || videoMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`نوع الملف غير مدعوم. يسمح برفع ملفات الفيديو فقط. النوع الحالي: ${file.mimetype}`, StatusCodes.BAD_REQUEST), false);
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit for local storage
  }
});

export default localVideoUpload;