import express from "express";
import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
const app = express();

app.use(express.json());

app.use("/api/v1/users", userRouter);
app.use("/api/v1/auth", authRouter);

export { app };
