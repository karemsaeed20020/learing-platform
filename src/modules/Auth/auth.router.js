import express from 'express';
import {  googleAuth, loginUser, logoutUser, registerUser, resetPasswordAfterOTP, sendVerificationOTP, verifyOTP } from './auth.controller.js';
import { registerValidation, loginValidation } from './auth.validation.js';
import isValid from '../../middlewares/validation.middleware.js';
// import { protect } from '../../middlewares/auth.middleware.js';


const router = express.Router();

// Auth routes with proper validation
router.route("/register").post(registerUser);
router.route("/login").post(isValid(loginValidation), loginUser);
router.route("/logout").post(logoutUser);
router.route("/google", googleAuth);
router.route('/send-otp').post(sendVerificationOTP);
router.route('/verify-otp').post(verifyOTP);
router.route('/reset-password-after-otp').post(resetPasswordAfterOTP);


export default router;