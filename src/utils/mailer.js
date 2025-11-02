import nodemailer from "nodemailer";
import { ApiError } from "./ApiError.js";
import logger from "./logger.js";
import { Order } from "../api/models/order.model.js"; // Import Order model

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

  // Updated 'from' field as requested
  const mailOptions = {
    from: `"Indian Books House Publications" <${process.env.EMAIL_USER}>`,
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

/**
 * Generates an HTML email template for an order confirmation.
 * @param {object} order - The populated order object.
 * @returns {string} - The HTML email body.
 */
const getOrderConfirmationEmailTemplate = (order) => {
  // Helper to format currency
  const formatINR = (amount) => `₹${amount.toFixed(2)}`;

  // Generate HTML for each order item
  const itemsHtml = order.items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px; color: #333;">
        ${item.book?.title || "Book Title"}
        <br>
        <small style="color: #777;">by ${item.book?.author || "Author"}</small>
      </td>
      <td style="padding: 10px; text-align: center; color: #333;">${item.quantity}</td>
      <td style="padding: 10px; text-align: right; color: #333;">${formatINR(item.priceAtPurchase)}</td>
      <td style="padding: 10px; text-align: right; color: #333;">${formatINR(item.priceAtPurchase * item.quantity)}</td>
    </tr>
  `,
    )
    .join("");

  const shipping = order.shippingAddress;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f8f8f8; padding: 20px; text-align: center;">
        <h1 style="color: #0056b3; margin: 0;">Order Confirmed!</h1>
        <p style="font-size: 1.1em; color: #555;">Thank you for your purchase, ${order.user.fullName}!</p>
      </div>

      <div style="padding: 25px;">
        <p style="color: #333;">Your order <strong style="color: #d9534f;">#${order._id.toString()}</strong> has been successfully placed.</p>
        
        <h3 style="color: #0056b3; border-bottom: 2px solid #eee; padding-bottom: 5px;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead style="background-color: #f9f9f9;">
            <tr>
              <th style="padding: 10px; text-align: left; color: #555;">Item</th>
              <th style="padding: 10px; text-align: center; color: #555;">Qty</th>
              <th style="padding: 10px; text-align: right; color: #555;">Price</th>
              <th style="padding: 10px; text-align: right; color: #555;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: right; margin-bottom: 25px;">
          <p style="margin: 5px 0; color: #555;">Subtotal: <span style="font-weight: bold; color: #333;">${formatINR(order.subtotal)}</span></p>
          ${order.discountAmount > 0 ? `<p style="margin: 5px 0; color: #555;">Discount: <span style="font-weight: bold; color: #d9534f;">-${formatINR(order.discountAmount)}</span></p>` : ""}
          <p style="margin: 5px 0; color: #555;">Handling Fee: <span style="font-weight: bold; color: #333;">${formatINR(order.handlingFee)}</span></p>
          <p style="margin: 5px 0; color: #555;">Delivery Fee: <span style="font-weight: bold; color: #333;">${formatINR(order.deliveryFee)}</span></p>
          <hr style="border: 0; border-top: 1px dashed #ccc;">
          <p style="margin: 10px 0; font-size: 1.2em; font-weight: bold; color: #0056b3;">
            Total: ${formatINR(order.finalAmount)}
          </p>
        </div>

        <h3 style="color: #0056b3; border-bottom: 2px solid #eee; padding-bottom: 5px;">Shipping Details</h3>
        <address style="font-style: normal; line-height: 1.6; color: #333; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
          <strong>${shipping.fullName}</strong><br>
          ${shipping.address}<br>
          ${shipping.city}, ${shipping.state} - ${shipping.zip}<br>
          Phone: ${shipping.phone}
        </address>
        
        <p style="color: #555; margin-top: 20px;">We will notify you again once your order has been shipped.</p>
      </div>

      <div style="background-color: #f8f8f8; padding: 20px; text-align: center; font-size: 0.9em; color: #777;">
        &copy; ${new Date().getFullYear()} Indian Books House Publications. All rights reserved.
      </div>
    </div>
  `;
};

/**
 * Fetches populated order data and sends a confirmation email.
 * This is designed to be "fire-and-forget" and will log errors without throwing.
 * @param {string} orderId - The ID of the order to process.
 */
const sendOrderConfirmationEmail = async (orderId) => {
  try {
    // 1. Fetch the fully populated order
    const populatedOrder = await Order.findById(orderId)
      .populate("user", "fullName email")
      .populate("items.book", "title author");

    if (!populatedOrder) {
      logger.error(
        `Failed to send order confirmation: Order not found with ID: ${orderId}`,
      );
      return;
    }

    if (!populatedOrder.user || !populatedOrder.user.email) {
      logger.error(
        `Failed to send order confirmation: User or user email not found for order ID: ${orderId}`,
      );
      return;
    }

    // 2. Generate email content
    const emailTo = populatedOrder.user.email;
    const emailSubject = `Your Indian Books House Order is Confirmed (Order #${orderId.toString()})`;
    const emailHtml = getOrderConfirmationEmailTemplate(populatedOrder);
    const emailText = `Thank you for your order, ${populatedOrder.user.fullName}! Your order #${orderId.toString()} is confirmed. Total amount: ₹${populatedOrder.finalAmount.toFixed(2)}.`;

    // 3. Send the email
    await sendEmail(emailTo, emailSubject, emailText, emailHtml);
    logger.info(`Order confirmation email sent for order: ${orderId}`);
  } catch (error) {
    logger.warn(
      `Failed to send order confirmation email for order: ${orderId}. This did not block the order process.`,
    );
    logger.warn(error);
  }
};

export { sendEmail, getOTPEmailTemplate, sendOrderConfirmationEmail };