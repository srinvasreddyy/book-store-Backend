import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  forgotPassword,
  verifyPasswordOTP,
  resetPassword,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// --- Public Authentication Routes ---
router.route("/register").post(registerUser);
router.route("/login").post(loginUser);

// --- Public Password Reset Routes ---
router.route("/forgot-password").post(forgotPassword);
router.route("/verify-otp").post(verifyPasswordOTP);
router.route("/reset-password").post(resetPassword);

// --- Secured User Routes ---
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);

export default router;