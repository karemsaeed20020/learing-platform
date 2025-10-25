import express from 'express';
import Exam from '../../../DB/models/Exam.model.js';
import { protect } from '../../middlewares/auth.middleware.js';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from 'http-status-codes';

const router = express.Router();

// ✅ إنشاء اختبار جديد (المعلم فقط)
router.post('/', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بإنشاء اختبارات', StatusCodes.FORBIDDEN));
  }

  const {
    title,
    description,
    grade,
    category,
    examType,
    duration,
    instructions,
    isPublished,
    tags,
    questions
  } = req.body;

  // التحقق من وجود الأسئلة
  if (!questions || questions.length === 0) {
    return next(new AppError('يجب إضافة أسئلة للاختبار', StatusCodes.BAD_REQUEST));
  }

  // تنظيف الأسئلة - إزالة أي حقول _id مؤقتة
  const cleanQuestions = questions.map(question => {
    // إنشاء كائن جديد بدون حقل _id إذا كان مؤقتاً
    const { _id, ...cleanQuestion } = question;
    return cleanQuestion;
  });

  // التحقق من صحة الأسئلة بعد التنظيف
  for (let i = 0; i < cleanQuestions.length; i++) {
    const question = cleanQuestions[i];
    if (!question.questionText || question.questionText.trim() === '') {
      return next(new AppError(`نص السؤال ${i + 1} مطلوب`, StatusCodes.BAD_REQUEST));
    }
    if (!question.options || question.options.length !== 4) {
      return next(new AppError(`يجب أن يحتوي السؤال ${i + 1} على 4 خيارات`, StatusCodes.BAD_REQUEST));
    }
    if (question.options.some(opt => !opt || opt.trim() === '')) {
      return next(new AppError(`جميع خيارات السؤال ${i + 1} مطلوبة`, StatusCodes.BAD_REQUEST));
    }
    if (question.correctAnswer < 0 || question.correctAnswer > 3) {
      return next(new AppError(`الإجابة الصحيحة للسؤال ${i + 1} يجب أن تكون بين 0 و 3`, StatusCodes.BAD_REQUEST));
    }
    if (!question.marks || question.marks < 1) {
      return next(new AppError(`درجة السؤال ${i + 1} يجب أن تكون 1 على الأقل`, StatusCodes.BAD_REQUEST));
    }
  }

  // حساب الدرجة الكاملة من الأسئلة
  const totalMarks = cleanQuestions.reduce((total, question) => total + question.marks, 0);

  const exam = await Exam.create({
    title,
    description,
    grade,
    category,
    examType,
    duration: parseInt(duration),
    totalMarks,
    instructions,
    isPublished: isPublished === true || isPublished === 'true',
    tags: tags ? (typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : tags) : [],
    questions: cleanQuestions,
    teacher: req.user._id
  });

  await exam.populate('teacher', 'username email');

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'تم إنشاء الاختبار بنجاح',
    data: { exam }
  });
}));

// ✅ الحصول على جميع اختبارات المعلم
router.get('/teacher', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const { grade, examType, category, search } = req.query;
  
  let query = { teacher: req.user._id };

  // الفلترة حسب الصف
  if (grade && grade !== 'all') {
    query.grade = grade;
  }

  // الفلترة حسب نوع الاختبار
  if (examType && examType !== 'all') {
    query.examType = examType;
  }

  // الفلترة حسب التصنيف
  if (category && category !== 'all') {
    query.category = category;
  }

  // البحث في العنوان والوصف
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const exams = await Exam.find(query)
    .populate('teacher', 'username email')
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: exams.length,
    data: { exams }
  });
}));

// ✅ الحصول على الاختبارات المنشورة للطلاب
router.get('/published', protect, asyncHandler(async (req, res, next) => {
  const { grade, category, examType } = req.query;
  
  let query = { isPublished: true };

  // فلترة حسب صف الطالب
  if (req.user.grade && req.user.grade !== 'كلاهما') {
    query.$or = [
      { grade: req.user.grade },
      { grade: 'كلاهما' }
    ];
  }

  if (grade && grade !== 'all') {
    query.grade = grade;
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  if (examType && examType !== 'all') {
    query.examType = examType;
  }

  const exams = await Exam.find(query)
    .populate('teacher', 'username')
    .select('-questions.correctAnswer') // إخفاء الإجابات الصحيحة
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: exams.length,
    data: { exams }
  });
}));

// ✅ الحصول على اختبار محدد
router.get('/:id', protect, asyncHandler(async (req, res, next) => {
  const exam = await Exam.findById(req.params.id).populate('teacher', 'username email');

  if (!exam) {
    return next(new AppError('الاختبار غير موجود', StatusCodes.NOT_FOUND));
  }

  // إذا كان المستخدم طالباً، إخفاء الإجابات الصحيحة
  if (req.user.role === 'student') {
    if (!exam.isPublished) {
      return next(new AppError('هذا الاختبار غير منشور', StatusCodes.FORBIDDEN));
    }
    
    const examWithoutAnswers = {
      ...exam.toObject(),
      questions: exam.questions.map(question => ({
        _id: question._id,
        questionText: question.questionText,
        options: question.options,
        marks: question.marks
      }))
    };

    return res.status(StatusCodes.OK).json({
      status: 'success',
      data: { exam: examWithoutAnswers }
    });
  }

  // التحقق من أن المعلم هو مالك الاختبار
  if (req.user.role === 'teacher' && exam.teacher._id.toString() !== req.user._id.toString()) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذا الاختبار', StatusCodes.FORBIDDEN));
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { exam }
  });
}));

// ✅ تحديث الاختبار
router.put('/:id', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بتعديل الاختبارات', StatusCodes.FORBIDDEN));
  }

  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    return next(new AppError('الاختبار غير موجود', StatusCodes.NOT_FOUND));
  }

  // التحقق من أن المعلم هو مالك الاختبار
  if (exam.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتعديل هذا الاختبار', StatusCodes.FORBIDDEN));
  }

  const {
    title,
    description,
    grade,
    category,
    examType,
    duration,
    instructions,
    isPublished,
    tags,
    questions
  } = req.body;

  let cleanQuestions = questions;
  
  // إذا تم إرسال أسئلة جديدة، تنظيفها والتحقق من صحتها
  if (questions && questions.length > 0) {
    // تنظيف الأسئلة - إزالة أي حقول _id مؤقتة
    cleanQuestions = questions.map(question => {
      // إذا كان _id مؤقت (يبدأ بـ temp-)، نزيله
      if (question._id && question._id.toString().startsWith('temp-')) {
        const { _id, ...cleanQuestion } = question;
        return cleanQuestion;
      }
      return question;
    });

    // التحقق من صحة الأسئلة بعد التنظيف
    for (let i = 0; i < cleanQuestions.length; i++) {
      const question = cleanQuestions[i];
      if (!question.questionText || question.questionText.trim() === '') {
        return next(new AppError(`نص السؤال ${i + 1} مطلوب`, StatusCodes.BAD_REQUEST));
      }
      if (!question.options || question.options.length !== 4) {
        return next(new AppError(`يجب أن يحتوي السؤال ${i + 1} على 4 خيارات`, StatusCodes.BAD_REQUEST));
      }
      if (question.options.some(opt => !opt || opt.trim() === '')) {
        return next(new AppError(`جميع خيارات السؤال ${i + 1} مطلوبة`, StatusCodes.BAD_REQUEST));
      }
      if (question.correctAnswer < 0 || question.correctAnswer > 3) {
        return next(new AppError(`الإجابة الصحيحة للسؤال ${i + 1} يجب أن تكون بين 0 و 3`, StatusCodes.BAD_REQUEST));
      }
      if (!question.marks || question.marks < 1) {
        return next(new AppError(`درجة السؤال ${i + 1} يجب أن تكون 1 على الأقل`, StatusCodes.BAD_REQUEST));
      }
    }
  }

  // حساب الدرجة الكاملة إذا كانت هناك أسئلة
  const totalMarks = cleanQuestions && cleanQuestions.length > 0 
    ? cleanQuestions.reduce((total, question) => total + question.marks, 0)
    : exam.totalMarks;

  const updateData = {
    ...(title && { title }),
    ...(description && { description }),
    ...(grade && { grade }),
    ...(category && { category }),
    ...(examType && { examType }),
    ...(duration && { duration: parseInt(duration) }),
    ...(instructions !== undefined && { instructions }),
    ...(isPublished !== undefined && { isPublished: isPublished === true || isPublished === 'true' }),
    ...(tags !== undefined && { 
      tags: typeof tags === 'string' 
        ? tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '') 
        : tags 
    }),
    ...(cleanQuestions && { questions: cleanQuestions }),
    totalMarks
  };

  const updatedExam = await Exam.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('teacher', 'username email');

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تحديث الاختبار بنجاح',
    data: { exam: updatedExam }
  });
}));

// ✅ حذف الاختبار
router.delete('/:id', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بحذف الاختبارات', StatusCodes.FORBIDDEN));
  }

  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    return next(new AppError('الاختبار غير موجود', StatusCodes.NOT_FOUND));
  }

  // التحقق من أن المعلم هو مالك الاختبار
  if (exam.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بحذف هذا الاختبار', StatusCodes.FORBIDDEN));
  }

  await Exam.findByIdAndDelete(req.params.id);

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم حذف الاختبار بنجاح'
  });
}));

// ✅ إرسال إجابات الاختبار وتصحيحها
router.post('/:id/submit', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'student') {
    return next(new AppError('غير مصرح لك بتقديم إجابات الاختبار', StatusCodes.FORBIDDEN));
  }

  const { answers } = req.body; // { questionId: selectedOptionIndex }

  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    return next(new AppError('الاختبار غير موجود', StatusCodes.NOT_FOUND));
  }

  if (!exam.isPublished) {
    return next(new AppError('هذا الاختبار غير منشور', StatusCodes.FORBIDDEN));
  }

  // تصحيح الإجابات
  let totalScore = 0;
  let obtainedScore = 0;
  const results = exam.questions.map(question => {
    const studentAnswer = answers[question._id.toString()];
    const isCorrect = studentAnswer === question.correctAnswer;
    const questionScore = isCorrect ? question.marks : 0;
    
    totalScore += question.marks;
    obtainedScore += questionScore;

    return {
      questionId: question._id,
      questionText: question.questionText,
      studentAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      marks: question.marks,
      obtainedMarks: questionScore,
      options: question.options
    };
  });

  const percentage = totalScore > 0 ? (obtainedScore / totalScore) * 100 : 0;

  // حفظ النتيجة في قاعدة البيانات
  const ExamResult = await import('../../../DB/models/ExamResult.model.js').then(mod => mod.default);
  const examResult = await ExamResult.create({
    student: req.user._id,
    exam: exam._id,
    answers,
    totalScore,
    obtainedScore,
    percentage,
    results,
    submittedAt: new Date()
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تقديم الإجابات بنجاح',
    data: {
      result: {
        totalScore,
        obtainedScore,
        percentage: Math.round(percentage * 100) / 100,
        results,
        submittedAt: examResult.submittedAt
      }
    }
  });
}));

// ✅ الحصول على نتائج الاختبار لطالب معين
router.get('/:id/results', protect, asyncHandler(async (req, res, next) => {
  const ExamResult = await import('../../../DB/models/ExamResult.model.js').then(mod => mod.default);
  
  let query = { exam: req.params.id };

  // إذا كان المستخدم طالباً، عرض نتائجه فقط
  if (req.user.role === 'student') {
    query.student = req.user._id;
  }

  const results = await ExamResult.find(query)
    .populate('student', 'username email')
    .sort({ submittedAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: results.length,
    data: { results }
  });
}));

// ✅ الحصول على إحصائيات الاختبار
router.get('/:id/statistics', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بالوصول إلى الإحصائيات', StatusCodes.FORBIDDEN));
  }

  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    return next(new AppError('الاختبار غير موجود', StatusCodes.NOT_FOUND));
  }

  // التحقق من أن المعلم هو مالك الاختبار
  if (exam.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بالوصول إلى إحصائيات هذا الاختبار', StatusCodes.FORBIDDEN));
  }

  const ExamResult = await import('../../../DB/models/ExamResult.model.js').then(mod => mod.default);
  
  const results = await ExamResult.find({ exam: req.params.id })
    .populate('student', 'username email')
    .sort({ percentage: -1 });

  const statistics = {
    totalSubmissions: results.length,
    averageScore: results.length > 0 
      ? results.reduce((sum, result) => sum + result.percentage, 0) / results.length 
      : 0,
    highestScore: results.length > 0 
      ? Math.max(...results.map(result => result.percentage)) 
      : 0,
    lowestScore: results.length > 0 
      ? Math.min(...results.map(result => result.percentage)) 
      : 0,
    passCount: results.filter(result => result.percentage >= 50).length,
    failCount: results.filter(result => result.percentage < 50).length,
    questionStats: exam.questions.map(question => {
      const questionResults = results.map(result => 
        result.results.find(r => r.questionId.toString() === question._id.toString())
      ).filter(r => r);
      
      const correctCount = questionResults.filter(r => r.isCorrect).length;
      const totalAttempts = questionResults.length;
      
      return {
        questionId: question._id,
        questionText: question.questionText,
        correctCount,
        totalAttempts,
        accuracy: totalAttempts > 0 ? (correctCount / totalAttempts) * 100 : 0
      };
    })
  };

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { statistics, results: results.slice(0, 10) } // إرجاع أول 10 نتائج فقط
  });
}));

// ✅ نسخ اختبار موجود
router.post('/:id/copy', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بنسخ الاختبارات', StatusCodes.FORBIDDEN));
  }

  const originalExam = await Exam.findById(req.params.id);
  if (!originalExam) {
    return next(new AppError('الاختبار غير موجود', StatusCodes.NOT_FOUND));
  }

  // إنشاء نسخة من الاختبار
  const copiedExam = await Exam.create({
    title: `${originalExam.title} (نسخة)`,
    description: originalExam.description,
    grade: originalExam.grade,
    category: originalExam.category,
    examType: originalExam.examType,
    duration: originalExam.duration,
    totalMarks: originalExam.totalMarks,
    instructions: originalExam.instructions,
    isPublished: false,
    tags: originalExam.tags,
    questions: originalExam.questions.map(question => ({
      questionText: question.questionText,
      options: [...question.options],
      correctAnswer: question.correctAnswer,
      marks: question.marks
    })),
    teacher: req.user._id
  });

  await copiedExam.populate('teacher', 'username email');

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'تم نسخ الاختبار بنجاح',
    data: { exam: copiedExam }
  });
}));

// Add this to your examRoutes.js

// ✅ الحصول على جميع نتائج اختبارات المعلم
router.get('/results/all', protect, asyncHandler(async (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const ExamResult = await import('../../../DB/models/ExamResult.model.js').then(mod => mod.default);
  
  // Get all exams by this teacher
  const teacherExams = await Exam.find({ teacher: req.user._id }).select('_id');
  const examIds = teacherExams.map(exam => exam._id);

  if (examIds.length === 0) {
    return res.status(StatusCodes.OK).json({
      status: 'success',
      results: 0,
      data: { results: [] }
    });
  }

  const results = await ExamResult.find({ exam: { $in: examIds } })
    .populate('student', 'username email phone')
    .populate('exam', 'title totalMarks')
    .sort({ submittedAt: -1 });

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: results.length,
    data: { results }
  });
}));


// In your examRoutes.js - Update the published exams endpoint
router.get('/published', protect, asyncHandler(async (req, res, next) => {
  const { grade, category, examType } = req.query;
  
  let query = { isPublished: true };

  // فلترة حسب صف الطالب
  if (req.user.grade && req.user.grade !== 'كلاهما') {
    query.$or = [
      { grade: req.user.grade },
      { grade: 'كلاهما' }
    ];
  }

  if (grade && grade !== 'all') {
    query.grade = grade;
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  if (examType && examType !== 'all') {
    query.examType = examType;
  }

  const exams = await Exam.find(query)
    .populate('teacher', 'username')
    .select('-questions.correctAnswer')
    .sort({ createdAt: -1 });

  // Get student's completed exams
  const ExamResult = await import('../../../DB/models/ExamResult.model.js').then(mod => mod.default);
  const studentResults = await ExamResult.find({ 
    student: req.user._id 
  }).select('exam');

  const completedExamIds = studentResults.map(result => result.exam.toString());

  // Add completion status to each exam
  const examsWithStatus = exams.map(exam => ({
    ...exam.toObject(),
    isCompleted: completedExamIds.includes(exam._id.toString())
  }));

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: exams.length,
    data: { exams: examsWithStatus }
  });
}));

// Add this endpoint to check if exam can be taken
router.get('/:id/can-take', protect, asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'student') {
    return next(new AppError('غير مصرح لك بتقديم هذا الطلب', StatusCodes.FORBIDDEN));
  }

  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    return next(new AppError('الاختبار غير موجود', StatusCodes.NOT_FOUND));
  }

  if (!exam.isPublished) {
    return res.status(StatusCodes.OK).json({
      status: 'success',
      data: { canTake: false, reason: 'الاختبار غير منشور' }
    });
  }

  // Check if student already completed this exam
  const ExamResult = await import('../../../DB/models/ExamResult.model.js').then(mod => mod.default);
  const existingResult = await ExamResult.findOne({
    student: req.user._id,
    exam: req.params.id
  });

  if (existingResult) {
    return res.status(StatusCodes.OK).json({
      status: 'success',
      data: { 
        canTake: false, 
        reason: 'لقد قمت بتقديم هذا الاختبار مسبقاً',
        result: existingResult 
      }
    });
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { canTake: true }
  });
}));

export default router;