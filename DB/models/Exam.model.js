import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'نص السؤال مطلوب'],
    trim: true,
    maxlength: [1000, 'نص السؤال لا يمكن أن يزيد عن 1000 حرف']
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function(options) {
        return options.length === 4 && options.every(opt => opt.trim() !== '');
      },
      message: 'يجب أن يحتوي السؤال على 4 خيارات غير فارغة'
    }
  },
  correctAnswer: {
    type: Number,
    required: [true, 'الإجابة الصحيحة مطلوبة'],
    min: [0, 'الإجابة الصحيحة يجب أن تكون بين 0 و 3'],
    max: [3, 'الإجابة الصحيحة يجب أن تكون بين 0 و 3']
  },
  marks: {
    type: Number,
    required: [true, 'الدرجة مطلوبة'],
    min: [1, 'الدرجة يجب أن تكون 1 على الأقل']
  }
}, { _id: true });

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان الاختبار مطلوب'],
    trim: true,
    maxlength: [200, 'العنوان لا يمكن أن يزيد عن 200 حرف']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'الوصف لا يمكن أن يزيد عن 500 حرف']
  },
  grade: {
    type: String,
    required: [true, 'الصف الدراسي مطلوب'],
    enum: {
      values: ['الصف الثاني الثانوي', 'الصف الثالث الثانوي', 'كلاهما'],
      message: 'الصف الدراسي يجب أن يكون: الصف الثاني الثانوي، الصف الثالث الثانوي، أو كلاهما'
    }
  },
  category: {
    type: String,
    required: [true, 'التصنيف مطلوب'],
    enum: {
      values: ['نحو', 'صرف', 'بلاغة', 'أدب', 'نصوص', 'إملاء', 'اختبار_شامل'],
      message: 'التصنيف غير صحيح'
    }
  },
  examType: {
    type: String,
    required: [true, 'نوع الاختبار مطلوب'],
    enum: {
      values: ['quiz', 'midterm', 'final', 'practice'],
      message: 'نوع الاختبار يجب أن يكون: quiz, midterm, final, أو practice'
    }
  },
  duration: {
    type: Number,
    required: [true, 'مدة الاختبار مطلوبة'],
    min: [1, 'المدة يجب أن تكون دقيقة واحدة على الأقل']
  },
  totalMarks: {
    type: Number,
    required: [true, 'الدرجة الكاملة مطلوبة'],
    min: [1, 'الدرجة الكاملة يجب أن تكون 1 على الأقل']
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: [1000, 'التعليمات لا يمكن أن تزيد عن 1000 حرف']
  },
  questions: [questionSchema],
  isPublished: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
// In your Exam model
examSchema.virtual('isActive').get(function() {
  return this.isPublished;
});

examSchema.set('toJSON', { virtuals: true });
// تحديث updatedAt قبل الحفظ
examSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Exam = mongoose.model('Exam', examSchema);

export default Exam;