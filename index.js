import dotenv from "dotenv";
dotenv.config({
    path: './.env'
});

import connectDB from "./src/db/index.js";
import { app } from "./src/app.js";
import logger from "./src/utils/logger.js";

process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", { promise, reason });
    //Eb Optional: process.exit(1) if you want to restart on severe failures
});

//Eb Catch uncaught exceptions (e.g. synchronous code errors that crash the main thread)
process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception thrown:", error);
    process.exit(1); // It's usually safer to restart the process after an uncaught exception
});

connectDB()
.then(() => {
    app.on("error", (error) => {
        console.error("Express App Error: ", error);
        throw error;
    });

    app.listen(process.env.PORT || 8000, () => {
        console.log(`🚀 Server is running at port : ${process.env.PORT || 8000}`);
    });
})
.catch((err) => {
    console.error("MONGO db connection failed !!! ", err);
    process.exit(1);
});