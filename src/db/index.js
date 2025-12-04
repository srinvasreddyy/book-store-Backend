import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import logger from "../utils/logger.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    logger.info(
      `\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`,
    );

    // --- AUTOMATIC INDEX FIXES ---
    try {
        const db = mongoose.connection.db;
        
        // 1. Drop old category index if it exists (from previous error)
        const catIndexes = await db.collection('categories').indexes();
        if (catIndexes.find(i => i.name === 'name_1_owner_1')) {
            await db.collection('categories').dropIndex('name_1_owner_1');
            logger.info("Dropped old 'categories' index.");
        }

        // 2. ✅ Drop old book text index to fix "language override unsupported"
        const bookIndexes = await db.collection('books').indexes();
        // The default name for text index on title+author is usually "title_text_author_text"
        const textIndex = bookIndexes.find(i => i.key?._fts === 'text');
        if (textIndex) {
            await db.collection('books').dropIndex(textIndex.name);
            logger.info(`Dropped old book text index '${textIndex.name}' to apply new language rules.`);
        }

    } catch (e) {
        logger.warn(`Index cleanup warning: ${e.message}`);
    }
    // -----------------------------

  } catch (error) {
    logger.error("MONGODB connection FAILED ", error);
    process.exit(1);
  }
};

export default connectDB;