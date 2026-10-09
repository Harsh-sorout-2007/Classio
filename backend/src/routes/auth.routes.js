import { Router } from "express";
import {
  loginUser,
  registerUser,
  refreshAccessToken,
  logoutUser,
} from "../controller/auth.controller.js";
import { authRateLimiter } from "../middleware/rateLimit.middleware.js";
import {
  registerValidator,
  loginValidator,
} from "../validators/auth.validator.js";
import { validate } from "../validators/validate.js";

const router = Router();

router
  .route("/register")
  .post(authRateLimiter, registerValidator, validate, registerUser);
router
  .route("/login")
  .post(authRateLimiter, loginValidator, validate, loginUser);
router.route("/refresh").post(refreshAccessToken);
router.route("/logout").post(logoutUser);

export default router;
