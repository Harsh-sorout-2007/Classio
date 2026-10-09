import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { pool } from "../db/database.js";

const createRoom = asyncHandler(async (req, res) => {
  const { name, description, is_private } = req.body;
  const owner_id = req.user._id;

  const existingUser = await pool.query(
    `
        SELECT *
        FROM users
        WHERE id = $1
        `,
    [owner_id],
  );

  if (existingUser.rows.length === 0) {
    throw new ApiError(404, "User not found");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const room = await client.query(
      `
            INSERT INTO rooms(name, description, owner_id, is_private)
            VALUES($1, $2, $3, $4)
            RETURNING *
            `,
      [name, description, owner_id, is_private],
    );

    const createdRoom = room.rows[0];

    await client.query(
      `
            INSERT INTO room_members(room_id, user_id, role)
            VALUES($1, $2, $3)
            `,
      [createdRoom.id, owner_id, "owner"],
    );

    await client.query("COMMIT");

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          room: {
            id: createdRoom.id,
            name: createdRoom.name,
            description: createdRoom.description,
            owner: createdRoom.owner_id,
            is_private: createdRoom.is_private,
            created_at: createdRoom.created_at,
          },
        },
        "Room created successfully",
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

const getRooms = asyncHandler(async (req, res) => {
  const requestingUser = req.user._id;

  const existingUser = await pool.query(
    `
        SELECT *
        FROM users
        WHERE id = $1
        `,
    [requestingUser],
  );

  if (existingUser.rows.length === 0) {
    throw new ApiError(404, "User not found");
  }

  const rooms = await pool.query(
    `
    SELECT
    rooms.*,
    users.username AS owner_username
    FROM rooms
    JOIN users
      ON users.id = rooms.owner_id
    JOIN room_members
      ON room_members.room_id = rooms.id
    WHERE room_members.user_id = $1;
    `,
    [requestingUser],
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        rooms: rooms.rows,
      },
      "Rooms fetched successfully",
    ),
  );
});

const discoverRooms = asyncHandler(async (req, res) => {
  const requestingUser = req.user._id;

  const rooms = await pool.query(
    `
    SELECT
    rooms.*,
    users.username AS owner_username
    FROM rooms
    JOIN users
      ON users.id = rooms.owner_id
    WHERE rooms.id NOT IN (
      SELECT room_id
      FROM room_members
      WHERE user_id = $1
    )
    ORDER BY rooms.created_at DESC;
    `,
    [requestingUser],
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        rooms: rooms.rows,
      },
      "Rooms discovered successfully",
    ),
  );
});

const getRoomById = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const requestingUser = req.user._id;

  const existingUser = await pool.query(
    `
        SELECT *
        FROM users
        WHERE id = $1
        `,
    [requestingUser],
  );

  if (existingUser.rows.length === 0) {
    throw new ApiError(404, "User not found");
  }

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const room = await pool.query(
    `
    SELECT rooms.*
    FROM rooms
    JOIN room_members
        ON room_members.room_id=rooms.id
    WHERE rooms.id=$2
        AND room_members.user_id=$1
    `,
    [requestingUser, roomId],
  );

  if (room.rows.length === 0) {
    throw new ApiError(403, "You are not a member of this room");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        room: room.rows[0],
      },
      "Room fetched successfully",
    ),
  );
});

const updateRoom = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { roomId } = req.params;
  const requestingUser = req.user._id;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const room = await pool.query(
    `
    UPDATE rooms
    SET name=COALESCE($1, name),
    description=COALESCE($2, description)
    WHERE id=$3
    AND owner_id=$4
    RETURNING *
    `,
    [name, description, roomId, requestingUser],
  );

  if (room.rows.length === 0) {
    throw new ApiError(
      403,
      "You do not have permission to update room details",
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        room: room.rows[0],
      },
      "Room details updated successfully",
    ),
  );
});

const deleteRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const requestingUser = req.user._id;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const room = await pool.query(
    `
    DELETE 
    FROM rooms 
    WHERE id=$1
      AND owner_id=$2
    RETURNING *
    `,
    [roomId, requestingUser],
  );

  if (room.rows.length === 0) {
    throw new ApiError(403, "You do not have permission to delete this room");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Room deleted successfully"));
});

const getMembers = asyncHandler(async (req, res) => {
  const requestingUser = req.user._id;
  const { roomId } = req.params;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const isMember = await pool.query(
    `
      SELECT * 
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
    `,
    [roomId, requestingUser],
  );

  if (isMember.rows.length === 0) {
    throw new ApiError(
      403,
      "You cannot see member list as you are not member of room",
    );
  }

  const members = await pool.query(
    `
    SELECT users.id,users.username,users.avatar_url,room_members.role,room_members.joined_at
    FROM room_members 
    JOIN users
      ON room_members.user_id=users.id
    WHERE room_members.room_id=$1
    ORDER BY room_members.joined_at
    `,
    [roomId],
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        members: members.rows,
      },
      "Members fetched successfully",
    ),
  );
});

const joinRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const requestingUser = req.user._id;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const isMember = await pool.query(
    `
      SELECT * 
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
    `,
    [roomId, requestingUser],
  );

  if (isMember.rows.length !== 0) {
    throw new ApiError(409, "You are already member of this room");
  }

  if (existingRoom.rows[0].is_private) {
    const request = await pool.query(
      `
      INSERT INTO room_join_requests(room_id,user_id,status)
      VALUES($1,$2,$3)
      RETURNING *
      `,
      [roomId, requestingUser, "pending"],
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          request: request.rows[0],
        },
        "Room join request sent successfully",
      ),
    );
  } else {
    const member = await pool.query(
      `
      INSERT INTO room_members(room_id,user_id,role)
      VALUES($1,$2,$3)
      RETURNING *
      `,
      [roomId, requestingUser, "member"],
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          member: member.rows[0],
        },
        "Room joined successfully",
      ),
    );
  }
});

const getJoinRequests = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const requestingUser = req.user._id;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const isOwner = await pool.query(
    `
      SELECT * 
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
        AND role='owner'
    `,
    [roomId, requestingUser],
  );

  if (isOwner.rows.length === 0) {
    throw new ApiError(403, "You are not owner of this room");
  }

  const requests = await pool.query(
    `
    SELECT
    room_join_requests.id,
    room_join_requests.user_id,
    users.username,
    users.avatar_url,
    room_join_requests.status,
    room_join_requests.created_at
    FROM room_join_requests
    JOIN users
      ON room_join_requests.user_id = users.id
    WHERE room_join_requests.room_id = $1
      AND room_join_requests.status = 'pending'
    ORDER BY room_join_requests.created_at;
    `,
    [roomId],
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        requests: requests.rows,
      },
      "Requests fetched successfully",
    ),
  );
});

const approveJoinRequest = asyncHandler(async (req, res) => {
  const { roomId, requestId } = req.params;
  const requestingUser = req.user._id;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const isOwner = await pool.query(
    `
    SELECT *
    FROM room_members
    WHERE room_id=$1
      AND user_id=$2
      AND role='owner'
    `,
    [roomId, requestingUser],
  );

  if (isOwner.rows.length === 0) {
    throw new ApiError(403, "You are not owner of this room");
  }

  const validRequest = await pool.query(
    `
    SELECT *
    FROM room_join_requests
    WHERE room_id=$1
      AND id=$2
      AND status='pending'
    `,
    [roomId, requestId],
  );

  if (validRequest.rows.length === 0) {
    throw new ApiError(404, "Pending request not found");
  }

  const targetUser = validRequest.rows[0].user_id;

  const client = await pool.connect();

  let member;

  try {
    await client.query("BEGIN");

    const memberResult = await client.query(
      `
      INSERT INTO room_members(room_id, user_id, role)
      VALUES($1, $2, $3)
      RETURNING *
      `,
      [roomId, targetUser, "member"],
    );

    member = memberResult.rows[0];

    await client.query(
      `
      UPDATE room_join_requests
      SET status='approved'
      WHERE id=$1
      `,
      [requestId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        member,
      },
      "Request approved successfully",
    ),
  );
});

const rejectJoinRequest = asyncHandler(async (req, res) => {
  const { roomId, requestId } = req.params;
  const requestingUser = req.user._id;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const isOwner = await pool.query(
    `
    SELECT *
    FROM room_members
    WHERE room_id=$1
      AND user_id=$2
      AND role='owner'
    `,
    [roomId, requestingUser],
  );

  if (isOwner.rows.length === 0) {
    throw new ApiError(403, "You are not owner of this room");
  }

  const validRequest = await pool.query(
    `
    SELECT *
    FROM room_join_requests
    WHERE room_id=$1
      AND id=$2
      AND status='pending'
    `,
    [roomId, requestId],
  );

  if (validRequest.rows.length === 0) {
    throw new ApiError(404, "Pending request not found");
  }

  const rejectedRequest = await pool.query(
    `
      UPDATE room_join_requests
      SET status='rejected'
      WHERE id=$1
      RETURNING *
      `,
    [requestId],
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        request: rejectedRequest.rows[0],
      },
      "Request rejected successfully",
    ),
  );
});

const leaveRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const requestingUser = req.user._id;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const isMember = await pool.query(
    `
      SELECT * 
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
    `,
    [roomId, requestingUser],
  );

  if (isMember.rows.length === 0) {
    throw new ApiError(409, "You are not a member of this room");
  }

  const isOwner = await pool.query(
    `
    SELECT *
    FROM room_members
    WHERE room_id=$1
      AND user_id=$2
      AND role='owner'
    `,
    [roomId, requestingUser],
  );

  if (isOwner.rows.length !== 0) {
    throw new ApiError(403, "You are owner , you cannot leave the room");
  }

  await pool.query(
    `
    DELETE 
    FROM room_members
    WHERE room_id=$1
      AND user_id=$2
    `,
    [roomId, requestingUser],
  );

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Room left successfully"));
});

const sendMessage = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { content } = req.body;
  const { roomId } = req.params;

  if (!content || content.trim() === "") {
    throw new ApiError(400, "Message content is required");
  }

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const isMember = await pool.query(
    `
      SELECT * 
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
    `,
    [roomId, userId],
  );

  if (isMember.rows.length === 0) {
    throw new ApiError(403, "You are not a member of this room");
  }

  const message = await pool.query(
    `
    INSERT INTO messages(room_id,user_id,content)
    VALUES($1,$2,$3)
    RETURNING *
    `,
    [roomId, userId, content],
  );

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        message: {
          id: message.rows[0].id,
          room_id: message.rows[0].room_id,
          user_id: message.rows[0].user_id,
          content: message.rows[0].content,
          created_at: message.rows[0].created_at,
        },
      },
      "message sent successfully",
    ),
  );
});

const updateMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { roomId, messageId } = req.params;
  const userId = req.user._id;

  if (!content || content.trim() === "") {
    throw new ApiError(400, "Message content is required");
  }

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }
  const existingMessage = await pool.query(
    `
    SELECT *
    FROM messages 
    WHERE id=$1
      AND room_id=$2
    `,
    [messageId, roomId],
  );

  if (existingMessage.rows.length === 0) {
    throw new ApiError(404, "Message not found");
  }

  const isMember = await pool.query(
    `
      SELECT * 
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
    `,
    [roomId, userId],
  );

  if (isMember.rows.length === 0) {
    throw new ApiError(403, "You are not a member of this room");
  }

  const message = await pool.query(
    `
    UPDATE messages
    SET content=$1,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=$2
      AND user_id=$3
    RETURNING *
    `,
    [content, messageId, userId],
  );
  if (message.rows.length === 0) {
    throw new ApiError(
      403,
      "You do not have permission to update this message",
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        message: {
          id: message.rows[0].id,
          room_id: message.rows[0].room_id,
          user_id: message.rows[0].user_id,
          content: message.rows[0].content,
          updated_at: message.rows[0].updated_at,
        },
      },
      "message updated successfully",
    ),
  );
});

const getMessages = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user._id;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const isMember = await pool.query(
    `
      SELECT * 
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
    `,
    [roomId, userId],
  );

  if (isMember.rows.length === 0) {
    throw new ApiError(403, "You are not a member of this room");
  }

  const messages = await pool.query(
    `
    SELECT messages.id,messages.user_id,users.username,messages.content,messages.created_at
    FROM messages
    JOIN users
      ON users.id=messages.user_id
    WHERE messages.room_id=$1
    ORDER BY messages.created_at ASC
    `,
    [roomId],
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        messages: messages.rows,
      },
      "Messages fetched successfully",
    ),
  );
});

const deleteMessage = asyncHandler(async (req, res) => {
  const { roomId, messageId } = req.params;
  const userId = req.user._id;

  const existingRoom = await pool.query(
    `
    SELECT *
    FROM rooms 
    WHERE id=$1
    `,
    [roomId],
  );

  if (existingRoom.rows.length === 0) {
    throw new ApiError(404, "Room not found");
  }
  const existingMessage = await pool.query(
    `
    SELECT *
    FROM messages 
    WHERE id=$1
      AND room_id=$2
    `,
    [messageId, roomId],
  );

  if (existingMessage.rows.length === 0) {
    throw new ApiError(404, "Message not found");
  }

  const isMember = await pool.query(
    `
      SELECT * 
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
    `,
    [roomId, userId],
  );

  if (isMember.rows.length === 0) {
    throw new ApiError(403, "You are not a member of this room");
  }

  const message = await pool.query(
    `
    DELETE 
    FROM messages
    WHERE id=$1
      AND user_id=$2
      AND room_id=$3
    RETURNING *
    `,
    [messageId, userId, roomId],
  );

  if (message.rows.length === 0) {
    throw new ApiError(
      403,
      "You do not have permission to delete this message.",
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Message deleted successfully"));
});
const getIceServers = asyncHandler(async (req, res) => {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD,
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { iceServers }, "ICE servers fetched successfully"),
    );
});

export {
  createRoom,
  getRooms,
  discoverRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getMembers,
  joinRoom,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  leaveRoom,
  sendMessage,
  updateMessage,
  getMessages,
  deleteMessage,
  getIceServers,
};
