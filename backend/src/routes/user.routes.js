import { Router } from "express";
import { getUsers } from "../controller/user.controller.js";
const router = Router();

router.route("/").get(getUsers);

export default router;
