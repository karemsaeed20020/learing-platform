import mongoose from 'mongoose';

const educationalContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان المحتوى مطلوب'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'ملف_دراسي', 
      'مرجع_إضافي', 
      'ملاحظة_عامة', 
      'تنبيه_مهم', 
      'توجيه_دراسي', 
      'تحديث_منهج'
    ]
  },
  fileType: {
    type: String,
    enum: ['pdf', 'word', 'powerpoint', 'text', 'none'],
    default: 'none'
  },
  category: {
    type: String,
    enum: [
      'نحو', 'صرف', 'بلاغة', 'أدب', 'نصوص', 'إملاء', 
      'كتاب', 'ورقة_عمل', 'اختبار', 'عام'
    ],
    default: 'عام'
  },
  grade: {
    type: String,
    required: true,
    enum: ['الصف الثاني الثانوي', 'الصف الثالث الثانوي', 'كلاهما']
  },
  files: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  content: {
    type: String,
    trim: true
  },
  isImportant: {
    type: Boolean,
    default: false
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

const EducationalContent = mongoose.model('EducationalContent', educationalContentSchema);
export default EducationalContent;