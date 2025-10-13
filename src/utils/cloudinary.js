import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import logger from "./logger.js";

// --- TEMPORARY DIAGNOSTIC STEP ---
// We are hardcoding the credentials to bypass the .env file and confirm they are correct.
const CLOUD_NAME = "dydleoa3w";
const API_KEY = "163456487411236";
const API_SECRET = "8KFVvbL1ZRflmavfx-it8-HTFy8";

try {
    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
        throw new Error("FATAL: Hardcoded credentials are missing. Please check the file.");
    }

    cloudinary.config({
        cloud_name: CLOUD_NAME,
        api_key: API_KEY,
        api_secret: API_SECRET,
        secure: true,
    });
    
    logger.info("Cloudinary configured successfully using hardcoded credentials.");

} catch (error) {
    logger.error("FATAL ERROR during Cloudinary configuration:", error);
    process.exit(1);
}
// --- END OF DIAGNOSTIC STEP ---

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!fs.existsSync(localFilePath)) {
      logger.error(`Upload failed because the file does not exist at path: ${localFilePath}`);
      return null;
    }

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    fs.unlinkSync(localFilePath);
    return response;

  } catch (error) {
    logger.error("--- CLOUDINARY UPLOAD FAILED ---");
    logger.error("Even with hardcoded credentials, the upload failed. This suggests the credentials themselves might be incorrect or there is a network issue.");
    logger.error("Cloudinary's Response:", error.message || "No specific error message provided.");
    logger.error("---------------------------------");

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return null;
  }
};

export { uploadOnCloudinary };