import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Contact } from "../models/contact.model.js";
import mongoose from "mongoose";

// Validation helpers
const isValidEmail = (email) => {
  return email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : true;
};

const isValidUrl = (url) => {
  return url ? /^https?:\/\/.+/.test(url) : true;
};

/**
 * @route GET /api/v1/contacts
 * @desc Get contact information (public access)
 * @access Public
 */
const getContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findOne().select("-updatedBy -createdAt -updatedAt");

  if (!contact) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, "No contact information available"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, contact, "Contact information fetched successfully"));
});

/**
 * @route GET /api/v1/contacts/admin
 * @desc Get contact information for admin (includes metadata)
 * @access Admin
 */
const getContactForAdmin = asyncHandler(async (req, res) => {
  const contact = await Contact.findOne().populate("updatedBy", "fullName email");

  if (!contact) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, "No contact information available"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, contact, "Contact information fetched successfully"));
});

/**
 * @route POST /api/v1/contacts
 * @desc Create contact information
 * @access Admin
 */
const createContact = asyncHandler(async (req, res) => {
  const {
    phone,
    email,
    address,
    businessHours,
    socialMedia,
    about,
    mission,
    vision,
  } = req.body;

  // Validation
  if (email && !isValidEmail(email)) {
    throw new ApiError(400, "Invalid email format");
  }

  // Validate social media URLs
 if (socialMedia) {
    const socialKeys = ["facebook", "twitter", "instagram", "linkedin", "youtube", "whatsapp", "telegram"];
    
    for (const key of socialKeys) {
      if (socialMedia[key] && !isValidUrl(socialMedia[key])) {
        throw new ApiError(400, `Invalid ${key} URL format`);
      }
    }
  }

  const contactData = {
    phone,
    email,
    address,
    businessHours,
    socialMedia,
    about,
    mission,
    vision,
    updatedBy: req.user._id,
  };

  const contact = await Contact.create(contactData);

  return res
    .status(201)
    .json(new ApiResponse(201, contact, "Contact information created successfully"));
});

/**
 * @route PATCH /api/v1/contacts
 * @desc Update contact information
 * @access Admin
 */
const updateContact = asyncHandler(async (req, res) => {
  const {
    phone,
    email,
    address,
    businessHours,
    socialMedia,
    about,
    mission,
    vision,
  } = req.body;

  // Validation
  if (email && !isValidEmail(email)) {
    throw new ApiError(400, "Invalid email format");
  }

  // Validate social media URLs
  if (socialMedia) {
    const socialKeys = ["facebook", "twitter", "instagram", "linkedin", "youtube", "whatsapp", "telegram"];
    
    for (const key of socialKeys) {
      if (socialMedia[key] && !isValidUrl(socialMedia[key])) {
        throw new ApiError(400, `Invalid ${key} URL format`);
      }
    }
  }

  const updateData = {
    phone,
    email,
    address,
    businessHours,
    socialMedia,
    about,
    mission,
    vision,
    updatedBy: req.user._id,
  };

  // Remove undefined fields
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  const contact = await Contact.findOneAndUpdate(
    {},
    { $set: updateData },
    { new: true, runValidators: true, upsert: true }
  ).populate("updatedBy", "fullName email");

  return res
    .status(200)
    .json(new ApiResponse(200, contact, "Contact information updated successfully"));
});

/**
 * @route DELETE /api/v1/contacts
 * @desc Delete contact information
 * @access Admin
 */
const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findOneAndDelete();

  if (!contact) {
    throw new ApiError(404, "Contact information not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Contact information deleted successfully"));
});

export {
  getContact,
  getContactForAdmin,
  createContact,
  updateContact,
  deleteContact,
};