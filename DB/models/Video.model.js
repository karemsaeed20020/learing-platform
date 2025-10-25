import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان الفيديو مطلوب'],
    trim: true,
    maxlength: [200, 'العنوان لا يمكن أن يزيد عن 200 حرف']
  },
  description: {
    type: String,
    required: [true, 'وصف الفيديو مطلوب'],
    trim: true,
    maxlength: [1000, 'الوصف لا يمكن أن يزيد عن 1000 حرف']
  },
  videoUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  storageType: {
    type: String,
    enum: ['cloudinary', 'mega'],
    default: 'cloudinary'
  },
  megaFileId: {
    type: String
  },
  fileName: {
    type: String
  },
  publicId: {
    type: String
  },
  duration: {
    type: Number,
    default: 0
  },
  fileSize: {
    type: Number
  },
  format: {
    type: String
  },
  subject: {
    type: String,
    default: 'اللغة العربية',
    required: true
  },
  grade: {
    type: String,
    required: [true, 'الصف الدراسي مطلوب'],
    enum: ['الصف الثاني الثانوي', 'الصف الثالث الثانوي']
  },
  chapter: {
    type: String,
    required: [true, 'الفصل الدراسي مطلوب'],
    enum: [
      'النحو',
      'الصرف', 
      'الأدب',
      'البلاغة',
      'النصوص',
      'التعبير',
      'الإملاء',
      'القواعد'
    ]
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String
  }]
}, {
  timestamps: true
});

// Indexes for better performance
videoSchema.index({ grade: 1, chapter: 1 });
videoSchema.index({ uploader: 1, createdAt: -1 });
videoSchema.index({ isPublished: 1 });
videoSchema.index({ storageType: 1 });
videoSchema.index({ createdAt: -1 });

// Virtual for formatted duration
videoSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return '0:00';
  const mins = Math.floor(this.duration / 60);
  const secs = Math.floor(this.duration % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
});

// Virtual for formatted file size
videoSchema.virtual('formattedFileSize').get(function() {
  if (!this.fileSize) return '0 MB';
  const mb = this.fileSize / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
});

export default mongoose.model('Video', videoSchema);