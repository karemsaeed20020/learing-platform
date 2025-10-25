import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date, // التاريخ فقط (بدون وقت)
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused'],
    default: 'absent' // افتراضي غائب حتى يتم التسجيل
  },
  subject: {
    type: String,
    default: 'اللغة العربية'
  },
  grade: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  recordedAt: {
    type: Date,
    default: Date.now
  },
  // للمراكز التعليمية - يمكن إضافة معلومات إضافية
  sessionType: {
    type: String,
    enum: ['normal', 'makeup', 'exam', 'extra'],
    default: 'normal'
  }
}, {
  timestamps: true
});

// منع التسجيل المكرر لنفس الطالب في نفس اليوم
attendanceSchema.index({ 
  student: 1, 
  date: 1 
}, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;