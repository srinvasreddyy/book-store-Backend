import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// --- Validation Helpers ---

const isNullOrWhitespace = (value) => !value || value.trim() === "";
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password) => /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password);
const isValidUsername = (username) => /^[a-zA-Z0-9_]{3,20}$/.test(username);


// --- Token Generation ---

const generateAccessAndRefreshTokens = async(userId) => {
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
        throw new ApiError(500, error?.message || "Something went wrong while generating tokens.");
    }
};

// --- Controller Functions ---

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body;

    // --- Input Validation ---
    if (isNullOrWhitespace(fullName)) {
        throw new ApiError(400, "Full name is required.");
    }
    if (!isValidEmail(email)) {
        throw new ApiError(400, "A valid email address is required.");
    }
    if (!isValidUsername(username)) {
        throw new ApiError(400, "Username must be 3-20 characters long and can only contain letters, numbers, and underscores.");
    }
    if (!isValidPassword(password)) {
        throw new ApiError(400, "Password must be at least 8 characters long and contain at least one letter and one number.");
    }

    const existedUser = await User.findOne({
        $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
    });

    if (existedUser) {
        if (existedUser.username === username.toLowerCase()) {
            throw new ApiError(409, "This username is already taken.");
        }
        if (existedUser.email === email.toLowerCase()) {
            throw new ApiError(409, "An account with this email address already exists.");
        }
    }

    const user = await User.create({
        fullName,
        email: email.toLowerCase(),
        password,
        username: username.toLowerCase()
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user. Please try again.");
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully.")
    );
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    // --- Input Validation ---
    if ((isNullOrWhitespace(username) && isNullOrWhitespace(email))) {
        throw new ApiError(400, "Username or email is required to log in.");
    }
    if (isNullOrWhitespace(password)) {
        throw new ApiError(400, "Password is required.");
    }

    const user = await User.findOne({
        $or: [{ username: username?.toLowerCase() }, { email: email?.toLowerCase() }]
    });

    if (!user) {
        throw new ApiError(401, "Invalid user credentials."); // Generic message for security
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials."); // Generic message for security
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged in successfully."
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { refreshToken: 1 } }, // Use $unset for cleaner removal
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is missing.");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
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
            throw new ApiError(403, "Refresh token has already been used or is expired. Please log in again.");
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed."
                )
            );

    } catch (error) {
        if (error instanceof ApiError) throw error;
        // Handle JWT errors (like TokenExpiredError) gracefully
        throw new ApiError(401, error?.message || "Invalid or expired refresh token.");
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
        throw new ApiError(400, "New password must be at least 8 characters long and contain at least one letter and one number.");
    }
    if (oldPassword === newPassword) {
        throw new ApiError(400, "New password must be different from the old password.");
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

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(
            200,
            req.user,
            "User details fetched successfully."
        ));
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
            throw new ApiError(409, "This email is already associated with another account.");
        }
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { fullName, email: newEmail } },
        { new: true }
    ).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(500, "Failed to update account details. Please try again.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully."));
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails
};