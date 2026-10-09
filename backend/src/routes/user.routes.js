import { Router } from "express";
import { getUsers } from "../controller/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
const router = Router();

router.route("/").get(verifyJWT, getUsers);

export default router;
