import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import { ApiError } from "./utils/ApiError.js";
import logger from "./utils/logger.js";

const app = express();

// ✅ CORS Configuration
const allowedOrigins = [
  "https://bookstore-snowy-two.vercel.app",
  "https://admin-book-store-liard.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://indianbookshouse.in",
  "https://admin.indianbookshouse.in",
  ...(process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : []),
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.CORS_ORIGIN === "*") {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

// ✅ Capture raw body for Razorpay webhook
app.use(
  express.json({
    limit: "16kb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// ✅ Secure HTTP headers
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
    frameguard: { action: "deny" },
    xssFilter: true,
    noSniff: true,
  })
);

app.use(mongoSanitize());
app.use(xss());

// ✅ Routes Import
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
import paymentRouter from "./api/routes/payment.routes.js";
import contactRouter from "./api/routes/contact.routes.js";
// --- FEATURE-025 START ---
import clientRouter from "./api/routes/client.routes.js";
// --- FEATURE-025 END ---

// ✅ Routes Declaration
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
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/contacts", contactRouter);
app.use("/api/v1/clients", clientRouter);
// ✅ Global Error Handler
app.use((err, req, res, next) => {
  //Eb If it's not an ApiError, wrap it so it has a standard structure.
  //Eb This handles generic JS errors (like accessing props of undefined).
  let error = err;
  if (!(error instanceof ApiError)) {
      //Eb Mongoose bad ObjectId often throws CastError, which we can treat as 400
      const statusCode = error.name === 'CastError' ? 400 : 500;
      const message = error.message || "Internal Server Error";
      error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  //Eb Prepare the response object
  const response = {
      statusCode: error.statusCode,
      message: error.message,
      success: false,
      errors: error.errors || [],
  };

  //Eb ONLY in development/non-production, include the stack trace in the API response
  //Eb for easier debugging without looking at server logs immediately.
  if (process.env.NODE_ENV !== "production") {
      response.stack = error.stack;
  }

  //Eb Enhanced logging with request context
  logger.error(
      `${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`,
      { 
         error_name: error.name,
         stack: error.stack, //Eb Explicitly passing stack to logger
         request_body: req.body //Eb Optional: log request body for debugging (be careful with sensitive data)
      }
  );

  return res.status(error.statusCode).json(response);
});

export { app };