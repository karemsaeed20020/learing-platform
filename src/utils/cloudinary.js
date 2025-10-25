import { v2 as cloudinary } from "cloudinary";
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary once
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 1800000, // 30 minutes timeout
});

// إعدادات إضافية لتمكين الوصول العام للملفات
export const getPublicUrl = (publicId, resourceType = 'raw') => {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'upload',
    flags: 'attachment'
  });
};

export default cloudinary;