// models/Review.model.js
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Prevent duplicate reviews from same user on same course
reviewSchema.index({ user: 1, course: 1 }, { unique: true });

// Update course rating when review is saved
reviewSchema.post('save', async function() {
  await this.constructor.updateCourseRating(this.course);
});

// Update course rating when review is deleted
reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await doc.constructor.updateCourseRating(doc.course);
  }
});

// Static method to update course rating
reviewSchema.statics.updateCourseRating = async function(courseId) {
  const stats = await this.aggregate([
    {
      $match: { course: courseId }
    },
    {
      $group: {
        _id: '$course',
        averageRating: { $avg: '$rating' },
        numberOfReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await mongoose.model('Course').findByIdAndUpdate(courseId, {
      rating: {
        average: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal
        count: stats[0].numberOfReviews
      }
    });
  } else {
    await mongoose.model('Course').findByIdAndUpdate(courseId, {
      rating: {
        average: 0,
        count: 0
      }
    });
  }
};

const Review = mongoose.model('Review', reviewSchema);

export default Review;