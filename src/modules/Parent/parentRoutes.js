import express from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import asyncHandler from '../../utils/asyncHandler.js';
import AppError from '../../utils/AppError.js';
import { StatusCodes } from 'http-status-codes';
import User from '../../../DB/models/user.model.js';
import ExamResult from '../../../DB/models/ExamResult.model.js';
import Attendance from '../../../DB/models/attendance.model.js';
import Exam from '../../../DB/models/Exam.model.js';


const router = express.Router();

// ✅ الحصول على بيانات ولي الأمر والأبناء
router.get('/dashboard', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const parent = await User.findById(req.user._id).populate('children', 'username email grade avatar');
  
  if (!parent) {
    return next(new AppError('ولي الأمر غير موجود', StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      parent: {
        id: parent._id,
        username: parent.username,
        email: parent.email,
        children: parent.children
      }
    }
  });
}));



// ✅ الحصول على نتائج الأبناء
router.get('/children/results', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const parent = await User.findById(req.user._id).populate('children');
  const childrenIds = parent.children.map(child => child._id);

  const results = await ExamResult.find({ 
    student: { $in: childrenIds } 
  })
  .populate('exam', 'title examType category totalMarks duration')
  .populate('student', 'username grade')
  .sort({ submittedAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: results.length,
    data: { results }
  });
}));

// ✅ الحصول على حضور الأبناء
router.get('/children/attendance', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const parent = await User.findById(req.user._id).populate('children');
  const childrenIds = parent.children.map(child => child._id);

  // الحصول على حضور آخر 30 يوم
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const attendance = await Attendance.find({
    student: { $in: childrenIds },
    date: { $gte: thirtyDaysAgo }
  })
  .populate('student', 'username grade')
  .sort({ date: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { attendance }
  });
}));

// ✅ الحصول على الاختبارات القادمة
router.get('/upcoming-exams', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const parent = await User.findById(req.user._id).populate('children');
  const childrenGrades = [...new Set(parent.children.map(child => child.grade))];

  const upcomingExams = await Exam.find({
    grade: { $in: childrenGrades },
    isPublished: true
  })
  .populate('teacher', 'username')
  .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { upcomingExams }
  });
}));

// ✅ تصدير تقرير PDF للطالب
router.get('/child/:childId/report', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const { childId } = req.params;
  const { startDate, endDate } = req.query;

  // التحقق من أن الطالب من أبناء ولي الأمر
  const parent = await User.findById(req.user._id);
  if (!parent.children.includes(childId)) {
    return next(new AppError('غير مصرح لك بالوصول إلى بيانات هذا الطالب', StatusCodes.FORBIDDEN));
  }

  // جلب نتائج الطالب
  let resultsQuery = { student: childId };
  if (startDate && endDate) {
    resultsQuery.submittedAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const results = await ExamResult.find(resultsQuery)
    .populate('exam', 'title examType category totalMarks')
    .sort({ submittedAt: -1 });

  // جلب حضور الطالب
  let attendanceQuery = { student: childId };
  if (startDate && endDate) {
    attendanceQuery.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const attendance = await Attendance.find(attendanceQuery)
    .sort({ date: -1 });

  // حساب الإحصائيات
  const totalExams = results.length;
  const averageScore = totalExams > 0 ? 
    results.reduce((sum, result) => sum + result.percentage, 0) / totalExams : 0;
  
  const totalAttendance = attendance.length;
  const presentDays = attendance.filter(a => a.status === 'present').length;
  const attendanceRate = totalAttendance > 0 ? (presentDays / totalAttendance) * 100 : 0;

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      student: childId,
      period: {
        start: startDate,
        end: endDate
      },
      results,
      attendance,
      statistics: {
        totalExams,
        averageScore: Math.round(averageScore * 100) / 100,
        totalAttendance,
        presentDays,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        bestScore: totalExams > 0 ? Math.max(...results.map(r => r.percentage)) : 0,
        improvement: calculateImprovement(results)
      }
    }
  });
}));

// ✅ الحصول على التقدم الشهري
router.get('/child/:childId/progress', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const { childId } = req.params;
  const { months = 6 } = req.query;

  // التحقق من أن الطالب من أبناء ولي الأمر
  const parent = await User.findById(req.user._id);
  if (!parent.children.includes(childId)) {
    return next(new AppError('غير مصرح لك بالوصول إلى بيانات هذا الطالب', StatusCodes.FORBIDDEN));
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  // جلب النتائج خلال الفترة المحددة
  const results = await ExamResult.find({
    student: childId,
    submittedAt: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .populate('exam', 'title category')
  .sort({ submittedAt: 1 });

  // تنظيم البيانات شهرياً
  const monthlyProgress = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthResults = results.filter(result => {
      const resultDate = new Date(result.submittedAt);
      return resultDate.getFullYear() === year && resultDate.getMonth() === month;
    });

    if (monthResults.length > 0) {
      const averageScore = monthResults.reduce((sum, result) => sum + result.percentage, 0) / monthResults.length;
      
      monthlyProgress.push({
        year,
        month: month + 1,
        monthName: getMonthName(month),
        examCount: monthResults.length,
        averageScore: Math.round(averageScore * 100) / 100,
        exams: monthResults.map(r => ({
          title: r.exam.title,
          score: r.percentage,
          category: r.exam.category
        }))
      });
    }

    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      student: childId,
      period: {
        start: startDate,
        end: endDate,
        months: parseInt(months)
      },
      monthlyProgress
    }
  });
}));

// دوال مساعدة
const calculateImprovement = (results) => {
  if (results.length < 2) return 0;
  
  const sortedResults = results.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  const firstHalf = sortedResults.slice(0, Math.floor(sortedResults.length / 2));
  const secondHalf = sortedResults.slice(Math.floor(sortedResults.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, result) => sum + result.percentage, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, result) => sum + result.percentage, 0) / secondHalf.length;
  
  return Math.round((secondAvg - firstAvg) * 100) / 100;
};

const getMonthName = (monthIndex) => {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[monthIndex];
};


// ✅ تصدير تقرير PDF لنتائج الأبناء
router.get('/children/results/export', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'parent') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const { childId, search, childFilter, subjectFilter, typeFilter } = req.query;

  // جلب ولي الأمر وأبنائه
  const parent = await User.findById(req.user._id).populate('children');
  let childrenIds = parent.children.map(child => child._id);

  // إذا تم تحديد ابن معين
  if (childId && childId !== 'all') {
    // التحقق من أن الابن مسجل لدى ولي الأمر
    if (!parent.children.some(child => child._id.toString() === childId)) {
      return next(new AppError('غير مصرح لك بالوصول إلى بيانات هذا الطالب', StatusCodes.FORBIDDEN));
    }
    childrenIds = [childId];
  }

  // بناء query للنتائج
  let resultsQuery = { 
    student: { $in: childrenIds } 
  };

  // تطبيق الفلاتر
  if (search) {
    resultsQuery.$or = [
      { 'exam.title': { $regex: search, $options: 'i' } },
      { 'student.username': { $regex: search, $options: 'i' } }
    ];
  }

  if (subjectFilter && subjectFilter !== 'all') {
    resultsQuery['exam.category'] = subjectFilter;
  }

  if (typeFilter && typeFilter !== 'all') {
    resultsQuery['exam.examType'] = typeFilter;
  }

  const results = await ExamResult.find(resultsQuery)
    .populate('exam', 'title examType category totalMarks duration')
    .populate('student', 'username grade')
    .sort({ submittedAt: -1 });

  // إذا لم توجد نتائج
  if (results.length === 0) {
    return next(new AppError('لا توجد نتائج للتصدير', StatusCodes.NOT_FOUND));
  }

  // هنا يمكنك استخدام مكتبة مثل pdfkit أو puppeteer لإنشاء PDF
  // في الوقت الحالي، سنرجع البيانات كـ JSON كنموذج
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'جاري إنشاء التقرير...',
    data: {
      reportInfo: {
        generatedAt: new Date().toISOString(),
        totalResults: results.length,
        filters: {
          child: childId || 'all',
          search: search || '',
          subject: subjectFilter || 'all',
          type: typeFilter || 'all'
        }
      },
      results: results.map(result => ({
        student: result.student.username,
        grade: result.student.grade,
        exam: result.exam?.title || 'اختبار محذوف',
        category: result.exam?.category || 'غير محدد',
        type: result.exam?.examType || 'غير محدد',
        score: result.obtainedScore,
        total: result.exam?.totalMarks || result.obtainedScore,
        percentage: result.percentage,
        date: result.submittedAt
      }))
    }
  });

  // TODO: في المستقبل، استبدل الـ JSON بـ PDF حقيقي
  // const pdfBuffer = await generatePDFReport(results, parent, filters);
  // res.setHeader('Content-Type', 'application/pdf');
  // res.setHeader('Content-Disposition', `attachment; filename=report-${Date.now()}.pdf`);
  // res.send(pdfBuffer);
}));

export default router;