import mongoose from "mongoose";
import validator from "validator";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "اسم المستخدم مطلوب"],
      trim: true,
      minlength: [3, "يجب أن يكون الاسم على الأقل 3 أحرف"],
      maxlength: [50, "يجب ألا يتجاوز الاسم 50 حرفًا"],
      unique: true,
    },
    email: {
      type: String,
      required: [true, "البريد الإلكتروني مطلوب"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "يرجى تقديم بريد إلكتروني صالح"],
    },
    password: {
      type: String,
      required: [true, "كلمة المرور مطلوبة"],
      minlength: [6, "يجب أن تكون كلمة المرور على الأقل 6 أحرف"],
      select: false,
    },
    confirmPassword: {
      type: String,
      required: [true, "تأكيد كلمة المرور مطلوب"],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: "كلمات المرور غير متطابقة",
      },
    },
    role: {
      type: String,
      enum: ["student", "parent", "admin"],
      default: "student",
    },
     studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    children: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    
    // For student: reference to parent
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    grade: {
      type: String,
      enum: [
        "الصف الثاني الثانوي", 
        "الصف الثالث الثانوي",
        "غير محدد"
      ],
      default: "غير محدد",
    },
    avatar: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxlength: [500, "يجب ألا تتجاوز السيرة الذاتية 500 حرف"],
      default: "",
    },
    phone: {
  type: String,
  required: [true, "رقم الهاتف مطلوب"],
  validate: {
    validator: function (v) {
      // ✅ CORRECTED REGEX: only 010, 011, 012, 015
      return /^01[0125]\d{8}$/.test(v);
    },
    message: "يرجى إدخال رقم هاتف مصري صالح (يبدأ بـ 010، 011، 012، أو 015)",
  },
},
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
     passwordResetOTP: String,
    passwordResetOTPExpires: Date,
    verificationOTP: String,
    verificationOTPExpires: Date,
    refreshTokens: [
      {
        token: String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: Date,
      },
    ],
  },
  { timestamps: true }
);

// Hash Password Before Saving 
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  this.confirmPassword = undefined;
  next();
});

// Set passwordChangedAt when password is changed
userSchema.pre("save", function(next) {
  if (!this.isModified("password") || this.isNew) {
    return  next();
  }
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Compare entered password with hashed one
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password was changed after JWT issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Generate Password Reset Token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Generate 6-digit OTP
userSchema.methods.createPasswordResetOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  this.passwordResetOTP = otp;
  this.passwordResetOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};


userSchema.methods.createVerificationOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  this.verificationOTP = otp;
  this.verificationOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};
const User = mongoose.model("User", userSchema);
export default User;
