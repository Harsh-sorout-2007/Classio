import express from "express";
import cors from "cors";
import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
import roomRouter from "./routes/room.routes.js";
import cookieParser from "cookie-parser";
import { apiRateLimiter } from "./middleware/rateLimit.middleware.js";
const app = express();

if (process.env.TRUST_PROXY) {
  const proxySetting = isNaN(process.env.TRUST_PROXY)
    ? process.env.TRUST_PROXY
    : parseInt(process.env.TRUST_PROXY, 10);
  app.set("trust proxy", proxySetting);
}

const allowedOrigin = process.env.NODE_ENV === "production" ? process.env.CLIENT_URL : "http://localhost:5173";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use("/api", apiRateLimiter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/room", roomRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  if (err instanceof Error) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || "Internal Server Error",
      errors: err.errors || [],
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  } else {
    next(err);
  }
});

export { app };
