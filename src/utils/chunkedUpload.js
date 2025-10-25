import cloudinary from './cloudinary.js';
import AppError from "./AppError.js";
import { StatusCodes } from 'http-status-codes';

export const chunkedVideoUpload = async (fileBuffer, originalName, folder = 'education-platform/videos') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        chunk_size: 60000000, // 60MB chunks
        folder: folder,
        public_id: `video-${Date.now()}-${Math.round(Math.random() * 1E9)}`,
        timeout: 1800000, // 30 minutes
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(new AppError(`فشل في رفع الفيديو: ${error.message}`, StatusCodes.BAD_REQUEST));
        } else {
          console.log('✅ Video uploaded successfully:', result.public_id);
          resolve(result);
        }
      }
    );

    // Upload the file buffer
    uploadStream.end(fileBuffer);
  });
};