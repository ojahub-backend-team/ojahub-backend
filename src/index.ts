import { connectToDB, gracefulShutdown } from "./config/database";
import { env } from "./config/keys";
import logger, { logError } from "./config/logger";
import app from "./app";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3800;

const startServer = async (): Promise<void> => {
  let server: ReturnType<typeof app.listen>;
  try {
    await connectToDB();
    server = app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server is running in ${env.NODE_ENV} mode on port ${PORT}`);
      logger.info(`https://localhost:${PORT}`);
    });
    process.on("unhandledRejection", (reason, unknown) => {
      console.error("UNHANDLED REJECTION! Shutting down!");
      const error =
        reason instanceof Error
          ? `${reason.name} : {reason.message}`
          : String(reason);
      logger.error({ reason: error }, "unhandled rejection");
      server.close(() => {
        logger.info("Process terminated due to unhandled rejection");
        logger.info("Server shutting down complete");
      });
    });
    //termination signals
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
    //other server errors
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") throw error;
      switch (error.code) {
        case "EACCES":
          logger.error(`Port ${PORT} requires elevated priviledges`);
          process.exit(1);
        case "EADDRINUSE":
          logger.error(`[port ${PORT} is already in use]`);
          process.exit(1);
        default:
          throw error;
      }
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown error";
    logError(`Failed to start server: ${errorMessage}`);
    process.exit(1);
  }
};
startServer();
