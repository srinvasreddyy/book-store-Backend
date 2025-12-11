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
      "FATAL: Cloudinary environment variables are required.",
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
  process.exit(1);
}

const uploadOnCloudinary = async (file) => {
  if (!file) return null;

  const isPath = typeof file === "string";
  if (!isPath && !Buffer.isBuffer(file)) return null;

  if (isPath && !fs.existsSync(file)) {
    logger.error(`Cloudinary upload failed: File does not exist at path: ${file}`);
    return null;
  }

  try {
    let response;
    
    // ✅ CRITICAL FIX: Use "auto" resource type.
    // This allows Cloudinary to treat PDFs as viewable documents (image type)
    // rather than raw binary files (which force download).
    const uploadOptions = {
      resource_type: "auto", 
      type: "upload", // Make Public
      // folder: "pdfs", // Optional: Organize in folder
    };

    if (Buffer.isBuffer(file)) {
      const tempPath = path.join(os.tmpdir(), `upload_${Date.now()}.tmp`);
      fs.writeFileSync(tempPath, file);
      response = await cloudinary.uploader.upload(tempPath, uploadOptions);
      fs.unlinkSync(tempPath);
    } else {
      response = await cloudinary.uploader.upload(file, uploadOptions);
      fs.unlinkSync(file);
    }

    // ✅ FORCE HTTPS: Ensure DB stores secure URL
    if (response && response.secure_url) {
      response.url = response.secure_url;
    }

    logger.info(`Successfully uploaded: ${response.url}`);
    return response;
  } catch (error) {
    logger.error("Cloudinary Upload Failed:", error.message || error);
    return null;
  }
};

const deleteFromCloudinary = async (url) => {
  if (!url) return;
  try {
    const urlSegments = url.split("/");
    const publicIdWithExtension = urlSegments[urlSegments.length - 1];
    const publicId = publicIdWithExtension.split("?")[0].split(".")[0];
    const uploadIndex = urlSegments.indexOf("upload");
    
    if (uploadIndex === -1 || !publicId) return;

    const fullPathWithVersion = urlSegments.slice(uploadIndex + 1).join("/");
    const finalPublicId = fullPathWithVersion
      .replace(/v\d+\//, "") 
      .replace(/\.[^/.]+$/, ""); 

    // Guess resource type from URL structure
    const resourceType = urlSegments.includes("raw") ? "raw" : 
                         urlSegments.includes("video") ? "video" : "image";

    await cloudinary.uploader.destroy(finalPublicId, { resource_type: resourceType });
    logger.info(`Deleted asset: ${finalPublicId}`);
  } catch (error) {
    logger.warn(`Delete failed: ${error.message}`);
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };