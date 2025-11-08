import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  //Eb Combine formats to ensure errors with stack traces are logged correctly
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }), // Tells winston to capture stack trace
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      //Eb Use a readable format for console in development
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
           return `${timestamp} [${level}]: ${stack || message}`;
        })
      ),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.File({ filename: "error.log", level: "error" }),
  );
  //Eb It's often better to keep combined logs in standard JSON for parsing tools
  logger.add(new winston.transports.File({ 
      filename: "combined.log",
      format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
      )
  }));
}

export default logger;