import "dotenv/config";

import { pool } from "./db/database.js";
import { app } from "./app.js";

import { createServer } from "http";
import { Server } from "socket.io";
import { verifySocketJWT } from "./middleware/socket.middleware.js";

const PORT = process.env.PORT || 5000;

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

io.use(verifySocketJWT);

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  console.log("Authenticated user:", socket.user);

  const userId = socket.user._id;

  const wasOffline = !onlineUsers.has(userId);

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);
  socket.emit("online-users", Array.from(onlineUsers.keys()));

  if (wasOffline) {
    socket.broadcast.emit("user-online", {
      userId,
      username: socket.user.username,
    });
  }

  socket.on("disconnect", () => {
    const userId = socket.user._id;

    const userSockets = onlineUsers.get(userId);

    if (!userSockets) return;

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      onlineUsers.delete(userId);

      socket.broadcast.emit("user-offline", {
        userId,
        username: socket.user.username,
      });
    }
  });

  socket.on("join-room", async (roomId) => {
    try {
      const userId = socket.user._id;

      const existingRoom = await pool.query(
        `
      SELECT id
      FROM rooms
      WHERE id=$1
      `,
        [roomId],
      );

      if (existingRoom.rows.length === 0) {
        socket.emit("join-room-error", "Room not found");
        return;
      }

      const isMember = await pool.query(
        `
      SELECT id
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
      `,
        [roomId, userId],
      );

      if (isMember.rows.length === 0) {
        socket.emit("join-room-error", "You are not a member of this room");
        return;
      }

      socket.join(roomId);

      console.log(`${socket.user.username} joined room ${roomId}`);

      socket.emit("joined-room", roomId);
    } catch (error) {
      console.log("Error joining room:", error);
      socket.emit("join-room-error", "Could not join room");
    }
  });

  socket.on("send-message", async ({ roomId, content }) => {
    try {
      const userId = socket.user._id;

      const isMember = await pool.query(
        `
      SELECT id
      FROM room_members
      WHERE room_id=$1
        AND user_id=$2
      `,
        [roomId, userId],
      );

      if (isMember.rows.length === 0) {
        socket.emit("message-error", "You are not a member of this room");
        return;
      }

      const message = await pool.query(
        `
      INSERT INTO messages(room_id, user_id, content)
      VALUES($1, $2, $3)
      RETURNING id, room_id, user_id, content, created_at
      `,
        [roomId, userId, content],
      );

      const savedMessage = message.rows[0];

      const user = await pool.query(
        `
  SELECT username
  FROM users
  WHERE id=$1
  `,
        [userId],
      );

      const newMessage = {
        ...savedMessage,
        username: user.rows[0].username,
      };

      io.to(roomId).emit("new-message", newMessage);
    } catch (error) {
      console.log("Error sending message:", error);

      socket.emit("message-error", "Could not send message");
    }
  });

  socket.on("start-typing", async ({ roomId, userId }) => {
    socket.to(roomId).emit("user-typing", {
      userId: socket.user._id,
      username: socket.user.username,
    });
  });
  socket.on("stop-typing", async ({ roomId, userId }) => {
    socket.to(roomId).emit("user-stopped-typing", {
      userId: socket.user._id,
    });
  });
});

async function testDatabase() {
  const result = await pool.query("SELECT 1");
  console.log(result);
}

testDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("Error in connection ", err);
    process.exit(1);
  });
