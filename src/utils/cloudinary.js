import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import os from "os";
import path from "path";
import logger from "./logger.js";

// --- Cloudinary Configuration ---
try {
  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error(
      "FATAL: Cloudinary environment variables are required."
    );
  }

  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true, // Enforce HTTPS globally
  });

  logger.info("Cloudinary configured successfully with HTTPS.");
} catch (error) {
  logger.error("FATAL ERROR during Cloudinary configuration:", error);
  process.exit(1);
}

/**
 * Uploads a file or buffer to Cloudinary with HTTPS enforced.
 *
 * @param {string|Buffer} file - Local path or buffer to upload.
 * @returns {Promise<object|null>} - Secure Cloudinary response or null on failure.
 */
const uploadOnCloudinary = async (file) => {
  if (!file) {
    logger.error("Cloudinary upload failed: No file provided.");
    return null;
  }

  const isBuffer = Buffer.isBuffer(file);
  const isPath = typeof file === "string";

  if (!isBuffer && !isPath) {
    logger.error("Cloudinary upload failed: File must be a buffer or a string path.");
    return null;
  }

  if (isPath && !fs.existsSync(file)) {
    logger.error(`Cloudinary upload failed: File does not exist at path: ${file}`);
    return null;
  }

  try {
    let response;
    if (isBuffer) {
      const tempPath = path.join(os.tmpdir(), `upload_${Date.now()}_${Math.random()}.tmp`);
      fs.writeFileSync(tempPath, file);
      response = await cloudinary.uploader.upload(tempPath, { resource_type: "auto" });
      fs.unlinkSync(tempPath);
    } else {
      response = await cloudinary.uploader.upload(file, { resource_type: "auto" });
      fs.unlinkSync(file);
    }

    // ✅ Always replace insecure URL with secure URL
    const secureResponse = {
      ...response,
      url: response.secure_url,
    };

    logger.info(`Successfully uploaded to Cloudinary (HTTPS): ${secureResponse.url}`);
    return secureResponse;
  } catch (error) {
    logger.error("--- CLOUDINARY UPLOAD FAILED ---");
    logger.error(error.message || error);
    logger.error("---------------------------------");
    return null;
  }
};

export { uploadOnCloudinary };
