import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  questionText: String,
  studentAnswer: Number,
  correctAnswer: Number,
  isCorrect: Boolean,
  marks: Number,
  obtainedMarks: Number,
  options: [String]
});

const examResultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  answers: {
    type: Map,
    of: Number,
    required: true
  },
  totalScore: {
    type: Number,
    required: true
  },
  obtainedScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true
  },
  results: [resultSchema],
  submittedAt: {
    type: Date,
    default: Date.now
  },
  timeSpent: {
    type: Number,
    default: 0
  }
});

// الفهرس للأداء
examResultSchema.index({ student: 1, exam: 1 });
examResultSchema.index({ exam: 1, submittedAt: -1 });
examResultSchema.index({ student: 1, submittedAt: -1 });

const ExamResult = mongoose.model('ExamResult', examResultSchema);

export default ExamResult;