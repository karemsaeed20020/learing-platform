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
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new AppError("يرجى تسجيل الدخول للوصول إلى هذه الميزة", StatusCodes.UNAUTHORIZED));
  }

  // 2) Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError("المستخدم غير موجود", StatusCodes.UNAUTHORIZED));
  }

  // 4) Check if password was changed after token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError("تم تغيير كلمة المرور مؤخرًا. يرجى تسجيل الدخول مرة أخرى", StatusCodes.UNAUTHORIZED));
  }

  // 5) Grant access
  req.user = currentUser;
  next();
});

// Middleware للتحقق من الصلاحيات بناءً على الدور
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("ليس لديك صلاحية للقيام بهذا الإجراء", StatusCodes.FORBIDDEN)
      );
    }
    next();
  };
};

// Middleware للتحقق إذا كان المستخدم مفعل
export const requireActive = asyncHandler(async (req, res, next) => {
  if (!req.user.isActive) {
    return next(
      new AppError("حسابك معطل. يرجى التواصل مع الدعم", StatusCodes.FORBIDDEN)
    );
  }
  next();
});

// Middleware للتحقق إذا كان المستخدم موثَق
export const requireVerified = asyncHandler(async (req, res, next) => {
  if (!req.user.isVerified) {
    return next(
      new AppError("يرجى التحقق من بريدك الإلكتروني أولاً", StatusCodes.FORBIDDEN)
    );
  }
  next();
});