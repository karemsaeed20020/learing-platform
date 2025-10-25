import { fileURLToPath } from 'url';
import { errorResponseHandler } from './middlewares/errorHandler.middleware.js';
import authRoutes from './modules/Auth/auth.router.js';
import userRoutes from './modules/User/user.router.js';
import contactRoutes from './modules/Contact/contact.router.js';
import attendanceRoutes from './modules/Attendance/attendance.router.js';
import dailyGradesRoutes from './modules/DailyGrade/dailyGrades.router.js';
import homeworkRoutes from './modules/Homework/Homework.router.js';
import educationalContentRoutes from './modules/EducationalContent/educationalContent.router.js';
import notificationRoutes from './modules/Notification/notification.router.js';
import videoRoutes from './modules/Video/video.router.js';
import examRoutes from './modules/Exams/exam.router.js';
import chatRoutes from './modules/Chat/chat.router.js';
import adminParentRoutes from './modules/Auth/adminParentRoutes.js';
import parentRoutes from './modules/Parent/parentRoutes.js';
import courseRoutes from './modules/Course/course.router.js';
import cartRoutes from './modules/Cart/cart.router.js';
import reviewRoutes from './modules/Review/review.router.js';
import checkoutRoutes from './modules/Checkout/checkout.router.js';
import adminRoutes from './modules/Auth/admin.router.js';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';

// Export asyncHandler function
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      next(err);
    });
  };
};

// ✅ Remove io parameter
const appRouter = (app, express) => {
  // Middlewares
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());
  
  // ✅ Update CORS for production
  app.use(cors({
    origin: [
      "http://localhost:3000",
      "https://your-frontend-app.vercel.app" // Replace with your actual frontend URL
    ],
    credentials: true,
  }));

  // CORS headers
  app.use((req, res, next) => {
    const allowedOrigins = [
      "http://localhost:3000", 
      "https://your-frontend-app.vercel.app" // Replace with your actual frontend URL
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    next();
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Serve static uploads folder
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  // ✅ Remove Socket.io middleware since it won't work on Vercel

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/contact", contactRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/daily-grades', dailyGradesRoutes);
  app.use('/api/homework', homeworkRoutes);
  app.use('/api/educational-content', educationalContentRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/videos', videoRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/admin', adminParentRoutes);
  app.use('/api/parent', parentRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/checkout', checkoutRoutes);
  app.use('/api/admin', adminRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Global Error Handler 
  app.use(errorResponseHandler);
};

export default appRouter;