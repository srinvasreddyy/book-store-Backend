import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import { ApiError } from "./utils/ApiError.js";
import logger from "./utils/logger.js";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

// The Razorpay webhook needs the raw body, so we place this before the global json parser
import paymentRouter from "./api/routes/payment.routes.js";
app.use("/api/v1/payments", paymentRouter);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: "deny",
    },
    xssFilter: true,
    noSniff: true,
  }),
);
app.use(mongoSanitize());
app.use(xss());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use(limiter);

// Routes Import
import healthCheckRouter from "./api/routes/healthcheck.routes.js";
import userRouter from "./api/routes/user.routes.js";
import categoryRouter from "./api/routes/category.routes.js";
import bookRouter from "./api/routes/book.routes.js";
import videoRouter from "./api/routes/video.routes.js";
import announcementRouter from "./api/routes/announcement.routes.js";
import discountRouter from "./api/routes/discount.routes.js";
import cartRouter from "./api/routes/cart.routes.js";
import orderRouter from "./api/routes/order.routes.js";
import dashboardRouter from "./api/routes/dashboard.routes.js";
import tagRouter from "./api/routes/tag.routes.js";
import homepageRouter from "./api/routes/homepage.routes.js";

// Routes Declaration
app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/books", bookRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/announcements", announcementRouter);
app.use("/api/v1/discounts", discountRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/tags", tagRouter);
app.use("/api/v1/homepage", homepageRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    logger.error(err);
    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      success: err.success,
      errors: err.errors,
    });
  }

  logger.error(err);
  return res.status(500).json({
    statusCode: 500,
    message: "Internal Server Error",
    success: false,
  });
});

export { app };