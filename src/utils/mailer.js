import nodemailer from "nodemailer";
import { ApiError } from "./ApiError.js";
import logger from "./logger.js";

/**
 * Creates a reusable Nodemailer transport object.
 * We are using Gmail as per the request.
 *
 * IMPORTANT: For this to work with Gmail, the user MUST
 * 1. Use an "App Password" (recommended)
 * 2. Or enable "Less secure app access" (not recommended, and may not even work anymore)
 */
const transport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends an email using the pre-configured transport.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject line of the email.
 * @param {string} text - The plain text body of the email.
 * @param {string} html - The HTML body of the email.
 */
const sendEmail = async (to, subject, text, html) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.error("Email credentials (EMAIL_USER, EMAIL_PASS) are not set.");
    throw new ApiError(
      500,
      "Email service is not configured on the server.",
    );
  }

  const mailOptions = {
    from: `"Indian Books House" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    text: text,
    html: html,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Failed to send email to ${to} with subject "${subject}"`);
    logger.error(error);
    throw new ApiError(500, "Failed to send email.");
  }
};

/**
 * Generates a simple HTML template for the OTP email.
 * @param {string} otp - The 6-digit OTP.
 * @returns {string} - The HTML email body.
 */
const getOTPEmailTemplate = (otp) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #0056b3;">Your Password Reset Code</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password for your Indian Books House account.</p>
      <p>Please use the following One-Time Password (OTP) to complete your request. This code is valid for 10 minutes.</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #d9534f; margin: 20px 0;">
        ${otp}
      </p>
      <p>If you did not request a password reset, please ignore this email or contact our support if you have concerns.</p>
      <hr style="border: 0; border-top: 1px solid #eee;" />
      <p style="font-size: 0.9em; color: #777;">
        Best regards,<br />
        The Indian Books House Team
      </p>
    </div>
  `;
};

export { sendEmail, getOTPEmailTemplate };