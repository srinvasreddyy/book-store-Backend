import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail, getOTPEmailTemplate } from "../../utils/mailer.js";

// --- Validation Helpers ---

const isNullOrWhitespace = (value) => !value || value.trim() === "";
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(
    password,
  );

// --- Token Generation ---

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found while generating tokens.");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    // Re-throw internal errors as a 500-level ApiError
    throw new ApiError(
      500,
      error?.message || "Something went wrong while generating tokens.",
    );
  }
};

// --- Controller Functions ---

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password, role } = req.body;

  // --- Input Validation ---
  if (isNullOrWhitespace(fullName)) {
    throw new ApiError(400, "Full name is required.");
  }
  if (!isValidEmail(email)) {
    throw new ApiError(400, "A valid email address is required.");
  }
  if (!isValidPassword(password)) {
    throw new ApiError(
      400,
      "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
    );
  }

  const existedUser = await User.findOne({ email: email.toLowerCase() });

  if (existedUser) {
    throw new ApiError(
      409,
      "An account with this email address already exists.",
    );
  }

  const userToCreate = {
    fullName,
    email: email.toLowerCase(),
    password,
  };

  // Only allow setting the role if it's explicitly provided as 'ADMIN'
  if (role === "ADMIN") {
    userToCreate.role = "ADMIN";
  }

  const user = await User.create(userToCreate);

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  if (!createdUser) {
    throw new ApiError(
      500,
      "Something went wrong while registering the user. Please try again.",
    );
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully."));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  // --- Input Validation ---
  if (isNullOrWhitespace(email)) {
    throw new ApiError(400, "Email is required to log in.");
  }
  if (isNullOrWhitespace(password)) {
    throw new ApiError(400, "Password is required.");
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new ApiError(401, "Invalid user credentials."); // Generic message for security
  }

  // If a role is provided in the login request, validate it.
  if (role && user.role !== role) {
    throw new ApiError(
      403,
      `Access denied. You are not authorized to log in as a ${role}.`,
    );
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials."); // Generic message for security
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully.",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { refreshToken: 1 } }, // Use $unset for cleaner removal
    { new: true },
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is missing.");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token: User not found.");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      // This is a security measure. If an old token is used, it might be compromised.
      // Invalidate all tokens for this user.
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
      throw new ApiError(
        403,
        "Refresh token has already been used or is expired. Please log in again.",
      );
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed.",
        ),
      );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Handle JWT errors (like TokenExpiredError) gracefully
    throw new ApiError(
      401,
      error?.message || "Invalid or expired refresh token.",
    );
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);

  // --- Input Validation ---
  if (isNullOrWhitespace(oldPassword)) {
    throw new ApiError(400, "Current password is required.");
  }
  if (!isValidPassword(newPassword)) {
    throw new ApiError(
      400,
      "New password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
    );
  }
  if (oldPassword === newPassword) {
    throw new ApiError(
      400,
      "New password must be different from the old password.",
    );
  }

  if (!user) {
    // This should not happen if verifyJWT middleware is working, but it's a good safeguard.
    throw new ApiError(404, "User not found.");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "The current password you entered is incorrect.");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully."));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User details fetched successfully."));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  // --- Input Validation ---
  if (isNullOrWhitespace(fullName)) {
    throw new ApiError(400, "Full name cannot be empty.");
  }
  if (!isValidEmail(email)) {
    throw new ApiError(400, "Please provide a valid email address.");
  }

  const newEmail = email.toLowerCase();

  // Check if the new email is already taken by ANOTHER user
  if (newEmail !== req.user.email) {
    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists) {
      throw new ApiError(
        409,
        "This email is already associated with another account.",
      );
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { fullName, email: newEmail } },
    { new: true },
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(
      500,
      "Failed to update account details. Please try again.",
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully."));
});

// --- NEW: Password Reset Controllers ---

/**
 * @route POST /api/v1/users/forgot-password
 * @desc Send a password reset OTP to the user's email
 * @access Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    throw new ApiError(400, "Please provide a valid email address.");
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    role: "CUSTOMER", // Only allow for customers
  });

  // Security: Always return a success-like message to prevent user enumeration
  if (!user) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "If an account with this email exists, a password reset OTP has been sent.",
        ),
      );
  }

  // Generate a 6-digit OTP
  const otp = crypto.randomInt(100000, 1000000).toString();

  // Set OTP and 10-minute expiry
  user.passwordResetOTP = otp;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save({ validateBeforeSave: false });

  try {
    // Send the email
    const emailSubject = "Your Password Reset OTP (Valid for 10 min)";
    const emailText = `Your password reset OTP is: ${otp}. It will expire in 10 minutes.`;
    const emailHtml = getOTPEmailTemplate(otp);

    await sendEmail(user.email, emailSubject, emailText, emailHtml);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "If an account with this email exists, a password reset OTP has been sent.",
        ),
      );
  } catch (error) {
    // Clear the token if the email failed to send, so the user can try again
    user.passwordResetOTP = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    throw new ApiError(
      500,
      "Failed to send password reset email. Please try again later.",
    );
  }
});

/**
 * @route POST /api/v1/users/verify-otp
 * @desc Verify the OTP sent to the user's email
 * @access Public
 */
const verifyPasswordOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!isValidEmail(email)) {
    throw new ApiError(400, "A valid email is required.");
  }
  if (isNullOrWhitespace(otp)) {
    throw new ApiError(400, "OTP is required.");
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    passwordResetOTP: otp,
    passwordResetExpires: { $gt: Date.now() }, // Check if not expired
  });

  if (!user) {
    throw new ApiError(400, "Invalid or expired OTP. Please try again.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { email, otp }, "OTP verified successfully."));
});

/**
 * @route POST /api/v1/users/reset-password
 * @desc Reset the user's password after successful OTP verification
 * @access Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  // --- Input Validation ---
  if (!isValidEmail(email)) {
    throw new ApiError(400, "A valid email is required.");
  }
  if (isNullOrWhitespace(otp)) {
    throw new ApiError(400, "OTP is required.");
  }
  if (!isValidPassword(newPassword)) {
    throw new ApiError(
      400,
      "New password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
    );
  }
  // --- End Validation ---

  // Find user by email, OTP, and check expiry
  const user = await User.findOne({
    email: email.toLowerCase(),
    passwordResetOTP: otp,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "Invalid or expired OTP. Please request a new one.");
  }

  // Check if new password is the same as the old one
  const isSamePassword = await user.isPasswordCorrect(newPassword);
  if (isSamePassword) {
    throw new ApiError(
      400,
      "New password must be different from your current password.",
    );
  }

  // Update password
  user.password = newPassword;

  // Invalidate the OTP
  user.passwordResetOTP = undefined;
  user.passwordResetExpires = undefined;

  await user.save(); // The 'pre-save' hook will hash the password

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password has been reset successfully."));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  forgotPassword,
  verifyPasswordOTP,
  resetPassword,
};