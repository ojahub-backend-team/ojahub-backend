import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import PinoHttpModule, { pinoHttp } from "pino-http";
import { env } from "../config/keys.js";
import logger from "../config/logger.js";
import { sendErrorResponse } from "../libs/response-handlers.js";

const PinoHttp = PinoHttpModule.default || PinoHttpModule;

// determine if we are in dev mode
const isDev = env.NODE_ENV === "development";

class ErrorResponse extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;

    Error.captureStackTrace(this, this.constructor);
    //capture stack trace of where error comes from
  }
}

// middleware for request logging and error handling
export const createExpressLogger = () => {
  return pinoHttp({
    logger,
    //log request id for tracing
    genReqId: () => randomUUID(),
    //custome serializers for sensitive data
    serializers: {
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        headers: {
          "user-agent": req.headers["user-agent"],
          host: req.headers.host,
        },
        remoteAddress: req.raw.socket?.remoteAddress,
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
      }),
    },
    //only log in dev env
    autoLogging: !isDev
      ? {
          ignore: (req: any) =>
            req.url === "/health" || req.url?.startsWith("/assets"),
        }
      : true,
  });
};

//global unhandled errors
export const globalErrorHandlers = (): void => {
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception");
    setTimeout(() => process.exit(1), 1000);
  });
  //unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error({ reason, promise }, "unhandled Rejection");
  });
};

export const appErrorHandler = (
  err: Error | ErrorResponse,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let error = { ...err } as ErrorResponse;
  error.message = err.message;

  logger.error(err);

  //catch mongoose errors for bad object ID
  if (err.name === "CastError") {
    const message = "Resource not found";
    error = new ErrorResponse(message, 404);
  }
  //mongoose duplicate keys
  if ((err as any).code === 11000) {
    const message = "Duplicate field value entered";
    error = new ErrorResponse(message, 400);
  }

  //mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values((err as any).errors).map(
      (val: any) => val.message,
    );
    error = new ErrorResponse(message.join(","), 400);
  }

  //malformed JSON in the request body
  if ((err as any).type === "entity.parse.failed") {
    error = new ErrorResponse("Invalid JSON in request body", 400);
  }

  //send error along with its status and message using sendErrorRespopnse
  const statusCode = (error as ErrorResponse).statusCode || 500;
  sendErrorResponse(res, statusCode, error.message);
};

//404 not found route handler
export const notFoundRoutes = (req: Request, res: Response) => {
  sendErrorResponse(
    res,
    404,
    `Cannot find route - ${req.originalUrl} on this server. please check the url and try again`,
  );
};
