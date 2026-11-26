import type { Server } from "node:http";
import { connectToDB, closeDB } from "./config/database.js";
import { env } from "./config/keys.js";
import logger, { logError } from "./config/logger.js";
import app from "./app.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3800;
const FORCE_EXIT_AFTER_MS = 10_000;

let httpServer: Server | undefined;
let shuttingDown = false;

// A short database outage rejects some promise in the background.
// The driver reconnects by itself, so these must not take the server down.
const TRANSIENT_DB_ERRORS = new Set([
  "MongoServerSelectionError",
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoNotConnectedError",
]);

const isTransientDbError = (reason: unknown): boolean =>
  reason instanceof Error && TRANSIENT_DB_ERRORS.has(reason.name);

// The only shutdown path: stop taking requests, close the database, then exit
const shutdown = async (reason: string, exitCode: number): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Shutting down (${reason})...`);

  // Never hang forever if a connection refuses to close
  const forceExit = setTimeout(() => {
    logger.error("Shutdown took too long. Forcing exit.");
    process.exit(1);
  }, FORCE_EXIT_AFTER_MS);
  forceExit.unref();

  try {
    if (httpServer) {
      const server = httpServer;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await closeDB();
    logger.info("Server shutdown complete");
    process.exit(exitCode);
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM", 0));
process.on("SIGINT", () => void shutdown("SIGINT", 0));

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception");
  void shutdown("uncaughtException", 1);
});

process.on("unhandledRejection", (reason) => {
  if (isTransientDbError(reason)) {
    logger.warn(
      { err: reason },
      "Database briefly unavailable. Still running.",
    );
    return;
  }
  logger.error({ err: reason }, "Unhandled promise rejection");
  void shutdown("unhandledRejection", 1);
});

const startServer = async (): Promise<void> => {
  try {
    await connectToDB();

    httpServer = app.listen(PORT, "0.0.0.0", (error?: Error) => {
      // Express 5 also calls this when listening fails; the "error" handler below deals with that
      if (error) return;
      logger.info(`Server is running in ${env.NODE_ENV} mode on port ${PORT}`);
      logger.info(`http://localhost:${PORT}`);
    });

    httpServer.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") throw error;
      if (error.code === "EACCES") {
        logger.error(`Port ${PORT} requires elevated privileges`);
        process.exit(1);
      }
      if (error.code === "EADDRINUSE") {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      }
      throw error;
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown error";
    logError(`Failed to start server: ${errorMessage}`);
    process.exit(1);
  }
};

startServer();

// import { connectToDB, gracefulShutdown } from "./config/database.js";
// import { env } from "./config/keys.js";
// import logger, { logError } from "./config/logger.js";
// import app from "./app.js";

// const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3800;

// const startServer = async (): Promise<void> => {
//   let server: ReturnType<typeof app.listen>;
//   try {
//     await connectToDB();
//     server = app.listen(PORT, "0.0.0.0", () => {
//       logger.info(`Server is running in ${env.NODE_ENV} mode on port ${PORT}`);
//       logger.info(`http://localhost:${PORT}`);
//     });
//     process.on("unhandledRejection", (reason, unknown) => {
//       console.error("UNHANDLED REJECTION! Shutting down!");
//       const error =
//         reason instanceof Error
//           ? `${reason.name} : ${reason.message}`
//           : String(reason);
//       logger.error({ reason: error }, "unhandled rejection");
//       server.close(() => {
//         logger.info("Process terminated due to unhandled rejection");
//         logger.info("Server shutting down complete");
//       });
//     });
//     //termination signals
//     process.on("SIGTERM", gracefulShutdown);
//     process.on("SIGINT", gracefulShutdown);
//     //other server errors
//     server.on("error", (error: NodeJS.ErrnoException) => {
//       if (error.syscall !== "listen") throw error;
//       switch (error.code) {
//         case "EACCES":
//           logger.error(`Port ${PORT} requires elevated priviledges`);
//           process.exit(1);
//         case "EADDRINUSE":
//           logger.error(`Port ${PORT} is already in use`);
//           process.exit(1);
//         default:
//           throw error;
//       }
//     });
//   } catch (error: unknown) {
//     const errorMessage =
//       error instanceof Error ? error.message : "unknown error";
//     logError(`Failed to start server: ${errorMessage}`);
//     process.exit(1);
//   }
// };
// startServer();
