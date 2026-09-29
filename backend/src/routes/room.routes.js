import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  approveJoinRequest,
  createRoom,
  deleteRoom,
  getJoinRequests,
  getMembers,
  getRoomById,
  getRooms,
  joinRoom,
  leaveRoom,
  rejectJoinRequest,
  updateRoom,
} from "../controller/room.controller.js";

const router = Router();

router.route("/").post(verifyJWT, createRoom).get(verifyJWT, getRooms);
router.route("/:roomId/members").get(verifyJWT, getMembers);
router.route("/:roomId/join").post(verifyJWT, joinRoom);
router.route("/:roomId/leave").post(verifyJWT, leaveRoom);
router.route("/:roomId/join-requests").get(verifyJWT, getJoinRequests);
router
  .route("/:roomId/join-requests/:requestId/approve")
  .post(verifyJWT, approveJoinRequest);
router
  .route("/:roomId/join-requests/:requestId/reject")
  .post(verifyJWT, rejectJoinRequest);
router
  .route("/:roomId")
  .get(verifyJWT, getRoomById)
  .patch(verifyJWT, updateRoom)
  .delete(verifyJWT, deleteRoom);

export default router;
