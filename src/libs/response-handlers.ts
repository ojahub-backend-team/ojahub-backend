import type { Response } from "express";
import logger from "../config/logger.js";

type ApiSuccessResponse<Tbody = undefined> = {
  success: true;
  message: string;
} & (Tbody extends undefined ? {} : { body: Tbody });

type ApiErrorResponse<TDetails = undefined> = {
  success: false;
  message: string;
} & (TDetails extends undefined ? {} : { details: TDetails });

const sendTsResponse = (res: Response, status: number, body: unknown): void => {
  res.status(status).json(body);
};

const sendErrorResponse = <T>(
  res: Response,
  status: number,
  error: string,
  details?: T,
): void => {
  logger.error({ error }, "Error response with message");
  sendTsResponse(res, status, {
    success: false,
    message: error,
    ...(details && { details }),
  });
};

const sendSuccessResponse = <T>(
  res: Response,
  status: number,
  body: ApiSuccessResponse<T>,
): void => {
  sendTsResponse(res, status, body);
};

export { sendSuccessResponse, sendErrorResponse, sendTsResponse };
