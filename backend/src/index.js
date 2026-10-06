import "dotenv/config";

import { pool } from "./db/database.js";
import { app } from "./app.js";

import { createServer } from "http";
import { Server } from "socket.io";
import { verifySocketJWT } from "./middleware/socket.middleware.js";

/*
============================================================
SERVER SETUP
============================================================
*/

const PORT = process.env.PORT || 5000;

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

io.use(verifySocketJWT);

/*
============================================================
ONLINE USERS
============================================================

Map structure:

userId -> Set of socket IDs

Example:

{
  "user-123": Set(["socket-1", "socket-2"]),
  "user-456": Set(["socket-3"])
}

This allows the same user to be connected
from multiple browser tabs/devices.
============================================================
*/

const onlineUsers = new Map();
const activeCalls = new Map();

/*
============================================================
RECEIPT HELPER
============================================================
*/

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

/*
============================================================
SOCKET CONNECTION
============================================================
*/

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  console.log("Authenticated user:", socket.user);

  const userId = socket.user._id;

  /*
  ==========================================================
  PRESENCE
  ==========================================================
  */

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

  socket.on("call-recovery-ready", () => {
    console.log("🔥 call-recovery-ready RECEIVED:", socket.user.username);
    const activeCall = activeCalls.get(userId);

    if (!activeCall) {
      console.log("No active call to recover for:", socket.user.username);
      return;
    }

    if (activeCall.timeoutId) {
      clearTimeout(activeCall.timeoutId);
      activeCall.timeoutId = null;
    }

    console.log(
      "Sending call recovery to:",
      socket.user.username,
      "Peer:",
      activeCall.peerId,
    );

    socket.emit("resume-call", {
      remoteUserId: activeCall.peerId,
      callType: activeCall.callType,
    });
  });

  /*
  ==========================================================
  DISCONNECT
  ==========================================================
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

      const call = activeCalls.get(userId);
      if (call) {
        call.timeoutId = setTimeout(() => {
          const c = activeCalls.get(userId);
          if (c) {
            const peerSockets = onlineUsers.get(c.peerId);
            if (peerSockets) {
              peerSockets.forEach((socketId) => {
                io.to(socketId).emit("call-ended");
              });
            }
            activeCalls.delete(c.peerId);
          }
          activeCalls.delete(userId);
        }, 15000);
      }
    }
  });

  /*
  ==========================================================
  ROOM
  ==========================================================
  */

  /*
  ----------------------------------------------------------
  JOIN ROOM
  ----------------------------------------------------------
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
  ==========================================================
  MESSAGES
  ==========================================================
  */

  /*
  ----------------------------------------------------------
  SEND MESSAGE
  ----------------------------------------------------------
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

      /*
      --------------------------------------------------------
      SAVE MESSAGE
      --------------------------------------------------------
      */

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

      /*
      --------------------------------------------------------
      GET SENDER USERNAME
      --------------------------------------------------------
      */

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

      /*
      --------------------------------------------------------
      ACKNOWLEDGE SENDER
      --------------------------------------------------------
      */

      callback({
        success: true,
        message: newMessage,
      });

      /*
      --------------------------------------------------------
      FIND OTHER ROOM MEMBERS
      --------------------------------------------------------
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
      --------------------------------------------------------
      DELIVER TO ONLINE USERS
      --------------------------------------------------------
      */

      for (const recipient of recipients.rows) {
        const recipientId = recipient.user_id;

        const recipientSockets = onlineUsers.get(recipientId);

        if (!recipientSockets) {
          // User is offline.
          // No delivered_at yet.
          continue;
        }

        /*
        ------------------------------------------------------
        CREATE / UPDATE DELIVERY RECEIPT
        ------------------------------------------------------
        */

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

        /*
        ------------------------------------------------------
        SEND MESSAGE TO RECIPIENT SOCKETS
        ------------------------------------------------------
        */

        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("new-message", newMessage);
        });

        /*
        ------------------------------------------------------
        UPDATE SENDER RECEIPT STATUS
        ------------------------------------------------------
        */

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
  ==========================================================
  READ RECEIPTS
  ==========================================================
  */

  /*
  ----------------------------------------------------------
  MARK ROOM AS READ
  ----------------------------------------------------------
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
  ----------------------------------------------------------
  MARK SINGLE MESSAGE AS READ
  ----------------------------------------------------------
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
  ----------------------------------------------------------
  SYNC ROOM RECEIPTS
  ----------------------------------------------------------
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
  ==========================================================
  TYPING INDICATORS
  ==========================================================
  */

  /*
  ----------------------------------------------------------
  START TYPING
  ----------------------------------------------------------
  */

  socket.on("start-typing", ({ roomId }) => {
    socket.to(roomId).emit("user-typing", {
      userId: socket.user._id,
      username: socket.user.username,
    });
  });

  /*
  ----------------------------------------------------------
  STOP TYPING
  ----------------------------------------------------------
  */

  socket.on("stop-typing", ({ roomId }) => {
    socket.to(roomId).emit("user-stopped-typing", {
      userId: socket.user._id,
    });
  });

  /*
  ==========================================================
  WEBRTC SIGNALING
  ==========================================================
  */

  /*
  ----------------------------------------------------------
  CALL USER
  ----------------------------------------------------------
  */

  socket.on("call-user", ({ to, callType }) => {
    console.log(
      "call-user received. From:",
      socket.user.username,
      "Type:",
      callType,
    );

    console.log("Calling user ID:", to);

    if (activeCalls.has(to) || activeCalls.has(socket.user._id)) {
      socket.emit("call-error", {
        message: "User is busy",
      });
      socket.emit("call-rejected", {
        username: "System",
      });
      return;
    }

    activeCalls.set(socket.user._id, { peerId: to, status: "ringing", callType });
    activeCalls.set(to, { peerId: socket.user._id, status: "ringing", callType });

    const recipientSockets = onlineUsers.get(to);

    if (!recipientSockets) {
      console.log("Recipient is offline");
      activeCalls.delete(socket.user._id);
      activeCalls.delete(to);

      socket.emit("call-error", {
        message: "User is offline",
      });

      return;
    }

    recipientSockets.forEach((socketId) => {
      console.log("Sending incoming-call to:", socketId);

      io.to(socketId).emit("incoming-call", {
        from: socket.user._id,
        username: socket.user.username,
        callType,
      });
    });
  });

  /*
  ----------------------------------------------------------
  ACCEPT CALL
  ----------------------------------------------------------
  */

  socket.on("accept-call", ({ to, callType }) => {
    console.log("accept-call received from:", socket.user.username);

    console.log("Sending acceptance to:", to);

    const c1 = activeCalls.get(socket.user._id);
    if (c1) { c1.status = "in-call"; c1.callType = callType; }
    else activeCalls.set(socket.user._id, { peerId: to, status: "in-call", callType });

    const c2 = activeCalls.get(to);
    if (c2) { c2.status = "in-call"; c2.callType = callType; }
    else activeCalls.set(to, { peerId: socket.user._id, status: "in-call", callType });

    const recipientSockets = onlineUsers.get(to);

    if (!recipientSockets) {
      console.log("Caller is offline");

      socket.emit("call-error", {
        message: "User is offline",
      });

      return;
    }

    recipientSockets.forEach((socketId) => {
      console.log("Sending call-accepted to socket:", socketId);

      io.to(socketId).emit("call-accepted", {
        from: socket.user._id,
        username: socket.user.username,
      });
    });
  });

  const cleanupCall = (u1, u2) => {
    const c1 = activeCalls.get(u1);
    if (c1 && c1.timeoutId) clearTimeout(c1.timeoutId);
    const c2 = activeCalls.get(u2);
    if (c2 && c2.timeoutId) clearTimeout(c2.timeoutId);
    activeCalls.delete(u1);
    activeCalls.delete(u2);
  };

  socket.on("end-call", ({ to }) => {
    cleanupCall(socket.user._id, to);
    const recipientSockets = onlineUsers.get(to);

    if (!recipientSockets) {
      return;
    }

    recipientSockets.forEach((socketId) => {
      io.to(socketId).emit("call-ended");
    });
  });

  /*
  ----------------------------------------------------------
  ACCEPT CALL
  ----------------------------------------------------------
  */

  socket.on("reject-call", ({ to }) => {
    console.log("reject-call received from:", socket.user.username);
    cleanupCall(socket.user._id, to);

    const recipientSockets = onlineUsers.get(to);

    if (!recipientSockets) {
      return;
    }

    recipientSockets.forEach((socketId) => {
      io.to(socketId).emit("call-rejected", {
        from: socket.user._id,
        username: socket.user.username,
      });
    });
  });

  /*
  ----------------------------------------------------------
  WEBRTC OFFER
  ----------------------------------------------------------
  */

  socket.on("webrtc-offer", ({ to, offer, callType, isRecovery }) => {
    console.log("WebRTC offer received from:", socket.user.username);

    if (callType) {
      const c1 = activeCalls.get(socket.user._id);
      if (c1) c1.callType = callType;
      const c2 = activeCalls.get(to);
      if (c2) c2.callType = callType;
    }

    console.log("Sending offer to:", to);

    const recipientSockets = onlineUsers.get(to);

    if (!recipientSockets) {
      console.log("User is offline");

      socket.emit("call-error", {
        message: "User is offline",
      });

      return;
    }

    recipientSockets.forEach((socketId) => {
      io.to(socketId).emit("webrtc-offer", {
        from: socket.user._id,
        username: socket.user.username,
        offer,
        isRecovery,
      });
    });
  });

  socket.on("webrtc-answer", ({ to, answer }) => {
    console.log("WebRTC answer received from:", socket.user.username);

    console.log("Sending answer to:", to);

    const recipientSockets = onlineUsers.get(to);

    if (!recipientSockets) {
      console.log("User is offline");

      socket.emit("call-error", {
        message: "User is offline",
      });

      return;
    }

    recipientSockets.forEach((socketId) => {
      io.to(socketId).emit("webrtc-answer", {
        from: socket.user._id,
        username: socket.user.username,
        answer,
      });
    });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    console.log("ICE candidate received from:", socket.user.username);

    const recipientSockets = onlineUsers.get(to);

    if (!recipientSockets) {
      console.log("User is offline");
      return;
    }

    recipientSockets.forEach((socketId) => {
      io.to(socketId).emit("ice-candidate", {
        from: socket.user._id,
        candidate,
      });
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

/*
============================================================
START SERVER
============================================================
*/

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
