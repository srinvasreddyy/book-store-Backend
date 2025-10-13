import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import retry from "async-retry";
import logger from "../utils/logger.js";

const connectDB = async () => {
  try {
    await retry(
      async () => {
        const connectionInstance = await mongoose.connect(
          `${process.env.MONGODB_URI}/${DB_NAME}`,
        );
        logger.info(
          `\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`,
        );
      },
      {
        retries: 5,
        factor: 2,
        minTimeout: 1000,
        onRetry: (error) => {
          logger.error("Retrying database connection:", error.message);
        },
      },
    );
  } catch (error) {
    logger.error("MONGODB connection FAILED: ", error);
    process.exit(1);
  }
};

export default connectDB;
