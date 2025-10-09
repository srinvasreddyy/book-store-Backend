import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

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


// Routes Declaration
app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/books", bookRouter);
app.use("/api/v1/videos", videoRouter);


export { app };