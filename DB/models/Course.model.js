// models/Course.model.js
import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  shortDescription: {
    type: String,
    required: true,
    maxlength: 200
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: {
    type: Number,
    min: 0
  },
  thumbnail: {
    type: String,
    required: true
  },
  previewVideo: {
    type: String
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    default: 'اللغة العربية',
    required: true
  },
  grade: {
    type: String,
    required: true,
    enum: ['الصف الثاني الثانوي', 'الصف الثالث الثانوي']
  },
  chapters: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    videos: [{
      video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true
      },
      title: String,
      duration: Number,
      order: {
        type: Number,
        default: 0
      },
      isPreview: {
        type: Boolean,
        default: false
      }
    }],
    order: {
      type: Number,
      required: true
    }
  }],
  totalDuration: {
    type: Number,
    default: 0
  },
  totalVideos: {
    type: Number,
    default: 0
  },
  level: {
    type: String,
    enum: ['مبتدئ', 'متوسط', 'متقدم'],
    default: 'مبتدئ'
  },
  tags: [{
    type: String
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  studentsEnrolled: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  requirements: [String],
  learningOutcomes: [String],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Calculate total videos and duration before saving
courseSchema.pre('save', function(next) {
  this.totalVideos = this.chapters.reduce((total, chapter) => {
    return total + chapter.videos.length;
  }, 0);
  
  this.totalDuration = this.chapters.reduce((total, chapter) => {
    return total + chapter.videos.reduce((chapterTotal, video) => {
      return chapterTotal + (video.duration || 0);
    }, 0);
  }, 0);
  
  next();
});

courseSchema.index({ grade: 1, subject: 1 });
courseSchema.index({ instructor: 1 });
courseSchema.index({ isPublished: 1, isFeatured: 1 });
courseSchema.index({ status: 1 });

const Course = mongoose.model('Course', courseSchema);

export default Course;