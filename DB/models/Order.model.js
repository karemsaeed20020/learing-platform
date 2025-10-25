// models/Order.model.js
import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  title: String,
  thumbnail: String
}, { _id: true });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['vodafone_cash', 'mobinil_cash'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected', 'failed'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['pending_payment', 'processing', 'completed', 'cancelled'],
    default: 'pending_payment'
  },
  customerPhone: String,
  paymentProof: {
    receiptImage: String,
    transactionId: String,
    submittedAt: Date
  },
  paymentInstructions: {
    name: String,
    instructions: [String],
    phoneNumber: String,
    accountName: String
  },
  adminNotes: String,
  completedAt: Date
}, {
  timestamps: true
});

// Index for better performance
orderSchema.index({ user: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;