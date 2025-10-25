// models/Cart.model.js
import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Calculate total amount before saving
cartSchema.pre('save', async function(next) {
  if (this.isModified('items') && this.items.length > 0) {
    try {
      // Populate courses to get prices
      await this.populate({
        path: 'items.course',
        select: 'price discountPrice'
      });
      
      this.totalAmount = this.items.reduce((total, item) => {
        if (item.course && item.course.price) {
          const coursePrice = item.course.discountPrice || item.course.price;
          return total + coursePrice;
        }
        return total;
      }, 0);
    } catch (error) {
      console.error('Error calculating total amount:', error);
      this.totalAmount = 0;
    }
  } else if (this.items.length === 0) {
    this.totalAmount = 0;
  }
  next();
});

// Index for better performance
cartSchema.index({ user: 1 });

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;