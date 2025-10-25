import express from 'express';
import DailyGrade from "../../../DB/models/DailyGrade.model.js";
import { protect } from '../../middlewares/auth.middleware.js';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';

const router = express.Router();

// ✅ إضافة درجة يومية (المعلم فقط)
router.post('/', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بإضافة درجات', StatusCodes.FORBIDDEN));
  }

  const {
    studentId,
    grade,
    type,
    topic,
    score,
    maxScore = 100,
    notes,
    category,
    status = 'مكتمل',
    date = new Date()
  } = req.body;

  // التحقق من أن الطالب موجود
  const Student = await import('../../../DB/models/user.model.js').then(mod => mod.default);
  const student = await Student.findById(studentId);
  if (!student) {
    return next(new AppError('الطالب غير موجود', StatusCodes.NOT_FOUND));
  }

  const dailyGrade = await DailyGrade.create({
    student: studentId,
    teacher: req.user._id,
    grade,
    type,
    topic,
    score,
    maxScore,
    notes,
    category,
    status,
    date,
    subject: 'اللغة العربية'
  });

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'تم إضافة الدرجة بنجاح',
    data: { dailyGrade }
  });
}));

// ✅ الحصول على درجات طالب معين
router.get('/student/:studentId', protect, asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const { startDate, endDate, type, category } = req.query;

  let query = { student: studentId };

  // فلترة حسب التاريخ
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  // فلترة حسب النوع
  if (type) query.type = type;
  
  // فلترة حسب التصنيف
  if (category) query.category = category;

  const grades = await DailyGrade.find(query)
    .populate('teacher', 'username')
    .sort({ date: -1 });

  // حساب المتوسط
  const average = grades.length > 0 
    ? grades.reduce((sum, grade) => sum + grade.score, 0) / grades.length 
    : 0;

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: grades.length,
    data: {
      grades,
      statistics: {
        average: Math.round(average * 100) / 100,
        total: grades.length,
        excellent: grades.filter(g => g.score >= 90).length,
        good: grades.filter(g => g.score >= 75 && g.score < 90).length,
        needsImprovement: grades.filter(g => g.score < 75).length
      }
    }
  });
}));

// ✅ الحصول على جميع الدرجات للصف (للمعلم)
router.get('/class/:grade', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const { grade } = req.params;
  const { date, type } = req.query;

  let query = { grade };

  // فلترة حسب التاريخ
  if (date) {
    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    query.date = {
      $gte: targetDate,
      $lt: nextDay
    };
  }

  // فلترة حسب النوع
  if (type) query.type = type;

  const grades = await DailyGrade.find(query)
    .populate('student', 'username email phone')
    .populate('teacher', 'username')
    .sort({ date: -1, 'student.username': 1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: grades.length,
    data: { grades }
  });
}));

// ✅ الحصول على إحصائيات الصف
router.get('/statistics/class/:grade', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const { grade } = req.params;
  const { startDate, endDate } = req.query;

  let dateFilter = {};
  if (startDate || endDate) {
    dateFilter = {
      date: {
        ...(startDate && { $gte: new Date(startDate) }),
        ...(endDate && { $lte: new Date(endDate) })
      }
    };
  }

  const statistics = await DailyGrade.aggregate([
    {
      $match: {
        grade,
        ...dateFilter
      }
    },
    {
      $group: {
        _id: '$student',
        averageScore: { $avg: '$score' },
        totalGrades: { $sum: 1 },
        lastGrade: { $last: '$score' },
        bestGrade: { $max: '$score' },
        worstGrade: { $min: '$score' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'studentInfo'
      }
    },
    {
      $unwind: '$studentInfo'
    },
    {
      $project: {
        'studentInfo.username': 1,
        'studentInfo.email': 1,
        'studentInfo.phone': 1,
        averageScore: { $round: ['$averageScore', 2] },
        totalGrades: 1,
        lastGrade: 1,
        bestGrade: 1,
        worstGrade: 1
      }
    },
    {
      $sort: { averageScore: -1 }
    }
  ]);

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: statistics.length,
    data: { statistics }
  });
}));

// ✅ تحديث درجة
router.put('/:id', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بتعديل الدرجات', StatusCodes.FORBIDDEN));
  }

  const { score, notes, status } = req.body;

  const grade = await DailyGrade.findById(req.params.id);
  if (!grade) {
    return next(new AppError('الدرجة غير موجودة', StatusCodes.NOT_FOUND));
  }

  // التحقق من أن المعلم هو من أضاف الدرجة
  if (grade.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتعديل هذه الدرجة', StatusCodes.FORBIDDEN));
  }

  const updatedGrade = await DailyGrade.findByIdAndUpdate(
    req.params.id,
    {
      ...(score && { score }),
      ...(notes && { notes }),
      ...(status && { status })
    },
    { new: true, runValidators: true }
  ).populate('student', 'username email');

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تحديث الدرجة بنجاح',
    data: { grade: updatedGrade }
  });
}));

// ✅ حذف درجة
router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بحذف الدرجات', StatusCodes.FORBIDDEN));
  }

  const grade = await DailyGrade.findById(req.params.id);
  if (!grade) {
    return next(new AppError('الدرجة غير موجودة', StatusCodes.NOT_FOUND));
  }

  // التحقق من أن المعلم هو من أضاف الدرجة
  if (grade.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بحذف هذه الدرجة', StatusCodes.FORBIDDEN));
  }

  await DailyGrade.findByIdAndDelete(req.params.id);

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم حذف الدرجة بنجاح'
  });
}));

export default router;