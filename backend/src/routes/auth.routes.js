import { Router } from "express";
import {
  loginUser,
  registerUser,
  refreshAccessToken,
  logoutUser,
} from "../controller/auth.controller.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/refresh").post(refreshAccessToken);
router.route("/logout").post(logoutUser);

export default router;
