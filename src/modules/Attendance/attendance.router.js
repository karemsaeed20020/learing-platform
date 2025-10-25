import express from 'express';
import { recordDailyAttendance, getMonthlyAttendance,   getDailyAttendance,   getStudentMonthlyReport, getAttendanceReport } from './attendance.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
// import {
//   recordDailyAttendance,
//   getMonthlyAttendance,
//   getDailyAttendance,
//   getStudentMonthlyReport
// } from '../controllers/attendance.controller.js';

const router = express.Router();

router.use(protect);

router.post('/daily', recordDailyAttendance);
router.get('/monthly', getMonthlyAttendance);
router.get('/daily', getDailyAttendance);
router.get('/student/:studentId/monthly-report', getStudentMonthlyReport);
router.get("/report", getAttendanceReport);


export default router;