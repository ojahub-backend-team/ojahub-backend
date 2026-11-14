import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { sendErrorResponse } from "../libs/response-handlers.js";

export const validate =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const fields = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return sendErrorResponse(res, 400, "Validation failed", fields);
    }

    // Controllers now only ever see clean, typed data
    req.body = result.data;
    next();
  };
