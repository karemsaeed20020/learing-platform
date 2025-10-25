import express from 'express';
// import { protect, restrictTo } from '../middlewares/auth.middleware.js';
// import User from '../../DB/models/user.model.js';
// import Course from '../../DB/models/Course.model.js';
// import Order from '../../DB/models/Order.model.js';
// import { asyncHandler } from "../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';
import asyncHandler from '../../utils/asyncHandler.js';
import User from '../../../DB/models/user.model.js';
import Course from '../../../DB/models/Course.model.js';
import Order from '../../../DB/models/Order.model.js';
import Exam from '../../../DB/models/Exam.model.js';
import ExamResult from '../../../DB/models/ExamResult.model.js';
import Attendance from '../../../DB/models/attendance.model.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

// إحصائيات Dashboard الشاملة
router.get('/dashboard/stats', asyncHandler(async (req, res) => {
  // إحصائيات المستخدمين
  const totalStudents = await User.countDocuments({ role: 'student' });
  const totalTeachers = await User.countDocuments({ role: 'teacher' });
  
  // الطلاب النشطين (دخلوا خلال آخر 30 يوم)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activeStudents = await User.countDocuments({ 
    role: 'student', 
    lastLogin: { $gte: thirtyDaysAgo } 
  });

  // إحصائيات الكورسات والطلبات
  const totalCourses = await Course.countDocuments({ isPublished: true });
  const totalOrders = await Order.countDocuments({ status: 'completed' });

  // إحصائيات الإيرادات
  const revenueResult = await Order.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

  // إحصائيات الحضور
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayAttendance = await Attendance.aggregate([
    { $match: { date: { $gte: today } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const presentToday = todayAttendance.find(a => a._id === 'present')?.count || 0;
  const absentToday = todayAttendance.find(a => a._id === 'absent')?.count || 0;
  const totalTodayAttendance = todayAttendance.reduce((sum, a) => sum + a.count, 0);
  
  const attendanceRateToday = totalTodayAttendance > 0 ? 
    Math.round((presentToday / totalTodayAttendance) * 100) : 0;

  // إحصائيات الامتحانات
  const totalExams = await Exam.countDocuments({ isPublished: true });
  const totalExamResults = await ExamResult.countDocuments();
  
  const examStats = await ExamResult.aggregate([
    {
      $group: {
        _id: null,
        averageScore: { $avg: '$percentage' },
        totalAttempts: { $sum: 1 },
        bestScore: { $max: '$percentage' }
      }
    }
  ]);

  const averageExamScore = examStats.length > 0 ? Math.round(examStats[0].averageScore) : 0;
  const totalExamAttempts = examStats.length > 0 ? examStats[0].totalAttempts : 0;
  const bestExamScore = examStats.length > 0 ? Math.round(examStats[0].bestScore) : 0;

  // طلاب جدد هذا الشهر
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const newStudentsThisMonth = await User.countDocuments({
    role: 'student',
    createdAt: { $gte: startOfMonth }
  });

  // نسبة النمو
  const startOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const endOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
  
  const lastMonthStudents = await User.countDocuments({
    role: 'student',
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
  });

  const growthRate = lastMonthStudents > 0 ? 
    Math.round(((newStudentsThisMonth - lastMonthStudents) / lastMonthStudents) * 100) : 100;

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      // إحصائيات المستخدمين
      totalStudents,
      activeStudents,
      totalTeachers,
      newStudentsThisMonth,
      growthRate,
      
      // إحصائيات المحتوى
      totalCourses,
      totalOrders,
      totalRevenue,
      
      // إحصائيات الحضور
      presentToday,
      absentToday,
      attendanceRateToday,
      totalTodayAttendance,
      
      // إحصائيات الامتحانات
      totalExams,
      totalExamAttempts,
      averageExamScore,
      bestExamScore,
      
      // إحصائيات عامة
      averageScore: averageExamScore,
      attendanceRate: attendanceRateToday
    }
  });
}));

// إحصائيات الحضور التفصيلية
router.get('/dashboard/attendance-stats', asyncHandler(async (req, res) => {
  const { period = 'week' } = req.query; // week, month, year
  
  let startDate;
  const endDate = new Date();
  
  switch (period) {
    case 'week':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(new Date().getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  // إحصائيات الحضور حسب التاريخ
  const attendanceByDate = await Attendance.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          status: "$status"
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: "$_id.date",
        present: {
          $sum: {
            $cond: [{ $eq: ["$_id.status", "present"] }, "$count", 0]
          }
        },
        absent: {
          $sum: {
            $cond: [{ $eq: ["$_id.status", "absent"] }, "$count", 0]
          }
        },
        total: { $sum: "$count" }
      }
    },
    {
      $project: {
        date: "$_id",
        present: 1,
        absent: 1,
        total: 1,
        attendanceRate: {
          $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 2]
        }
      }
    },
    { $sort: { date: 1 } }
  ]);

  // إحصائيات الحضور حسب الصف
  const attendanceByGrade = await Attendance.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$grade",
        present: {
          $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
        },
        total: { $sum: 1 },
        attendanceRate: {
          $avg: { $cond: [{ $eq: ["$status", "present"] }, 100, 0] }
        }
      }
    },
    {
      $project: {
        grade: "$_id",
        present: 1,
        total: 1,
        attendanceRate: { $round: ["$attendanceRate", 2] }
      }
    }
  ]);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      period,
      attendanceByDate,
      attendanceByGrade,
      summary: {
        totalRecords: attendanceByDate.reduce((sum, day) => sum + day.total, 0),
        averageAttendanceRate: attendanceByDate.length > 0 ? 
          Math.round(attendanceByDate.reduce((sum, day) => sum + day.attendanceRate, 0) / attendanceByDate.length) : 0,
        bestDay: attendanceByDate.length > 0 ? 
          attendanceByDate.reduce((best, day) => day.attendanceRate > best.attendanceRate ? day : best) : null
      }
    }
  });
}));

// إحصائيات الامتحانات التفصيلية
router.get('/dashboard/exam-stats', asyncHandler(async (req, res) => {
  // إحصائيات عامة عن الامتحانات
  const examStats = await Exam.aggregate([
    {
      $group: {
        _id: '$examType',
        count: { $sum: 1 },
        totalMarks: { $sum: '$totalMarks' }
      }
    }
  ]);

  // أداء الطلاب في الامتحانات
  const studentPerformance = await ExamResult.aggregate([
    {
      $lookup: {
        from: 'exams',
        localField: 'exam',
        foreignField: '_id',
        as: 'examData'
      }
    },
    {
      $unwind: '$examData'
    },
    {
      $group: {
        _id: '$examData.category',
        averageScore: { $avg: '$percentage' },
        totalAttempts: { $sum: 1 },
        bestScore: { $max: '$percentage' },
        lowestScore: { $min: '$percentage' }
      }
    },
    {
      $project: {
        category: '$_id',
        averageScore: { $round: ['$averageScore', 2] },
        totalAttempts: 1,
        bestScore: { $round: ['$bestScore', 2] },
        lowestScore: { $round: ['$lowestScore', 2] }
      }
    }
  ]);

  // أفضل الطلاب أداءً
  const topStudents = await ExamResult.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'student',
        foreignField: '_id',
        as: 'studentData'
      }
    },
    {
      $unwind: '$studentData'
    },
    {
      $group: {
        _id: '$student',
        studentName: { $first: '$studentData.username' },
        averageScore: { $avg: '$percentage' },
        totalExams: { $sum: 1 },
        bestScore: { $max: '$percentage' }
      }
    },
    {
      $match: {
        totalExams: { $gte: 2 } // على الأقل امتحانين
      }
    },
    {
      $sort: { averageScore: -1 }
    },
    {
      $limit: 10
    },
    {
      $project: {
        studentName: 1,
        averageScore: { $round: ['$averageScore', 2] },
        totalExams: 1,
        bestScore: { $round: ['$bestScore', 2] }
      }
    }
  ]);

  // توزيع الدرجات
  const scoreDistribution = await ExamResult.aggregate([
    {
      $bucket: {
        groupBy: "$percentage",
        boundaries: [0, 50, 65, 75, 85, 95, 101],
        default: "other",
        output: {
          count: { $sum: 1 },
          minScore: { $min: "$percentage" },
          maxScore: { $max: "$percentage" }
        }
      }
    },
    {
      $project: {
        range: {
          $switch: {
            branches: [
              { case: { $lt: ["$_id", 50] }, then: "ضعيف (أقل من 50%)" },
              { case: { $lt: ["$_id", 65] }, then: "مقبول (50-64%)" },
              { case: { $lt: ["$_id", 75] }, then: "جيد (65-74%)" },
              { case: { $lt: ["$_id", 85] }, then: "جيد جداً (75-84%)" },
              { case: { $lt: ["$_id", 95] }, then: "ممتاز (85-94%)" },
              { case: { $gte: ["$_id", 95] }, then: "متفوق (95-100%)" }
            ],
            default: "غير محدد"
          }
        },
        count: 1,
        percentage: {
          $round: [
            {
              $multiply: [
                { $divide: ["$count", await ExamResult.countDocuments()] },
                100
              ]
            },
            2
          ]
        }
      }
    }
  ]);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      examStats,
      studentPerformance,
      topStudents,
      scoreDistribution,
      summary: {
        totalExams: await Exam.countDocuments({ isPublished: true }),
        totalAttempts: await ExamResult.countDocuments(),
        overallAverage: studentPerformance.length > 0 ? 
          Math.round(studentPerformance.reduce((sum, perf) => sum + perf.averageScore, 0) / studentPerformance.length) : 0
      }
    }
  });
}));

// الأنشطة الحديثة (محدث)
router.get('/dashboard/activities', asyncHandler(async (req, res) => {
  // أنشطة تسجيل الدخول
  const loginActivities = await User.aggregate([
    { 
      $match: { 
        lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      } 
    },
    { $sort: { lastLogin: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 1,
        type: 'login',
        message: { $concat: ['قام ', '$username', ' بتسجيل الدخول'] },
        time: '$lastLogin',
        user: '$username',
        role: '$role'
      }
    }
  ]);

  // أنشطة الامتحانات
  const examActivities = await ExamResult.aggregate([
    {
      $match: {
        submittedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'student',
        foreignField: '_id',
        as: 'studentData'
      }
    },
    {
      $lookup: {
        from: 'exams',
        localField: 'exam',
        foreignField: '_id',
        as: 'examData'
      }
    },
    {
      $unwind: '$studentData'
    },
    {
      $unwind: '$examData'
    },
    {
      $sort: { submittedAt: -1 }
    },
    {
      $limit: 5
    },
    {
      $project: {
        _id: 1,
        type: 'exam',
        message: { 
          $concat: [
            'أكمل ',
            '$studentData.username',
            ' امتحان ',
            '$examData.title',
            ' بنسبة ',
            { $toString: { $round: ['$percentage', 2] } },
            '%'
          ]
        },
        time: '$submittedAt',
        user: '$studentData.username'
      }
    }
  ]);

  // أنشطة الحضور
  const attendanceActivities = await Attendance.aggregate([
    {
      $match: {
        recordedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'student',
        foreignField: '_id',
        as: 'studentData'
      }
    },
    {
      $unwind: '$studentData'
    },
    {
      $sort: { recordedAt: -1 }
    },
    {
      $limit: 5
    },
    {
      $project: {
        _id: 1,
        type: 'attendance',
        message: {
          $concat: [
            'تم تسجيل ',
            '$studentData.username',
            ' كـ ',
            {
              $switch: {
                branches: [
                  { case: { $eq: ['$status', 'present'] }, then: 'حاضر' },
                  { case: { $eq: ['$status', 'absent'] }, then: 'غائب' },
                  { case: { $eq: ['$status', 'late'] }, then: 'متأخر' },
                  { case: { $eq: ['$status', 'excused'] }, then: 'معذور' }
                ],
                default: 'غير محدد'
              }
            },
            ' في ',
            '$subject'
          ]
        },
        time: '$recordedAt',
        user: '$studentData.username'
      }
    }
  ]);

  const allActivities = [
    ...examActivities,
    ...attendanceActivities, 
    ...loginActivities
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: allActivities
  });
}));

export default router;