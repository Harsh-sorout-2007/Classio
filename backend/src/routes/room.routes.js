import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import {
  approveJoinRequest,
  createRoom,
  deleteMessage,
  deleteRoom,
  discoverRooms,
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
  getIceServers,
} from "../controller/room.controller.js";
import {
  createRoomValidator,
  updateRoomValidator,
} from "../validators/room.validator.js";
import { validate } from "../validators/validate.js";

const router = Router();

router.route("/ice-servers").get(verifyJWT, getIceServers);

//create get members
router
  .route("/")
  .post(verifyJWT, createRoomValidator, validate, createRoom)
  .get(verifyJWT, getRooms);
router.route("/discover").get(verifyJWT, discoverRooms);
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
  .patch(verifyJWT, updateRoomValidator, validate, updateRoom)
  .delete(verifyJWT, deleteRoom);

export default router;
