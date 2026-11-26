import cors from "cors";
import mongoose from "mongoose";
import express, { type NextFunction, Response, Request } from "express";
import { env } from "./config/keys.js";
import compression from "compression";
import helmet from "helmet";
import type {} from "./types/express.js";
import { createSessionMiddleware } from "./config/session.js";
import {
  appErrorHandler,
  createExpressLogger,
  notFoundRoutes,
  globalErrorHandlers,
} from "./middlewares/error.middleware.js";
import { compressionOptions, helmetOptions } from "./libs/option.js";
import authRoutes from "./routes/auth.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import paystackWebhookRoutes from "./routes/paystack-webhook.routes.js";

declare global {
  namespace Express {
    interface Request {
      requestTime?: string;
      rawBody?: Buffer;
    }
  }
}

const app = express();

//trust proxy
app.set("trust proxy", 1);

//set up global error handler - (node process level)
globalErrorHandlers();

//cors configuration
const allowedOrigins: string[] = [
  env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean) as string[];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  optionsSuccessStatus: 200,
};

app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestTime = new Date().toISOString();
  next();
});

app.get("/health", (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res
    .status(dbUp ? 200 : 503)
    .json({ status: dbUp ? "ok" : "database unavailable" });
});

//health check - no logs, session, or rate limiter required
app.use("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    environment: env.NODE_ENV,
    timeStamp: req.requestTime,
    uptime: process.uptime(),
  });
});

app.use(createExpressLogger());
app.use(cors(corsOptions));
app.use(helmet(helmetOptions));
app.use(createSessionMiddleware());

// Paystack webhook must receive the original raw request body.
app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  paystackWebhookRoutes,
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(compression(compressionOptions));
app.disable("x-powered-by");

//api routes
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/payment", paymentRoutes);

//handle 404 and global error
app.use(notFoundRoutes);
app.use(appErrorHandler);

export default app;
