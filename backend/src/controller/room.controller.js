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
    SELECT rooms.*
    FROM rooms
    JOIN room_members
        ON room_members.room_id=rooms.id
    WHERE room_members.user_id=$1
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
export { createRoom, getRooms, getRoomById, updateRoom, deleteRoom };
