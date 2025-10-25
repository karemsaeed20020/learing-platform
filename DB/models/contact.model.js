import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "الاسم مطلوب"], trim: true },
    email: { type: String, required: [true, "البريد الإلكتروني مطلوب"], lowercase: true },
    message: { type: String, required: [true, "الرسالة مطلوبة"], maxlength: 2000 },
    replied: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Contact = mongoose.model("Contact", contactSchema);
export default Contact;
