import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  approveJoinRequest,
  createRoom,
  deleteMessage,
  deleteRoom,
  getJoinRequests,
  getMembers,
  getMessages,
  getRoomById,
  getRooms,
  joinRoom,
  leaveRoom,
  rejectJoinRequest,
  sendMessage,
  updateMessage,
  updateRoom,
} from "../controller/room.controller.js";

const router = Router();

//create get members
router.route("/").post(verifyJWT, createRoom).get(verifyJWT, getRooms);
router.route("/:roomId/members").get(verifyJWT, getMembers);

//join leave join-requests
router.route("/:roomId/join").post(verifyJWT, joinRoom);
router.route("/:roomId/leave").post(verifyJWT, leaveRoom);
router.route("/:roomId/join-requests").get(verifyJWT, getJoinRequests);

//messages
router.route("/:roomId/messages").post(verifyJWT, sendMessage);
router.route("/:roomId/messages").get(verifyJWT, getMessages);
router.route("/:roomId/messages/:messageId").patch(verifyJWT, updateMessage);
router.route("/:roomId/messages/:messageId").delete(verifyJWT, deleteMessage);

//approve reject join request
router
  .route("/:roomId/join-requests/:requestId/approve")
  .post(verifyJWT, approveJoinRequest);
router
  .route("/:roomId/join-requests/:requestId/reject")
  .post(verifyJWT, rejectJoinRequest);

//get update delete room
router
  .route("/:roomId")
  .get(verifyJWT, getRoomById)
  .patch(verifyJWT, updateRoom)
  .delete(verifyJWT, deleteRoom);

export default router;
