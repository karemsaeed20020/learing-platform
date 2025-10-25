// import express from 'express';
// import { protect } from '../../middlewares/auth.middleware.js';
// import { createStudent, deleteUser, getAllUsers, getProfile, getStudent, getStudents, updateProfile, updateStudent } from './user.controller.js';
// import upload from '../../middlewares/multer.middleware.js';
// // import { protect } from '../../middlewares/auth.middleware.js';
// // import { getProfile, updateProfile } from './user.controller.js';
// // import isValid from '../../middlewares/validation.middleware.js';
// // import { updateProfileSchema } from './user.validation.js';

// const router = express.Router();

// router.get("/profile", protect, getProfile);

// // ✅ Update Profile (with avatar upload)
// router.patch(
//   "/profile",
//   protect,
//   upload.single("avatar"),
//   updateProfile
// );

// router.get('/students', protect, getStudents); // ← must come BEFORE generic GET /
// // router.route("/profile").get(protect,getProfile).patch(protect, isValid(updateProfileSchema),updateProfile);



// // ✅ Get All Users (Admin only)
// router.get("/", getAllUsers);
// router.delete('/:id', protect,deleteUser);
// router.post('/students', protect, createStudent);
// router.get('/students/:id', protect, getStudent); // Get single student
// router.patch('/students/:id', protect, updateStudent); // Update student





// export default router;

import express from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { 
  createStudent, 
  deleteUser, 
  getAllUsers, 
  getProfile, 
  getStudent, 
  getStudents, 
  updateProfile, 
  updateStudent 
} from './user.controller.js';
import upload from '../../middlewares/multer.middleware.js';

const router = express.Router();

// Profile routes - should be first
router.get("/profile", protect, getProfile);
router.patch("/profile", protect, upload.single("avatar"), updateProfile);

// Student routes
router.get('/students', protect, getStudents);
router.post('/students', protect, createStudent);
router.get('/students/:id', protect, getStudent);
router.patch('/students/:id', protect, updateStudent);

// User management routes
router.delete('/:id', protect, deleteUser);
router.get("/", protect, getAllUsers);

export default router;