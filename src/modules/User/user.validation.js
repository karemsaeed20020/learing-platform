import joi from "joi";
// Validation schema for profile update
export const updateProfileSchema = joi.object({
  username: joi.string().min(3).max(50).optional().messages({
    "string.min": "يجب أن يكون الاسم على الأقل 3 أحرف",
    "string.max": "يجب ألا يتجاوز الاسم 50 حرفًا",
  }),
  phone: joi
    .string()
    .pattern(/^01[0-2,5]{1}[0-9]{8}$/)
    .optional()
    .messages({
      "string.pattern.base": "يرجى إدخال رقم هاتف مصري صالح",
    }),
  bio: joi.string().max(500).optional().messages({
    "string.max": "يجب ألا تتجاوز السيرة الذاتية 500 حرف",
  }),
  avatar: joi.string().uri().optional().messages({
    "string.uri": "رابط الصورة غير صالح",
  }),
});