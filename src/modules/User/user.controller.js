import { StatusCodes } from "http-status-codes";
import User from "../../../DB/models/user.model.js";
import AppError from "../../utils/AppError.js";
import asyncHandler from "../../utils/asyncHandler.js";
// import { updateProfileSchema } from "./user.validation.js";
import cloudinary from "../../utils/cloudinary.js";
import bcrypt from 'bcryptjs';


// // ✅ Get Profile

// // ✅ Get Profile
// export const getProfile = async (req, res) => {
//   try {
//     const userId = req.user?._id;
//     if (!userId) {
//       return res.status(401).json({ message: "غير مصرح لك" });
//     }

//     const user = await User.findById(userId).select(
//       "_id username email phone avatar bio createdAt"
//     );

//     if (!user) {
//       return res.status(404).json({ message: "المستخدم غير موجود" });
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         user: {
//           _id: user._id,
//           username: user.username || "",
//           email: user.email || "",
//           phone: user.phone || "",
//           avatar: user.avatar || "",
//           bio: user.bio || "",
//           createdAt: user.createdAt,
//         },
//       },
//     });
//   } catch (err) {
//     console.error("Get Profile Error:", err);
//     return res.status(500).json({ 
//       success: false,
//       message: "فشل تحميل الملف الشخصي" 
//     });
//   }
// };

// // ✅ Update Profile
// export const updateProfile = async (req, res) => {
//   try {
//     const userId = req.user?._id;
//     if (!userId) {
//       return res.status(401).json({ 
//         success: false,
//         message: "غير مصرح لك" 
//       });
//     }

//     const { username, phone, password } = req.body;

//     // Find user
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ 
//         success: false,
//         message: "المستخدم غير موجود" 
//       });
//     }

//     let hasChanges = false;

//     // Update fields only if they are provided and different
//     if (username && username !== user.username) {
//       // Check if username already exists
//       const existingUser = await User.findOne({ username });
//       if (existingUser && existingUser._id.toString() !== userId.toString()) {
//         return res.status(400).json({
//           success: false,
//           message: "اسم المستخدم موجود بالفعل"
//         });
//       }
//       user.username = username;
//       hasChanges = true;
//     }

//     if (phone !== undefined && phone !== user.phone) {
//       user.phone = phone;
//       hasChanges = true;
//     }

//     // Update avatar if file uploaded
//     if (req.file) {
//       user.avatar = req.file.path; // or your storage URL
//       hasChanges = true;
//     }

//     // Update password if provided
//     if (password) {
//       if (password.length < 6) {
//         return res.status(400).json({
//           success: false,
//           message: "كلمة المرور يجب أن تكون至少 6 أحرف"
//         });
//       }
//       user.password = password; // make sure pre-save hook hashes it
//       hasChanges = true;
//     }

//     if (!hasChanges) {
//       return res.status(400).json({
//         success: false,
//         message: "لم تقم بإجراء أي تغييرات"
//       });
//     }

//     await user.save();

//     return res.status(200).json({
//       success: true,
//       data: {
//         user: {
//           _id: user._id,
//           username: user.username || "",
//           email: user.email || "",
//           phone: user.phone || "",
//           avatar: user.avatar || "",
//           bio: user.bio || "",
//           createdAt: user.createdAt,
//         },
//       },
//       message: "تم تحديث الملف الشخصي بنجاح"
//     });
//   } catch (err) {
//     console.error("Update Profile Error:", err);
    
//     // Handle duplicate key errors
//     if (err.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: "اسم المستخدم موجود بالفعل"
//       });
//     }
    
//     return res.status(500).json({ 
//       success: false,
//       message: "فشل تحديث الملف الشخصي" 
//     });
//   }
// };

// ✅ Get profile
// export const getProfile = asyncHandler(async (req, res, next) => {
//   const user = await User.findById(req.user._id).select("-password -confirmPassword");
//   if (!user) {
//     return next(new AppError("المستخدم غير موجود", StatusCodes.NOT_FOUND));
//   }

//   res.status(200).json({
//     success: true,
//     data: { user },
//   });
// });



// export const updateProfile = async (req, res, next) => {
//   try {
//     const userId = req.user.id;
//     const updates = {};

//     if (req.body.username) updates.username = req.body.username;
//     if (req.body.phone) updates.phone = req.body.phone;
//     if (req.body.bio) updates.bio = req.body.bio;

//     if (req.body.password) {
//       if (req.body.password !== req.body.confirmPassword) {
//         return res.status(400).json({ message: "كلمات المرور غير متطابقة" });
//       }
//       const salt = await bcrypt.genSalt(10);
//       updates.password = await bcrypt.hash(req.body.password, salt);
//     }

//     if (req.file) {
//       const result = await cloudinary.uploader.upload(req.file.path, {
//         folder: "avatars",
//       });
//       updates.avatar = result.secure_url;
//     }

//     const user = await User.findByIdAndUpdate(userId, updates, {
//       new: true,
//       runValidators: true,
//     }).select("-password");

//     res.json({ success: true, message: "تم التحديث بنجاح ✅", data: { user } });
//   } catch (err) {
//     next(err);
//   }
// };

// ✅ Get Profile (Fixed)
export const getProfile = asyncHandler(async (req, res, next) => {
  console.log('Fetching profile for user ID:', req.user._id);
  
  const user = await User.findById(req.user._id).select("-password -confirmPassword -refreshTokens");
  
  if (!user) {
    console.log('User not found for ID:', req.user._id);
    return next(new AppError("المستخدم غير موجود", StatusCodes.NOT_FOUND));
  }

  console.log('User found:', user.username);
  
  res.status(StatusCodes.OK).json({
    success: true,
    data: { user },
  });
});

// ✅ Update Profile (Fixed)
export const updateProfile = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { username, phone, bio, password, confirmPassword } = req.body;

  console.log('Updating profile for user:', userId);
  console.log('Update data:', { username, phone, bio, hasPassword: !!password });

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError('المستخدم غير موجود', StatusCodes.NOT_FOUND));
  }

  let hasChanges = false;
  const updates = {};

  // Update username
  if (username && username !== user.username) {
    const existingUser = await User.findOne({ username, _id: { $ne: userId } });
    if (existingUser) {
      return next(new AppError('اسم المستخدم موجود بالفعل', StatusCodes.BAD_REQUEST));
    }
    updates.username = username;
    hasChanges = true;
  }

  // Update phone
  if (phone !== undefined && phone !== user.phone) {
    updates.phone = phone;
    hasChanges = true;
  }

  // Update bio
  if (bio !== undefined && bio !== user.bio) {
    updates.bio = bio;
    hasChanges = true;
  }

  // Update avatar if file uploaded
  if (req.file) {
    try {
      console.log('Uploading avatar to cloudinary...');
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'avatars',
      });
      updates.avatar = result.secure_url;
      hasChanges = true;
      console.log('Avatar uploaded successfully:', result.secure_url);
    } catch (error) {
      console.error('Avatar upload error:', error);
      return next(new AppError('فشل في رفع الصورة', StatusCodes.INTERNAL_SERVER_ERROR));
    }
  }

  // Update password if provided
  if (password) {
    if (password.length < 6) {
      return next(new AppError('كلمة المرور يجب أن تكون至少 6 أحرف', StatusCodes.BAD_REQUEST));
    }
    if (password !== confirmPassword) {
      return next(new AppError('كلمات المرور غير متطابقة', StatusCodes.BAD_REQUEST));
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    updates.password = await bcrypt.hash(password, salt);
    hasChanges = true;
  }

  if (!hasChanges) {
    return next(new AppError('لم تقم بإجراء أي تغييرات', StatusCodes.BAD_REQUEST));
  }

  console.log('Final updates to apply:', updates);

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    updates,
    {
      new: true,
      runValidators: true
    }
  ).select('-password -confirmPassword -refreshTokens');

  if (!updatedUser) {
    return next(new AppError('فشل في تحديث الملف الشخصي', StatusCodes.INTERNAL_SERVER_ERROR));
  }

  res.status(StatusCodes.OK).json({
    success: true, // Changed from status to success
    message: 'تم تحديث الملف الشخصي بنجاح',
    data: {
      user: updatedUser
    }
  });
});
// ✅ Get All Users (Admin only)
export const getAllUsers = asyncHandler(async (req, res, next) => {
  // ممكن تحدد صلاحيات الأدمن فقط
  // if (req.user.role !== "admin") {
  //   return next(new AppError("غير مصرح لك", StatusCodes.FORBIDDEN));
  // }

  const users = await User.find().select("-password -confirmPassword");

  res.status(200).json({
    success: true,
    results: users.length,
    data: users,
  });
});

// ✅ Get All Students (Admin only)
export const getStudents = asyncHandler(async (req, res, next) => {
  // 1) Check admin access
  if (!req.user || req.user.role !== "admin") {
    return next(new AppError("غير مصرح لك بالوصول إلى هذه البيانات", StatusCodes.FORBIDDEN));
  }

  // Get pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // 2) Fetch students with grade field
  const students = await User.find({ role: "student" })
    .select("-password -confirmPassword -refreshTokens") // Exclude sensitive fields
    .select("username email phone grade role isActive createdAt") // Include grade field
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  // Get total count
  const totalStudents = await User.countDocuments({ role: "student" });
  const totalPages = Math.ceil(totalStudents / limit);

  // 3) Respond with students data including grade
  res.status(StatusCodes.OK).json({
    status: "success",
    count: students.length,
    pagination: {
      currentPage: page,
      totalPages,
      totalStudents,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    data: {
      students
    },
  });
});

// In your backend user.controller.js
export const deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Check admin access
  if (!req.user || req.user.role !== "admin") {
    return next(new AppError("غير مصرح لك بهذا الإجراء", StatusCodes.FORBIDDEN));
  }

  const user = await User.findById(id);
  if (!user) {
    return next(new AppError("المستخدم غير موجود", StatusCodes.NOT_FOUND));
  }

  // Prevent admin from deleting themselves
  if (user._id.toString() === req.user._id.toString()) {
    return next(new AppError("لا يمكنك حذف حسابك الخاص", StatusCodes.BAD_REQUEST));
  }

  await User.findByIdAndDelete(id);

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "تم حذف المستخدم بنجاح",
  });
});

// ✅ Create Student (Admin only)
export const createStudent = asyncHandler(async (req, res, next) => {
  // Check admin access
  if (!req.user || req.user.role !== "admin") {
    return next(new AppError("غير مصرح لك بهذا الإجراء", StatusCodes.FORBIDDEN));
  }

  const { username, email, phone, password, confirmPassword, grade } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    return next(new AppError("البريد الإلكتروني أو اسم المستخدم موجود بالفعل", StatusCodes.BAD_REQUEST));
  }

  // Create student
  const student = await User.create({
    username,
    email,
    phone,
    password,
    confirmPassword,
    grade: grade || "غير محدد",
    role: "student",
    isActive: true,
    isVerified: true
  });

  // Remove password from response
  const studentResponse = await User.findById(student._id).select("-password -confirmPassword");

  res.status(StatusCodes.CREATED).json({
    status: "success",
    message: "تم إنشاء الطالب بنجاح",
    data: {
      student: studentResponse
    }
  });
});

// ✅ Update Student (Admin only)
export const updateStudent = asyncHandler(async (req, res, next) => {
  // Check admin access
  if (!req.user || req.user.role !== "admin") {
    return next(new AppError("غير مصرح لك بهذا الإجراء", StatusCodes.FORBIDDEN));
  }

  const { id } = req.params;
  const { username, email, phone, grade, isActive } = req.body;

  // Find student
  const student = await User.findOne({ _id: id, role: "student" });
  if (!student) {
    return next(new AppError("الطالب غير موجود", StatusCodes.NOT_FOUND));
  }

  // Check if email or username already exists (excluding current student)
  if (email && email !== student.email) {
    const existingEmail = await User.findOne({ email, _id: { $ne: id } });
    if (existingEmail) {
      return next(new AppError("البريد الإلكتروني موجود بالفعل", StatusCodes.BAD_REQUEST));
    }
  }

  if (username && username !== student.username) {
    const existingUsername = await User.findOne({ username, _id: { $ne: id } });
    if (existingUsername) {
      return next(new AppError("اسم المستخدم موجود بالفعل", StatusCodes.BAD_REQUEST));
    }
  }

  // Prepare update data
  const updateData = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (phone) updateData.phone = phone;
  if (grade) updateData.grade = grade;
  if (typeof isActive === 'boolean') updateData.isActive = isActive;

  // Update student
  const updatedStudent = await User.findByIdAndUpdate(
    id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  ).select("-password -confirmPassword -refreshTokens");

  if (!updatedStudent) {
    return next(new AppError("فشل تحديث بيانات الطالب", StatusCodes.INTERNAL_SERVER_ERROR));
  }

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "تم تحديث بيانات الطالب بنجاح",
    data: {
      student: updatedStudent
    }
  });
});

// ✅ Get Single Student (Admin only)
export const getStudent = asyncHandler(async (req, res, next) => {
  // Check admin access
  if (!req.user || req.user.role !== "admin") {
    return next(new AppError("غير مصرح لك بالوصول إلى هذه البيانات", StatusCodes.FORBIDDEN));
  }

  const { id } = req.params;

  const student = await User.findOne({ _id: id, role: "student" })
    .select("-password -confirmPassword -refreshTokens");

  if (!student) {
    return next(new AppError("الطالب غير موجود", StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.OK).json({
    status: "success",
    data: {
      student
    }
  });
});