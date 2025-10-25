import { StatusCodes } from 'http-status-codes';
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import Attendance from '../../../DB/models/attendance.model.js';
import User from '../../../DB/models/user.model.js';


// ✅ تسجيل الحضور اليومي
export const recordDailyAttendance = asyncHandler(async (req, res, next) => {
  const { students, grade, date } = req.body;

  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بتسجيل الحضور', StatusCodes.FORBIDDEN));
  }

  const attendanceRecords = [];
  const errors = [];

  for (const studentData of students) {
    try {
      const student = await User.findOne({
        _id: studentData.studentId,
        role: 'student'
      });

      if (!student) {
        errors.push(`الطالب غير موجود: ${studentData.studentId}`);
        continue;
      }

      // استخدام التاريخ فقط (إزالة الوقت)
      const attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);

      // البحث عن سجل موجود
      const existingAttendance = await Attendance.findOne({
        student: studentData.studentId,
        date: attendanceDate
      });

      let attendanceRecord;

      if (existingAttendance) {
        // تحديث السجل الموجود
        existingAttendance.status = studentData.status;
        existingAttendance.notes = studentData.notes;
        existingAttendance.teacher = req.user._id;
        await existingAttendance.save();
        attendanceRecord = existingAttendance;
      } else {
        // إنشاء سجل جديد
        attendanceRecord = await Attendance.create({
          student: studentData.studentId,
          teacher: req.user._id,
          date: attendanceDate,
          grade: grade,
          subject: 'اللغة العربية',
          status: studentData.status || 'absent',
          notes: studentData.notes
        });
      }

      attendanceRecords.push(attendanceRecord);
    } catch (error) {
      errors.push(`خطأ في تسجيل الطالب ${studentData.studentId}: ${error.message}`);
    }
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'تم تسجيل الحضور اليومي بنجاح',
    data: {
      recorded: attendanceRecords.length,
      errors: errors.length > 0 ? errors : undefined,
      date: date
    }
  });
});

// ✅ جلب الحضور الشهري
export const getMonthlyAttendance = asyncHandler(async (req, res, next) => {
  const { month, year, grade } = req.query;

  if (!month || !year || !grade) {
    return next(new AppError('يجب تحديد الشهر والسنة والصف', StatusCodes.BAD_REQUEST));
  }

  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // آخر يوم في الشهر

  // جلب جميع طلاب الصف
  const students = await User.find({ 
    role: 'student', 
    grade: grade 
  }).select('_id username email phone grade');

  // جلب سجلات الحضور للشهر
  const attendanceRecords = await Attendance.find({
    date: {
      $gte: startDate,
      $lte: endDate
    },
    grade: grade
  }).populate('student', 'username email');

  // تنظيم البيانات بشكل شهري
  const monthlyData = {
    month: parseInt(month),
    year: parseInt(year),
    grade: grade,
    days: [],
    students: students.map(student => {
      // جلب حضور هذا الطالب لكل يوم في الشهر
      const studentAttendance = {};
      
      for (let day = 1; day <= endDate.getDate(); day++) {
        const currentDate = new Date(year, month - 1, day);
        const record = attendanceRecords.find(record => 
          record.student._id.toString() === student._id.toString() &&
          record.date.getDate() === day
        );
        
        studentAttendance[day] = record ? record.status : 'not-recorded';
      }

      return {
        student: {
          _id: student._id,
          username: student.username,
          email: student.email,
          phone: student.phone,
          grade: student.grade
        },
        attendance: studentAttendance,
        summary: {
          present: Object.values(studentAttendance).filter(status => status === 'present').length,
          absent: Object.values(studentAttendance).filter(status => status === 'absent').length,
          late: Object.values(studentAttendance).filter(status => status === 'late').length,
          total: Object.values(studentAttendance).filter(status => status !== 'not-recorded').length
        }
      };
    })
  };

  // إحصائيات الشهر
  const allAttendance = monthlyData.students.flatMap(student => 
    Object.values(student.attendance).filter(status => status !== 'not-recorded')
  );

  monthlyData.statistics = {
    totalRecords: allAttendance.length,
    present: allAttendance.filter(status => status === 'present').length,
    absent: allAttendance.filter(status => status === 'absent').length,
    late: allAttendance.filter(status => status === 'late').length,
    attendanceRate: allAttendance.length > 0 ? 
      Math.round((allAttendance.filter(status => status === 'present').length / allAttendance.length) * 100) : 0
  };

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: monthlyData
  });
});

// ✅ جلب حضور يوم محدد
export const getDailyAttendance = asyncHandler(async (req, res, next) => {
  const { date, grade } = req.query;

  if (!date || !grade) {
    return next(new AppError('يجب تحديد التاريخ والصف', StatusCodes.BAD_REQUEST));
  }

  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // جلب جميع طلاب الصف
  const students = await User.find({ 
    role: 'student', 
    grade: grade 
  }).select('_id username email phone grade');

  // جلب سجلات الحضور لهذا اليوم
  const attendanceRecords = await Attendance.find({
    date: targetDate,
    grade: grade
  }).populate('student', 'username email');

  // دمج البيانات
  const dailyAttendance = students.map(student => {
    const record = attendanceRecords.find(record => 
      record.student._id.toString() === student._id.toString()
    );
    
    return {
      student: {
        _id: student._id,
        username: student.username,
        email: student.email,
        phone: student.phone,
        grade: student.grade
      },
      attendance: record ? {
        _id: record._id,
        status: record.status,
        notes: record.notes,
        recordedAt: record.recordedAt
      } : null,
      status: record ? record.status : 'not-recorded'
    };
  });

  // إحصائيات اليوم
  const stats = {
    totalStudents: dailyAttendance.length,
    present: dailyAttendance.filter(s => s.status === 'present').length,
    absent: dailyAttendance.filter(s => s.status === 'absent').length,
    late: dailyAttendance.filter(s => s.status === 'late').length,
    notRecorded: dailyAttendance.filter(s => s.status === 'not-recorded').length,
    attendanceRate: dailyAttendance.length > 0 ? 
      Math.round((dailyAttendance.filter(s => s.status === 'present').length / dailyAttendance.length) * 100) : 0
  };

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      date: targetDate,
      grade: grade,
      subject: 'اللغة العربية',
      attendance: dailyAttendance,
      statistics: stats
    }
  });
});

// ✅ تقرير حضور الطالب الشهري
export const getStudentMonthlyReport = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const { month, year } = req.query;

  if (req.user.role !== 'admin' && req.user.role !== 'teacher' && req.user._id.toString() !== studentId) {
    return next(new AppError('غير مصرح لك بالوصول إلى هذه البيانات', StatusCodes.FORBIDDEN));
  }

  const targetMonth = month || new Date().getMonth() + 1;
  const targetYear = year || new Date().getFullYear();

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0);

  const attendance = await Attendance.find({
    student: studentId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });

  // إنشاء تقرير مفصل لكل يوم في الشهر
  const monthDays = endDate.getDate();
  const dailyReport = [];

  for (let day = 1; day <= monthDays; day++) {
    const currentDate = new Date(targetYear, targetMonth - 1, day);
    const record = attendance.find(a => a.date.getDate() === day);
    
    dailyReport.push({
      day: day,
      date: currentDate,
      status: record ? record.status : 'not-recorded',
      notes: record ? record.notes : null,
      recordedAt: record ? record.recordedAt : null
    });
  }

  // إحصائيات
  const totalDays = monthDays;
  const presentDays = attendance.filter(a => a.status === 'present').length;
  const absentDays = attendance.filter(a => a.status === 'absent').length;
  const lateDays = attendance.filter(a => a.status === 'late').length;
  const recordedDays = attendance.length;

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      student: studentId,
      month: targetMonth,
      year: targetYear,
      dailyReport,
      statistics: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        recordedDays,
        notRecorded: totalDays - recordedDays,
        attendanceRate: Math.round((presentDays / recordedDays) * 100) || 0
      }
    }
  });
});
// ✅ Detailed Attendance Report (for Admin)
export const getAttendanceReport = asyncHandler(async (req, res) => {
  const { grade, student, start, end } = req.query;

  const filter = {};

  // Date filter
  if (start && end) {
    filter.date = { $gte: new Date(start), $lte: new Date(end) };
  }

  // Grade filter (based on student’s grade)
  if (grade) {
    filter['student.grade'] = grade;
  }

  // Find all attendance records and populate student info
  const records = await Attendance.find(filter)
    .populate('student', 'username grade')
    .sort({ date: -1 });

  // Search by name (after population)
  let filtered = records;
  if (student) {
    const regex = new RegExp(student, 'i');
    filtered = records.filter((r) => regex.test(r.student?.username));
  }

  // Format response
  const formatted = filtered.map((r) => ({
    _id: r._id,
    studentName: r.student?.username || 'غير معروف',
    grade: r.student?.grade || '-',
    date: r.date,
    status: r.status,
    notes: r.notes || '',
  }));

  res.json({ success: true, data: formatted });
});
