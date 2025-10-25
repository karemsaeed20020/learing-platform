// import jwt from "jsonwebtoken";
// import AppError from "../utils/AppError.js";
// import { StatusCodes } from "http-status-codes";
// import { asyncHandler } from "../utils/asyncHandler.js";
// import User from "../../DB/models/user.model.js";

// export const protect = asyncHandler(async (req, res, next) => {
//   // 1) Get token from cookie or header
//   let token;
//   if (req.cookies.jwt) {
//     token = req.cookies.jwt;
//   } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
//     token = req.headers.authorization.split(" ")[1];
//   }

//   if (!token) {
//     return next(new AppError("يرجى تسجيل الدخول للوصول إلى هذه الميزة", StatusCodes.UNAUTHORIZED));
//   }

//   // 2) Verify token
//   const decoded = jwt.verify(token, process.env.JWT_SECRET);

//   // 3) Check if user still exists
//   const currentUser = await User.findById(decoded.id);
//   if (!currentUser) {
//     return next(new AppError("المستخدم غير موجود", StatusCodes.UNAUTHORIZED));
//   }

//   // 4) Check if password was changed after token was issued
//   if (currentUser.changedPasswordAfter(decoded.iat)) {
//     return next(new AppError("تم تغيير كلمة المرور مؤخرًا. يرجى تسجيل الدخول مرة أخرى", StatusCodes.UNAUTHORIZED));
//   }

//   // 5) Grant access
//   req.user = currentUser;
//   next();
// });

import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";
import { StatusCodes } from "http-status-codes";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../../DB/models/user.model.js";

export const protect = asyncHandler(async (req, res, next) => {
  // 1) Get token from cookie or header
  let token;
  
  console.log('🔐 Auth Debug:', {
    url: req.url,
    hasAuthHeader: !!req.headers.authorization,
    authHeader: req.headers.authorization ? 'Present' : 'Missing'
  });

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    console.log('✅ Token found in Authorization header');
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
    console.log('✅ Token found in cookies');
  }

  if (!token) {
    console.log('❌ No token found');
    return next(new AppError("يرجى تسجيل الدخول للوصول إلى هذه الميزة", StatusCodes.UNAUTHORIZED));
  }

  // 2) Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified for user:', decoded.id);
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    return next(new AppError("رمز الدخول غير صالح", StatusCodes.UNAUTHORIZED));
  }

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    console.log('❌ User not found in database');
    return next(new AppError("المستخدم غير موجود", StatusCodes.UNAUTHORIZED));
  }

  // 4) Check if user is active
  if (!currentUser.isActive) {
    console.log('❌ User account is inactive');
    return next(new AppError("حسابك معطل. يرجى التواصل مع الدعم", StatusCodes.FORBIDDEN));
  }

  // 5) Grant access
  req.user = currentUser;
  console.log('✅ Access granted for user:', currentUser.email);
  next();
});

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("يرجى تسجيل الدخول أولاً", StatusCodes.UNAUTHORIZED));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("ليس لديك صلاحية للقيام بهذا الإجراء", StatusCodes.FORBIDDEN)
      );
    }
    
    next();
  };
};
