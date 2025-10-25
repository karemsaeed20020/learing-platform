import Contact from "../../../DB/models/contact.model.js";
import AppError from "../../utils/AppError.js";
import asyncHandler from "../../utils/asyncHandler.js";
import sendEmail from "../../utils/emails.js";
import mongoose from "mongoose";


// ✅ Submit Contact Form
export const createContactMessage = asyncHandler(async (req, res, next) => {
  const { name, email, message } = req.body;

  if (!name || !email  || !message) {
    return next(new AppError("جميع الحقول مطلوبة", 400));
  }

  // Save in DB
  const contact = await Contact.create({ name, email, message });

  // Send notification email (to admin)
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    html: `
      <h3>رسالة جديدة من نموذج الاتصال</h3>
      <p><strong>الاسم:</strong> ${name}</p>
      <p><strong>البريد:</strong> ${email}</p>
      <p><strong>الرسالة:</strong></p>
      <p>${message}</p>
    `,
  });

  res.status(201).json({
    success: true,
    message: "تم إرسال رسالتك بنجاح ✅، سنتواصل معك قريباً",
    data: contact,
  });
});

// ✅ Admin: Get All Messages
export const getAllContacts = asyncHandler(async (req, res) => {
  const contacts = await Contact.find().sort({ createdAt: -1 });
  res.json({ success: true, data: contacts });
});


// ✅ Reply to Contact Message
export const replyToContact = asyncHandler(async (req, res, next) => {
  const { contactId, to, subject, message } = req.body;

  if (!contactId || !to || !subject || !message) {
    return next(new AppError("جميع الحقول مطلوبة", 400));
  }

  // Validate contactId
  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    return next(new AppError("معرف الرسالة غير صالح", 400));
  }

  // Find the contact message
  const contact = await Contact.findById(contactId);
  if (!contact) {
    return next(new AppError("الرسالة غير موجودة", 404));
  }

  try {
    // Send reply email to the user
    await sendEmail({
      to: to,
      subject: subject,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h2 style="color: white; margin: 0; text-align: center;">${subject}</h2>
          </div>
          <div style="padding: 20px; background: #f8fafc;">
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          <div style="padding: 15px; background: #e2e8f0; border-radius: 0 0 10px 10px; text-align: center;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              هذا رد تلقائي من نظامنا - لا ترد على هذا البريد
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin: 5px 0 0 0;">
              © ${new Date().getFullYear()} جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      `,
    });

    // Mark as replied in database
    contact.replied = true;
    await contact.save();

    res.json({
      success: true,
      message: "تم إرسال الرد بنجاح ✅",
      data: contact,
    });

  } catch (emailError) {
    console.error('Email sending error:', emailError);
    return next(new AppError("فشل في إرسال البريد الإلكتروني", 500));
  }
});

// ✅ Delete Contact Message
export const deleteContact = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("معرف الرسالة غير صالح", 400));
  }

  const contact = await Contact.findByIdAndDelete(id);
  
  if (!contact) {
    return next(new AppError("الرسالة غير موجودة", 404));
  }

  res.json({
    success: true,
    message: "تم حذف الرسالة بنجاح ✅",
    data: contact,
  });
});