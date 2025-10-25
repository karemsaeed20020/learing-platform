import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { createContactMessage, deleteContact, getAllContacts, replyToContact } from "./contact.controller.js";


const router = express.Router();

// Public route: anyone can submit
router.post("/", createContactMessage);

// Admin route: view all messages
router.get("/", protect, getAllContacts);

router.post("/reply", protect, replyToContact);
router.delete("/:id", protect, deleteContact);

export default router;
