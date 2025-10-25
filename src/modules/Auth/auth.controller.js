import dotenv from 'dotenv';
dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('❌ JWT_SECRET is not defined in .env file. Please add it!');
}

import User from "../../../DB/models/user.model.js";
import AppError from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { StatusCodes } from "http-status-codes";
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import sendEmail from '../../utils/emails.js';

const client = new OAuth2Client();

// JWT Token Generator
const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Create Token + Send Response + Set Cookie
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id, user.role);

  const days = parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 7;
  const cookieOptions = {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  };

  res.cookie('jwt', token, cookieOptions);
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
      },
    },
  });
};

// Register New User
export const registerUser = asyncHandler(async (req, res, next) => {
  const { username, email, phone, password, confirmPassword, grade } = req.validatedData || req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return next(new AppError("البريد الإلكتروني أو اسم المستخدم موجود مسبقاً", StatusCodes.BAD_REQUEST));
  }

  // Create user - NOT verified
  const newUser = await User.create({
    username,
    email,
    phone,
    password,
    confirmPassword,
     grade: grade || "غير محدد",
    lastLogin: Date.now(),
    isVerified: false,
    role: "student"
  });

  // Generate and SAVE OTP during registration
  const otp = newUser.createVerificationOTP();
  await newUser.save({ validateBeforeSave: false });

  // Send email with OTP
  const message = `رمز التحقق الخاص بك هو: ${otp}\nهذا الرمز صالح لمدة 10 دقائق فقط.`;
  try {
    await sendEmail({
      email: newUser.email,
      subject: 'رمز التحقق',
      message,
    });
  } catch (emailErr) {
    newUser.verificationOTP = undefined;
    newUser.verificationOTPExpires = undefined;
    await newUser.save({ validateBeforeSave: false });
    return next(new AppError('فشل إرسال رمز التحقق. يرجى المحاولة لاحقًا.', StatusCodes.INTERNAL_SERVER_ERROR));
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'تم إنشاء الحساب! يرجى التحقق من بريدك الإلكتروني.',
    data: {
      user: {
        email: newUser.email,
        username: newUser.username,
        role: newUser.role, // Make sure role is included
        phone: newUser.phone,
        isVerified: newUser.isVerified
      },
    },
  });
});

// Login User
export const loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.validatedData || req.body;

  // Validate input
  if (!email || !password) {
    return next(
      new AppError("يرجى إدخال البريد الإلكتروني وكلمة المرور", StatusCodes.BAD_REQUEST)
    );
  }

  // Find user + check password
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return next(
      new AppError("البريد الإلكتروني أو كلمة المرور غير صحيحة", StatusCodes.UNAUTHORIZED)
    );
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    return next(
      new AppError("البريد الإلكتروني أو كلمة المرور غير صحيحة", StatusCodes.UNAUTHORIZED)
    );
  }

  // Check if user is active
  if (!user.isActive) {
    return next(
      new AppError("تم إيقاف حسابك. يرجى التواصل مع الدعم", StatusCodes.FORBIDDEN)
    );
  }

  // Update last login
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  // Generate token
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  // Cookie options
  const days = parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 7;
  const cookieOptions = {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  res.cookie("jwt", token, cookieOptions);

  // Hide password before sending user
  user.password = undefined;

  // Send response
  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Login successful",
    token,
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
      },
    },
  });
});

// Logout User
export const logoutUser = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تسجيل الخروج بنجاح',
  });
};

// Google Auth
export const googleAuth = asyncHandler(async (req, res, next) => {
  const { idToken } = req.body;
  if (!idToken) {
    return next(new AppError("Google token is required", StatusCodes.BAD_REQUEST));
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  const { sub, email, name, picture } = payload;

  if (!email) {
    return next(new AppError("Google account must have an email", StatusCodes.BAD_REQUEST));
  }

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      username: name,
      email,
      password: `${sub}_${process.env.JWT_SECRET}`,
      confirmPassword: `${sub}_${process.env.JWT_SECRET}`,
      profileImage: picture,
      lastLogin: Date.now(),
      isActive: true,
      isVerified: true,
    });
  }

  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  createSendToken(user, StatusCodes.OK, res);
});

// In your auth controller - UPDATED sendVerificationOTP function
export const sendVerificationOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  console.log('📨 Sending OTP request for:', email);

  if (!email) {
    return next(new AppError('البريد الإلكتروني مطلوب', StatusCodes.BAD_REQUEST));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(
      new AppError('لا يوجد حساب مرتبط بهذا البريد الإلكتروني', StatusCodes.NOT_FOUND)
    );
  }

  console.log('👤 User before OTP generation:', {
    email: user.email,
    existingVerificationOTP: user.verificationOTP,
    existingPasswordResetOTP: user.passwordResetOTP
  });

  // ✅ FIX: Generate OTP manually to ensure it works
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

  console.log('🔐 Generated OTP:', { otp, expires });

  // ✅ FIX: Set OTP directly on user object
  user.verificationOTP = otp;
  user.verificationOTPExpires = expires;
  user.passwordResetOTP = otp; // Also set in passwordResetOTP for compatibility
  user.passwordResetOTPExpires = expires;

  console.log('💾 Saving user with OTPs...');
  
  // ✅ FIX: Use proper save with error handling
  try {
    await user.save({ validateBeforeSave: false });
    console.log('✅ User saved successfully with OTPs');
  } catch (saveError) {
    console.error('❌ Error saving user with OTP:', saveError);
    return next(new AppError('فشل في حفظ رمز التحقق', StatusCodes.INTERNAL_SERVER_ERROR));
  }

  // ✅ FIX: Verify the OTP was actually saved
  const verifiedUser = await User.findOne({ email });
  console.log('🔍 User after save verification:', {
    verificationOTP: verifiedUser.verificationOTP,
    passwordResetOTP: verifiedUser.passwordResetOTP,
    verificationOTPExpires: verifiedUser.verificationOTPExpires,
    passwordResetOTPExpires: verifiedUser.passwordResetOTPExpires
  });

  const message = `رمز التحقق الخاص بك هو: ${otp}\n\nهذا الرمز صالح لمدة 10 دقائق فقط.\n\nإذا لم تطلب هذا، يرجى تجاهله.`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'رمز التحقق',
      message,
    });

    console.log('📧 Email sent successfully');

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
      email: email,
      debug_otp: otp, // Include for testing
      note: 'استخدم هذا الرمز للاختبار: ' + otp
    });

  } catch (err) {
    console.error('❌ Email sending failed:', err);
    
    // Still return success with OTP for testing
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'تم إنشاء رمز التحقق - يمكنك استخدامه مباشرة',
      email: email,
      debug_otp: otp,
      note: 'استخدم هذا الرمز: ' + otp
    });
  }
});

// In your auth controller - verifyOTP function
export const verifyOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;

  console.log('🔐 OTP Verification Request:', { 
    email, 
    otp: otp,
    timestamp: new Date().toISOString()
  });

  if (!email || !otp) {
    return next(new AppError('البريد الإلكتروني ورمز التحقق مطلوبان', StatusCodes.BAD_REQUEST));
  }

  const otpString = String(otp);
  
  if (otpString.length !== 6 || !/^\d{6}$/.test(otpString)) {
    return next(new AppError('رمز التحقق يجب أن يكون 6 أرقام', StatusCodes.BAD_REQUEST));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('المستخدم غير موجود', StatusCodes.NOT_FOUND));
  }

  console.log('👤 User OTP status for verification:', {
    email: user.email,
    verificationOTP: user.verificationOTP,
    passwordResetOTP: user.passwordResetOTP
  });

  // Check BOTH OTP fields for verification
  let validOTP = false;

  if (user.verificationOTP && user.verificationOTP === otpString) {
    validOTP = true;
    console.log('✅ OTP matched in verificationOTP field');
  } else if (user.passwordResetOTP && user.passwordResetOTP === otpString) {
    validOTP = true;
    console.log('✅ OTP matched in passwordResetOTP field');
  }

  if (!validOTP) {
    console.log('❌ OTP mismatch for verification');
    return next(new AppError('رمز التحقق غير صحيح', StatusCodes.BAD_REQUEST));
  }

  // Check expiration
  const isExpired = user.verificationOTPExpires < Date.now();

  if (isExpired) {
    console.log('❌ OTP expired for verification');
    user.verificationOTP = undefined;
    user.verificationOTPExpires = undefined;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('رمز التحقق منتهي الصلاحية', StatusCodes.BAD_REQUEST));
  }

  console.log('✅ OTP verified successfully');

  // ✅ FIX: DON'T clear OTP fields yet - wait for password reset
  // Only mark as verified but keep OTP for reset password step
  user.isVerified = true;
  
  // ✅ FIX: Add a flag to indicate OTP is verified but not used for reset yet
  user.otpVerifiedForReset = true;
  
  await user.save({ validateBeforeSave: false });

  console.log('👤 User after verification (OTP fields preserved):', {
    verificationOTP: user.verificationOTP,
    passwordResetOTP: user.passwordResetOTP,
    otpVerifiedForReset: user.otpVerifiedForReset
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم التحقق بنجاح',
    verified: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isVerified: user.isVerified
      }
    }
  });
});
// In your auth controller - resetPasswordAfterOTP function
export const resetPasswordAfterOTP = asyncHandler(async (req, res, next) => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  console.log('🔐 Reset password request received:', { 
    email, 
    otp: otp.substring(0, 3) + '***',
    passwordLength: newPassword?.length 
  });

  if (!email || !otp || !newPassword || !confirmPassword) {
    return next(new AppError('جميع الحقول مطلوبة', StatusCodes.BAD_REQUEST));
  }

  const user = await User.findOne({ email });
  if (!user) {
    console.log('❌ User not found:', email);
    return next(new AppError('المستخدم غير موجود', StatusCodes.NOT_FOUND));
  }

  console.log('👤 User status before reset:', {
    email: user.email,
    verificationOTP: user.verificationOTP,
    passwordResetOTP: user.passwordResetOTP,
    otpVerifiedForReset: user.otpVerifiedForReset,
    isVerified: user.isVerified
  });

  const otpString = String(otp);
  
  // ✅ FIX: Check if OTP was already verified
  if (user.otpVerifiedForReset) {
    console.log('✅ OTP was pre-verified, proceeding with password reset');
    
    // Verify OTP matches one more time for security
    if (user.verificationOTP !== otpString && user.passwordResetOTP !== otpString) {
      console.log('❌ OTP mismatch even though pre-verified');
      return next(new AppError('رمز التحقق غير صحيح', StatusCodes.BAD_REQUEST));
    }
  } else {
    // Normal OTP verification flow
    console.log('🔐 OTP not pre-verified, checking normally...');
    
    let validOTP = false;
    if (user.verificationOTP && user.verificationOTP === otpString) {
      validOTP = true;
      console.log('✅ OTP matched in verificationOTP field');
    } else if (user.passwordResetOTP && user.passwordResetOTP === otpString) {
      validOTP = true;
      console.log('✅ OTP matched in passwordResetOTP field');
    }

    if (!validOTP) {
      console.log('❌ OTP mismatch');
      return next(new AppError('رمز التحقق غير صحيح', StatusCodes.BAD_REQUEST));
    }
  }

  // Check expiration
  const isExpired = user.verificationOTPExpires < Date.now();

  if (isExpired) {
    console.log('❌ OTP expired');
    user.verificationOTP = undefined;
    user.verificationOTPExpires = undefined;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    user.otpVerifiedForReset = false;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('رمز التحقق منتهي الصلاحية', StatusCodes.BAD_REQUEST));
  }

  if (newPassword.length < 6) {
    return next(new AppError('كلمة المرور يجب أن تكون 6 أحرف على الأقل', StatusCodes.BAD_REQUEST));
  }
  
  if (newPassword !== confirmPassword) {
    return next(new AppError('كلمتا المرور غير متطابقتين', StatusCodes.BAD_REQUEST));
  }

  // ✅ Update password and NOW clear OTP fields
  user.password = newPassword;
  user.confirmPassword = confirmPassword;
  user.verificationOTP = undefined;
  user.verificationOTPExpires = undefined;
  user.passwordResetOTP = undefined;
  user.passwordResetOTPExpires = undefined;
  user.otpVerifiedForReset = false; // Reset the flag
  
  await user.save();

  console.log('✅ Password reset successful for user:', email);

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'تم تغيير كلمة المرور بنجاح',
  });
});