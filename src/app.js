import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { ApiError } from './utils/ApiError.js';

const app = express();

// Security middleware
app.use(helmet());

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per windowMs
	standardHeaders: 'draft-7',
	legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());


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

// Global Error Handler
app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            statusCode: err.statusCode,
            message: err.message,
            success: err.success,
            errors: err.errors,
        });
    }

    // For unhandled errors
    console.error('Unhandled Error:', err); // Log the error for debugging
    return res.status(500).json({
        statusCode: 500,
        message: 'Internal Server Error',
        success: false,
    });
});

export { app }; 