import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  createRoom,
  deleteRoom,
  getRoomById,
  getRooms,
  updateRoom,
} from "../controller/room.controller.js";

const router = Router();

router.route("/").post(verifyJWT, createRoom).get(verifyJWT, getRooms);
router
  .route("/:roomId")
  .get(verifyJWT, getRoomById)
  .patch(verifyJWT, updateRoom)
  .delete(verifyJWT, deleteRoom);

export default router;
