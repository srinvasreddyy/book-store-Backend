import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import logger from "./logger.js";

// --- Cloudinary Configuration ---
// This block ensures that the application will not start if the Cloudinary environment variables are missing.
try {
  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error(
      "FATAL: Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are required.",
    );
  }

  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });

  logger.info("Cloudinary configured successfully.");
} catch (error) {
  logger.error("FATAL ERROR during Cloudinary configuration:", error);
  process.exit(1); // Exit the process with an error code
}

/**
 * Uploads a file to Cloudinary and deletes the local copy upon success.
 *
 * @param {string} localFilePath - The local path to the file to upload.
 * @returns {Promise<object|null>} - The Cloudinary response object on success, or null on failure.
 */
const uploadOnCloudinary = async (localFilePath) => {
  if (!localFilePath) {
    logger.error(
      "Cloudinary upload failed: No local file path provided.",
    );
    return null;
  }

  if (!fs.existsSync(localFilePath)) {
    logger.error(
      `Cloudinary upload failed: File does not exist at path: ${localFilePath}`,
    );
    return null;
  }

  try {
    // Upload the file to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // File has been uploaded successfully, now remove the local file.
    fs.unlinkSync(localFilePath);
    logger.info(`Successfully uploaded to Cloudinary: ${response.url}`);
    return response;
  } catch (error) {
    // An error occurred during the upload process.
    // The local file should NOT be deleted, to allow for potential retries.
    logger.error("--- CLOUDINARY UPLOAD FAILED ---");
    logger.error(
      `Failed to upload file: ${localFilePath}. The local file has not been deleted.`,
    );
    logger.error(
      "This could be due to incorrect credentials, network issues, or an invalid file.",
    );
    logger.error("Cloudinary Error Response:", error.message || error);
    logger.error("---------------------------------");

    // Attempt to clean up the local file ONLY if it still exists after the failed upload attempt.
    // This is a safeguard, but primary logic dictates leaving it for retry.
    // However, in some cases, the file might be corrupt and should be removed.
    // For this implementation, we will NOT remove it to ensure retry capability.
    // if (fs.existsSync(localFilePath)) {
    //   fs.unlinkSync(localFilePath);
    // }

    return null;
  }
};

export { uploadOnCloudinary };