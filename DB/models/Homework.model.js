import mongoose from 'mongoose';

const homeworkSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان الواجب مطلوب'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'وصف الواجب مطلوب'],
    trim: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
    enum: ['text', 'file', 'mixed'],
    default: 'text'
  },
  content: {
    text: {
      type: String,
      trim: true
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
    }]
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  dueDate: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

const Homework = mongoose.model('Homework', homeworkSchema);
export default Homework;