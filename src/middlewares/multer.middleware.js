import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../utils/cloudinary.js";

// Storage configuration for avatars (النسخة الأصلية)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: process.env.FOLDER_CLOUD_NAME || "Education-Platform",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
});

// Storage configuration for homework files (محدث)
// Storage configuration for homework files (محدث)
const homeworkStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine resource type based on file extension
    const extension = file.originalname.split('.').pop().toLowerCase();
    const isRawFile = ['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx'].includes(extension);
    
    return {
      folder: process.env.FOLDER_CLOUD_NAME || "Education-Platform/homework",
      allowed_formats: ["pdf", "doc", "docx", "jpg", "png", "jpeg", "txt"],
      resource_type: isRawFile ? "raw" : "image",
      access_mode: "public"
    };
  }
});

// Storage configuration for educational content (محدث)
const contentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: process.env.FOLDER_CLOUD_NAME || "Education-Platform/content",
    resource_type: 'auto',
    allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'txt'],
    use_filename: true,
    unique_filename: true,
    access_mode: "public", // ✅ Make these public too
  },
});

const upload = multer({ storage });
const homeworkUpload = multer({ 
  storage: homeworkStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5
  }
});
const contentUpload = multer({ 
  storage: contentStorage,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 5
  }
});

export default upload;
export { homeworkUpload, contentUpload };