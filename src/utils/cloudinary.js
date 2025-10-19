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
 * @param {string|Buffer} file - The local path to the file or a Buffer containing the file data.
 * @param {string} [resourceType="auto"] - The resource type for Cloudinary upload.
 * @returns {Promise<object|null>} - The Cloudinary response object on success, or null on failure.
 */
const uploadOnCloudinary = async (file, resourceType = "auto") => {
  if (!file) {
    logger.error(
      "Cloudinary upload failed: No file provided.",
    );
    return null;
  }

  try {
    let uploadOptions = { resource_type: resourceType };

    if (Buffer.isBuffer(file)) {
      // If file is a buffer, upload directly
      uploadOptions = {
        ...uploadOptions,
        buffer: file,
      };
    } else {
      // If file is a path, check if it exists
      if (!fs.existsSync(file)) {
        logger.error(
          `Cloudinary upload failed: File does not exist at path: ${file}`,
        );
        return null;
      }
      uploadOptions = {
        ...uploadOptions,
        public_id: undefined, // Let Cloudinary generate the public_id
      };
    }

    // Upload the file to Cloudinary
    const response = await cloudinary.uploader.upload(file, uploadOptions);

    // If it was a file path, delete the local file after successful upload
    if (typeof file === 'string' && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }

    logger.info(`Successfully uploaded to Cloudinary: ${response.url}`);
    return response;
  } catch (error) {
    // An error occurred during the upload process.
    // The local file should NOT be deleted, to allow for potential retries.
    logger.error("--- CLOUDINARY UPLOAD FAILED ---");
    logger.error(
      `Failed to upload file. The local file has not been deleted.`,
    );
    logger.error("This could be due to incorrect credentials, network issues, or an invalid file.");
    logger.error("Cloudinary Error Response:", error.message || error);
    logger.error("---------------------------------");

    return null;
  }
};

export { uploadOnCloudinary };