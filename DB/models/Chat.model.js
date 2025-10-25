// import mongoose from 'mongoose';

// const messageSchema = new mongoose.Schema({
//   sender: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   receiver: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   message: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   messageType: {
//     type: String,
//     enum: ['text', 'file', 'image'],
//     default: 'text'
//   },
//   fileUrl: {
//     type: String,
//     trim: true
//   },
//   fileName: {
//     type: String,
//     trim: true
//   },
//   isRead: {
//     type: Boolean,
//     default: false
//   },
//   readAt: {
//     type: Date
//   }
// }, {
//   timestamps: true
// });

// const conversationSchema = new mongoose.Schema({
//   participants: [{
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   }],
//   lastMessage: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Message'
//   },
//   unreadCount: {
//     type: Map,
//     of: Number,
//     default: {}
//   }
// }, {
//   timestamps: true
// });

// // فهرسة للاستعلامات السريعة
// messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
// conversationSchema.index({ participants: 1 });
// conversationSchema.index({ updatedAt: -1 });

// export const Message = mongoose.model('Message', messageSchema);
// export const Conversation = mongoose.model('Conversation', conversationSchema);

// DB/models/Chat.model.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'image'],
    default: 'text'
  },
  fileUrl: {
    type: String,
    trim: true
  },
  fileName: {
    type: String,
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, {
  timestamps: true
});

// فهرسة للاستعلامات السريعة
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);