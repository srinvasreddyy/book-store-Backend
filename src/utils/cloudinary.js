import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import os from "os";
import path from "path";
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
 * Uploads a file to Cloudinary. Supports both local file paths and buffers.
 *
 * @param {string|Buffer} file - The local path to the file or a buffer to upload.
 * @returns {Promise<object|null>} - The Cloudinary response object on success, or null on failure.
 */
const uploadOnCloudinary = async (file) => {
  if (!file) {
    logger.error("Cloudinary upload failed: No file provided.");
    return null;
  }

  const isBuffer = Buffer.isBuffer(file);
  const isPath = typeof file === "string";

  if (!isBuffer && !isPath) {
    logger.error(
      "Cloudinary upload failed: File must be a buffer or a string path.",
    );
    return null;
  }

  if (isPath && !fs.existsSync(file)) {
    logger.error(
      `Cloudinary upload failed: File does not exist at path: ${file}`,
    );
    return null;
  }

  try {
    let response;
    if (isBuffer) {
      // Upload buffer directly
      if (!Buffer.isBuffer(file) || file.length === 0) {
        logger.error("Invalid buffer provided for upload:", {
          isBuffer: Buffer.isBuffer(file),
          length: file.length,
        });
        return null;
      }
      logger.info(`Uploading buffer of size: ${file.length}`);
      // Temporarily save buffer to file for testing
      const tempPath = path.join(
        os.tmpdir(),
        `upload_${Date.now()}_${Math.random()}.tmp`,
      );
      fs.writeFileSync(tempPath, file);
      response = await cloudinary.uploader.upload(tempPath, {
        resource_type: "auto",
      });
      fs.unlinkSync(tempPath);
    } else {
      // Upload from file path
      response = await cloudinary.uploader.upload(file, {
        resource_type: "auto",
      });
      // File has been uploaded successfully, now remove the local file.
      fs.unlinkSync(file);
    }

    logger.info(`Successfully uploaded to Cloudinary: ${response.url}`);
    return response;
  } catch (error) {
    // An error occurred during the upload process.
    logger.error("--- CLOUDINARY UPLOAD FAILED ---");
    if (isPath) {
      logger.error(
        `Failed to upload file: ${file}. The local file has not been deleted.`,
      );
    } else {
      logger.error("Failed to upload buffer.");
    }
    logger.error(
      "This could be due to incorrect credentials, network issues, or an invalid file.",
    );
    logger.error("Cloudinary Error Response:", error.message || error);
    logger.error("Full error object:", error);
    if (error && typeof error === "object") {
      logger.error("Error keys:", Object.keys(error));
      logger.error("Error stack:", error.stack);
    }
    logger.error("---------------------------------");

    return null;
  }
};

/**
 * Deletes an asset from Cloudinary using its full URL.
 * Does not throw an error on failure, just logs a warning.
 * @param {string} url - The full Cloudinary URL of the asset to delete.
 */
const deleteFromCloudinary = async (url) => {
  if (!url) return;

  try {
    // Extract public_id from URL.
    // e.g., "http://res.cloudinary.com/cloud_name/image/upload/v12345/folder/public_id.jpg"
    // The public_id Cloudinary needs is "folder/public_id"
    const urlSegments = url.split("/");
    const publicIdWithExtension = urlSegments[urlSegments.length - 1];
    const publicId = publicIdWithExtension.split(".")[0];

    // Find the 'upload' segment and take everything after it, then remove extension
    const uploadIndex = urlSegments.indexOf("upload");
    if (uploadIndex === -1) {
      logger.warn(
        `Cloudinary deletion: Could not parse public_id from URL: ${url}`,
      );
      return;
    }

    // Re-join segments after 'upload', e.g., "v12345/folder/public_id.jpg"
    const fullPathWithVersion = urlSegments.slice(uploadIndex + 1).join("/");
    // Remove version and extension: "folder/public_id"
    const finalPublicId = fullPathWithVersion
      .replace(/v\d+\//, "") // Remove version number
      .replace(/\.[^/.]+$/, ""); // Remove file extension

    if (!finalPublicId) {
      logger.warn(
        `Cloudinary deletion: Parsed empty public_id from URL: ${url}`,
      );
      return;
    }

    // Determine resource type (e.g., image, video, raw)
    const resourceType =
      urlSegments[urlSegments.indexOf("upload") - 1] || "image";

    logger.info(
      `Attempting to delete asset from Cloudinary: public_id='${finalPublicId}', resource_type='${resourceType}'`,
    );

    await cloudinary.uploader.destroy(finalPublicId, {
      resource_type: resourceType,
    });

    logger.info(
      `Successfully deleted asset from Cloudinary: ${finalPublicId}`,
    );
  } catch (error) {
    logger.warn(
      `Failed to delete asset from Cloudinary: ${url}. Error: ${error.message}`,
    );
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };