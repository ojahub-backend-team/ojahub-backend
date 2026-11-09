import mongoose, { type ConnectOptions } from "mongoose";
import { env } from "./keys.js";
import logger from "./logger.js";

interface DBConnection {
  isConnected: boolean;
  retryCount: number;
  maxRetries: number;
}

const dbConnection: DBConnection = {
  isConnected: false,
  retryCount: 0,
  maxRetries: 5,
};

export const connectToDB = async (): Promise<void> => {
  //check if we are already connected to database
  if (dbConnection.isConnected && mongoose.connection.readyState === 1) {
    logger.info("Using existing MongoDb Connection");
  }
  //check for max retries of database call
  if (dbConnection.retryCount >= dbConnection.maxRetries) {
    logger.error("Max MongoDb Connection retries reached, try again later.");
    process.exit(1);
  }

  const connectionOptions: ConnectOptions = {
    dbName: env.DB_NAME,
    serverSelectionTimeoutMS: 45000,
    socketTimeoutMS: 15000,
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 50,
    minPoolSize: 1,
    autoIndex: env.NODE_ENV !== "production",
    monitorCommands: env.NODE_ENV === "development",
  };
  //establish db connectiobn
  try {
    const conn = await mongoose.connect(env.MONGO_URI, connectionOptions);
    dbConnection.isConnected = conn.connections[0].readyState === 1; //we are connected
    dbConnection.retryCount = 0;

    if (dbConnection.isConnected) {
      logger.info(`Mongo Db connected: ${conn.connection.host}`);

      if (mongoose.connection.listenerCount("error") === 0) {
        mongoose.connection.on("error", (err) => {
          logger.error(err, "Mongo db connection error");
          dbConnection.isConnected = false;
        });
      }

      if (mongoose.connection.listenerCount("disconnected") === 0) {
        mongoose.connection.on("disconnected", () => {
          logger.info("MongoDb Disconnected");
          dbConnection.isConnected = false;
          //attempt to reconnect
          if (dbConnection.retryCount < dbConnection.maxRetries) {
            dbConnection.retryCount++;
            logger.info(
              `Attempting to reconnect: (${dbConnection.retryCount}/${dbConnection.maxRetries})...`,
            );
            setTimeout(connectToDB, 5000);
          }
        });
      }
    }
  } catch (error: unknown) {
    dbConnection.retryCount++;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(
      {
        error: errorMessage,
      },
      `Momgodb connection failed: (${dbConnection.retryCount}/${dbConnection.maxRetries})`,
    );
    if (dbConnection.retryCount < dbConnection.maxRetries) {
      logger.info(`Retrying in 5 sec...`);
      setTimeout(connectToDB, 5000);
    } else {
      console.error("Max retries reached, exiting...");
      process.exit(1);
    }
  }
};

//handle graceful shutdown of server

export const gracefulShutdown = async (): Promise<void> => {
  try {
    logger.info("Received shutdown signal. Closing server...");
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
    }

    logger.info("Server shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error(error, "Error during shutdown:");
    process.exit(1);
  }
};

// Handle uncaught exceptions and unhandled rejections
if (process.listenerCount("uncaughtException") === 0) {
  process.on("uncaughtException", (error: Error) => {
    logger.error("UNCAUGHT EXCEPTION! Shutting down...");
    logger.error({ stack: error.stack }, `${error.name}: ${error.message}`);

    if (env.NODE_ENV === "development") {
      console.error(error);
    }

    // Attempt to close server gracefully
    gracefulShutdown().finally(() => process.exit(1));
  });
}

if (process.listenerCount("unhandledRejection") === 0) {
  process.on("unhandledRejection", (reason: any) => {
    logger.error("UNHANDLED REJECTION! Shutting down...");
    logger.error({ reason }, "Unhandled Promise Rejection");

    // Attempt to close server gracefully
    gracefulShutdown().finally(() => process.exit(1));
  });
}

// Handle termination signals
if (process.listenerCount("SIGINT") === 0) {
  process.on("SIGINT", () => gracefulShutdown());
}

if (process.listenerCount("SIGTERM") === 0) {
  process.on("SIGTERM", () => gracefulShutdown());
}
