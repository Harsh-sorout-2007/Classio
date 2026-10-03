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

const emitReceiptUpdate = async (messageId) => {
  try {
    const result = await pool.query(
      `
      SELECT
        m.user_id AS sender_id,

        COUNT(rm.user_id)::int AS total_recipients,

        COUNT(
          CASE
            WHEN mr.delivered_at IS NOT NULL
            THEN 1
          END
        )::int AS delivered_count,

        COUNT(
          CASE
            WHEN mr.read_at IS NOT NULL
            THEN 1
          END
        )::int AS read_count

      FROM messages m

      JOIN room_members rm
        ON rm.room_id = m.room_id
       AND rm.user_id <> m.user_id

      LEFT JOIN message_receipts mr
        ON mr.message_id = m.id
       AND mr.user_id = rm.user_id

      WHERE m.id = $1

      GROUP BY m.id, m.user_id
      `,
      [messageId],
    );

    if (result.rows.length === 0) {
      return;
    }

    const receipt = result.rows[0];

    const senderSockets = onlineUsers.get(receipt.sender_id);

    if (!senderSockets) {
      return;
    }

    senderSockets.forEach((socketId) => {
      io.to(socketId).emit("receipt-update", {
        messageId,
        totalRecipients: receipt.total_recipients,
        deliveredCount: receipt.delivered_count,
        readCount: receipt.read_count,
      });
    });
  } catch (error) {
    console.error("Error emitting receipt update:", error);
  }
};

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

  /*
  ============================================================
  DISCONNECT
  ============================================================
  */

  socket.on("disconnect", () => {
    const userSockets = onlineUsers.get(userId);

    if (!userSockets) {
      return;
    }

    userSockets.delete(socket.id);

    if (userSockets.size === 0) {
      onlineUsers.delete(userId);

      socket.broadcast.emit("user-offline", {
        userId,
        username: socket.user.username,
      });
    }
  });

  /*
  ============================================================
  JOIN ROOM
  ============================================================
  */

  socket.on("join-room", async (roomId) => {
    try {
      const existingRoom = await pool.query(
        `
        SELECT id
        FROM rooms
        WHERE id = $1
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
        WHERE room_id = $1
          AND user_id = $2
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
      console.error("Error joining room:", error);

      socket.emit("join-room-error", "Could not join room");
    }
  });

  /*
  ============================================================
  SEND MESSAGE
  ============================================================
  */

  socket.on("send-message", async ({ roomId, content }, callback) => {
    try {
      const isMember = await pool.query(
        `
          SELECT id
          FROM room_members
          WHERE room_id = $1
            AND user_id = $2
          `,
        [roomId, userId],
      );

      if (isMember.rows.length === 0) {
        callback({
          success: false,
          error: "You are not a member of this room",
        });

        return;
      }

      const message = await pool.query(
        `
          INSERT INTO messages (
            room_id,
            user_id,
            content
          )
          VALUES ($1, $2, $3)

          RETURNING
            id,
            room_id,
            user_id,
            content,
            created_at
          `,
        [roomId, userId, content],
      );

      const savedMessage = message.rows[0];

      const user = await pool.query(
        `
          SELECT username
          FROM users
          WHERE id = $1
          `,
        [userId],
      );

      const newMessage = {
        ...savedMessage,
        username: user.rows[0].username,
      };

      callback({
        success: true,
        message: newMessage,
      });

      /*
        ========================================================
        FIND OTHER ROOM MEMBERS
        ========================================================
        */

      const recipients = await pool.query(
        `
          SELECT user_id
          FROM room_members
          WHERE room_id = $1
            AND user_id <> $2
          `,
        [roomId, userId],
      );

      /*
        ========================================================
        DELIVER TO ONLINE USERS
        ========================================================
        */

      for (const recipient of recipients.rows) {
        const recipientId = recipient.user_id;

        const recipientSockets = onlineUsers.get(recipientId);

        if (!recipientSockets) {
          // User is offline.
          // No delivered_at yet.
          continue;
        }

        await pool.query(
          `
            INSERT INTO message_receipts (
              message_id,
              user_id,
              delivered_at
            )
            VALUES (
              $1,
              $2,
              CURRENT_TIMESTAMP
            )

            ON CONFLICT (message_id, user_id)

            DO UPDATE SET
              delivered_at = COALESCE(
                message_receipts.delivered_at,
                CURRENT_TIMESTAMP
              )
            `,
          [savedMessage.id, recipientId],
        );

        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("new-message", newMessage);
        });

        await emitReceiptUpdate(savedMessage.id);
      }
    } catch (error) {
      console.error("Error sending message:", error);

      callback({
        success: false,
        error: "Could not send message",
      });
    }
  });

  /*
  ============================================================
  MARK ROOM AS READ
  ============================================================
  
  */

  socket.on("mark-room-read", async (roomId) => {
    try {
      const isMember = await pool.query(
        `
        SELECT id
        FROM room_members
        WHERE room_id = $1
          AND user_id = $2
        `,
        [roomId, userId],
      );

      if (isMember.rows.length === 0) {
        return;
      }

      const messages = await pool.query(
        `
        SELECT
          id,
          user_id
        FROM messages
        WHERE room_id = $1
          AND user_id <> $2
        `,
        [roomId, userId],
      );

      for (const message of messages.rows) {
        await pool.query(
          `
          INSERT INTO message_receipts (
            message_id,
            user_id,
            delivered_at,
            read_at
          )
          VALUES (
            $1,
            $2,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          ON CONFLICT (message_id, user_id)

          DO UPDATE SET
            delivered_at = COALESCE(
              message_receipts.delivered_at,
              CURRENT_TIMESTAMP
            ),

            read_at = COALESCE(
              message_receipts.read_at,
              CURRENT_TIMESTAMP
            )
          `,
          [message.id, userId],
        );

        await emitReceiptUpdate(message.id);
      }
    } catch (error) {
      console.error("Error marking room as read:", error);
    }
  });

  /*
============================================================
MARK SINGLE MESSAGE AS READ
============================================================
*/

  socket.on("message-read", async ({ messageId }) => {
    try {
      /*
      Find the message and make sure the current user
      is actually a recipient of that message.
    */

      const messageResult = await pool.query(
        `
      SELECT
        m.id,
        m.room_id,
        m.user_id AS sender_id
      FROM messages m

      JOIN room_members rm
        ON rm.room_id = m.room_id
       AND rm.user_id = $2

      WHERE m.id = $1
        AND m.user_id <> $2
      `,
        [messageId, userId],
      );

      if (messageResult.rows.length === 0) {
        return;
      }

      /*
      The message exists and this user is a recipient.

      Create the receipt if it doesn't exist,
      or update the existing receipt if it does.
    */

      await pool.query(
        `
      INSERT INTO message_receipts (
        message_id,
        user_id,
        delivered_at,
        read_at
      )
      VALUES (
        $1,
        $2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )

      ON CONFLICT (message_id, user_id)

      DO UPDATE SET
        delivered_at = COALESCE(
          message_receipts.delivered_at,
          CURRENT_TIMESTAMP
        ),

        read_at = COALESCE(
          message_receipts.read_at,
          CURRENT_TIMESTAMP
        )
      `,
        [messageId, userId],
      );

      /*
      Recalculate the complete receipt state
      and notify the sender immediately.
    */

      await emitReceiptUpdate(messageId);
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  });

  /*
  ============================================================
  SYNC RECEIPTS
  ============================================================

  */

  socket.on("sync-room-receipts", async (roomId, callback) => {
    try {
      const isMember = await pool.query(
        `
        SELECT id
        FROM room_members
        WHERE room_id = $1
          AND user_id = $2
        `,
        [roomId, userId],
      );

      if (isMember.rows.length === 0) {
        callback({
          success: false,
          error: "You are not a member of this room",
        });

        return;
      }

      const result = await pool.query(
        `
        SELECT
          m.id AS message_id,

          COUNT(rm.user_id)::int AS total_recipients,

          COUNT(
            CASE
              WHEN mr.delivered_at IS NOT NULL
              THEN 1
            END
          )::int AS delivered_count,

          COUNT(
            CASE
              WHEN mr.read_at IS NOT NULL
              THEN 1
            END
          )::int AS read_count

        FROM messages m

        JOIN room_members rm
          ON rm.room_id = m.room_id
         AND rm.user_id <> m.user_id

        LEFT JOIN message_receipts mr
          ON mr.message_id = m.id
         AND mr.user_id = rm.user_id

        WHERE m.room_id = $1
          AND m.user_id = $2

        GROUP BY m.id

        ORDER BY m.created_at ASC
        `,
        [roomId, userId],
      );

      callback({
        success: true,
        receipts: result.rows,
      });
    } catch (error) {
      console.error("Error syncing room receipts:", error);

      callback({
        success: false,
        error: "Could not sync receipts",
      });
    }
  });

  /*
  ============================================================
  TYPING
  ============================================================
  */

  socket.on("start-typing", ({ roomId }) => {
    socket.to(roomId).emit("user-typing", {
      userId: socket.user._id,
      username: socket.user.username,
    });
  });

  socket.on("stop-typing", ({ roomId }) => {
    socket.to(roomId).emit("user-stopped-typing", {
      userId: socket.user._id,
    });
  });
});

/*
============================================================
DATABASE TEST
============================================================
*/

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
    console.log("Error in connection", err);

    process.exit(1);
  });
