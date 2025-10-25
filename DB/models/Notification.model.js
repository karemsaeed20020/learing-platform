import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'exam_submitted',
      'exam_created', 
      'student_registered',
      'support_request',
      'problem_report',
      'admin_message',
      'admin_announcement',
      'grade_announcement',
      'exam_graded',
      'new_exam',
      'system_alert',
      'child_progress',
      'child_attendance',
      'child_exam_result',
      'parent_announcement',
      'parent_message'
    ]
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  actionUrl: String,
  relatedEntity: {
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true
});

// فهارس للأداء
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;