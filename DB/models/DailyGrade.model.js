import mongoose from 'mongoose';

const dailyGradeSchema = new mongoose.Schema({
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
    type: Date,
    required: true,
    default: Date.now
  },
  subject: {
    type: String,
    default: 'اللغة العربية'
  },
  grade: {
    type: String,
    required: true,
    enum: ['الصف الثاني الثانوي', 'الصف الثالث الثانوي']
  },
  type: {
    type: String,
    enum: ['تسميع', 'اختبار', 'مشاركة', 'واجب', 'أنشطة'],
    required: true
  },
  topic: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'يجب ألا يتجاوز العنوان 200 حرف']
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  maxScore: {
    type: Number,
    default: 100
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'يجب ألا تتجاوز الملاحظات 500 حرف']
  },
  category: {
    type: String,
    enum: ['نحوي', 'صرفي', 'بلاغة', 'أدب', 'نصوص', 'إملاء', 'قراءة', 'كتابة'],
    required: true
  },
  status: {
    type: String,
    enum: ['مكتمل', 'ناقص', 'متأخر'],
    default: 'مكتمل'
  }
}, {
  timestamps: true
});

// منع التكرار لنفس الطالب في نفس اليوم لنفس النوع والموضوع
dailyGradeSchema.index({ 
  student: 1, 
  date: 1, 
  type: 1, 
  topic: 1 
}, { unique: true });

// فهرسة للاستعلامات السريعة
dailyGradeSchema.index({ student: 1, date: -1 });
dailyGradeSchema.index({ teacher: 1, date: -1 });
dailyGradeSchema.index({ grade: 1, date: -1 });

const DailyGrade = mongoose.model('DailyGrade', dailyGradeSchema);
export default DailyGrade;