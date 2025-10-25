import joi from 'joi';


// backend/src/routes/auth.validation.js
export const registerValidation = joi.object({
  username: joi.string().min(3).max(50).required().messages({
    "string.empty": "اسم المستخدم مطلوب",
    "string.min": "اسم المستخدم يجب أن يكون 3 أحرف على الأقل",
    "string.max": "اسم المستخدم يجب أن لا يتجاوز 50 حرف",
  }),
  email: joi.string().email().required().messages({
    "string.empty": "البريد الإلكتروني مطلوب",
    "string.email": "يرجى إدخال بريد إلكتروني صحيح",
  }),
  phone: joi.string()
    .pattern(/^01[0-2,5]{1}[0-9]{8}$/)
    .required()
    .messages({
      "string.empty": "رقم الهاتف مطلوب",
      "string.pattern.base": "يرجى إدخال رقم هاتف مصري صحيح",
    }),
  password: joi.string().min(6).required().messages({
    "string.empty": "كلمة المرور مطلوبة",
    "string.min": "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
  }),
  confirmPassword: joi.string().valid(joi.ref("password")).required().messages({
    "any.only": "كلمتا المرور غير متطابقتين",
    "string.empty": "تأكيد كلمة المرور مطلوب",
  }),
  grade: joi.string().optional(), // Add this line
});



export const loginValidation = joi.object({
  email: joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Please provide a valid email",
  }),
  password: joi.string().required().messages({
    "string.empty": "Password is required",
  }),
});


export const forgotPasswordValidation = joi.object({
  email: joi.string().email().required().messages({
    "string.empty": "البريد الإلكتروني مطلوب",
    "string.email": "يرجى إدخال بريد إلكتروني صالح",
  }),
});
