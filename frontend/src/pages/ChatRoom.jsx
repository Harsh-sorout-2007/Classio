import { useEffect, useRef, useState } from "react";
import socket from "../services/socket";

function ChatRoom({ roomId, onBack, onLogout, currentUser, onlineUsers }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [deliveredMessages, setDeliveredMessages] = useState(new Set());
  const [readMessages, setReadMessages] = useState(new Set());
  const [userRooms, setUserRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, type = "success") => {
    const id = Date.now();

    setToasts((prev) => [...prev, { id, msg, type }]);

    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  };

  const [roomDetails, setRoomDetails] = useState(null);
  const [members, setMembers] = useState([]);

  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomDesc, setEditRoomDesc] = useState("");

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editMessageContent, setEditMessageContent] = useState("");

  const messagesEndRef = useRef(null);
  const typingTimer = useRef(null);

  const getMessages = async () => {
    setIsLoadingMessages(true);

    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/messages`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        setMessages(data.data.messages);
        markMessagesAsRead(data.data.messages);
      }
    } catch (error) {
      console.error("Error getting messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const syncReceipts = () => {
    socket.emit("sync-room-receipts", roomId, (response) => {
      if (!response.success) {
        console.error("Failed to sync receipts:", response.error);

        return;
      }

      const delivered = new Set();
      const read = new Set();

      response.receipts.forEach((receipt) => {
        /*
          Group message is delivered only when
          EVERY recipient has received it.
        */

        if (
          receipt.total_recipients > 0 &&
          receipt.delivered_count === receipt.total_recipients
        ) {
          delivered.add(receipt.message_id);
        }

        /*
          Group message is read only when
          EVERY recipient has read it.
        */

        if (
          receipt.total_recipients > 0 &&
          receipt.read_count === receipt.total_recipients
        ) {
          read.add(receipt.message_id);
        }
      });

      setDeliveredMessages(delivered);
      setReadMessages(read);
    });
  };

  const markMessagesAsRead = (messages) => {
    messages.forEach((msg) => {
      if (msg.user_id !== currentUser.id) {
        console.log("Marking message as read:", msg.id);
        socket.emit("message-read", {
          messageId: msg.id,
        });
      }
    });
  };

  const getMembers = async () => {
    setIsLoadingMembers(true);

    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/members`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        setMembers(data.data.members);
      }
    } catch (error) {
      console.error("Error getting members:", error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/v1/room/", {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json();
        if (response.ok) {
          setUserRooms(data.data.rooms);
        }
      } catch (error) {
        console.error("Error getting rooms:", error);
      } finally {
        setIsLoadingRooms(false);
      }
    };
    fetchRooms();
  }, []);

  useEffect(() => {
    const getJoinRequests = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/v1/room/${roomId}/join-requests`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        const data = await response.json();

        if (response.ok) {
          setJoinRequests(data.data.requests);
          setIsOwner(true);
        } else {
          if (response.status === 403) {
            setIsOwner(false);
          }
        }
      } catch (error) {
        console.error("Error getting join requests:", error);
      }
    };

    const getRoomDetails = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/v1/room/${roomId}`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        const data = await response.json();

        if (response.ok) {
          setRoomDetails(data.data.room);
          setEditRoomName(data.data.room.name);
          setEditRoomDesc(data.data.room.description);
        }
      } catch (error) {
        console.error("Error getting room details:", error);
      }
    };

    getMessages();
    getJoinRequests();
    getRoomDetails();
    getMembers();

    const handleConnect = () => {
      socket.emit("join-room", roomId);
    };

    if (socket.connected) {
      socket.emit("join-room", roomId);
    } else {
      socket.on("connect", handleConnect);
    }

    socket.on("joined-room", () => {
      getMessages();

      socket.emit("mark-room-read", roomId, () => {
        syncReceipts();
      });
    });

    socket.on("join-room-error", (message) => {
      console.error("Join room error:", message);
    });

    socket.on("new-message", (message) => {
      setMessages((previousMessages) => {
        const alreadyExists = previousMessages.some(
          (existingMessage) => existingMessage.id === message.id,
        );

        if (alreadyExists) {
          return previousMessages;
        }

        return [...previousMessages, message];
      });

      /*
    If this message was sent by someone else,
    we are currently inside the room, so mark it
    as read immediately.
  */

      if (message.user_id !== currentUser.id) {
        socket.emit("message-read", {
          messageId: message.id,
        });
      }
    });

    socket.on(
      "receipt-update",
      ({ messageId, totalRecipients, deliveredCount, readCount }) => {
        /*
      Delivered to everyone
    */

        if (totalRecipients > 0 && deliveredCount === totalRecipients) {
          setDeliveredMessages((previous) => {
            const updated = new Set(previous);

            updated.add(messageId);

            return updated;
          });
        }

        /*
      Read by everyone
    */

        if (totalRecipients > 0 && readCount === totalRecipients) {
          setReadMessages((previous) => {
            const updated = new Set(previous);

            updated.add(messageId);

            return updated;
          });
        }
      },
    );

    socket.on("message-delivered", ({ messageId }) => {
      setDeliveredMessages((previous) => {
        const updated = new Set(previous);
        updated.add(messageId);
        return updated;
      });
    });

    socket.on("message-error", (message) => {
      console.error("Message error:", message);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    socket.on("disconnect", () => {
      setTypingUsers(new Map());
    });

    socket.on("user-typing", ({ userId, username }) => {
      setTypingUsers((previous) => {
        const updated = new Map(previous);
        updated.set(userId, username);
        return updated;
      });
    });

    socket.on("user-stopped-typing", ({ userId }) => {
      setTypingUsers((previous) => {
        const updated = new Map(previous);
        updated.delete(userId);
        return updated;
      });
    });

    return () => {
      clearTimeout(typingTimer.current);

      socket.off("connect", handleConnect);
      socket.off("joined-room");
      socket.off("join-room-error");
      socket.off("new-message");
      socket.off("receipt-update");
      socket.off("message-error");
      socket.off("connect_error");
      socket.off("user-typing");
      socket.off("user-stopped-typing");
    };
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const handleRequestAction = async (requestId, action) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/join-requests/${requestId}/${action}`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        addToast(`Request ${action}d successfully`);

        setJoinRequests((prev) => prev.filter((req) => req.id !== requestId));

        await getMembers();
      } else {
        addToast(data.message || `Failed to ${action} request`, "error");
      }
    } catch (error) {
      addToast(`Error ${action}ing request`, "error");
    }
  };

  const leaveRoom = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/leave`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Room left successfully");
        onBack();
      } else {
        alert(data.message || "Failed to leave room");
      }
    } catch (error) {
      alert("Error leaving room");
    }
  };

  const deleteRoom = async () => {
    if (!window.confirm("Are you sure you want to delete this room?")) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Room deleted successfully");
        onBack();
      } else {
        alert(data.message || "Failed to delete room");
      }
    } catch (error) {
      alert("Error deleting room");
    }
  };

  const submitEditRoom = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: editRoomName,
            description: editRoomDesc,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Room updated successfully");
        setRoomDetails(data.data.room);
        setIsEditingRoom(false);
      } else {
        alert(data.message || "Failed to update room");
      }
    } catch (error) {
      alert("Error updating room");
    }
  };

  const submitEditMessage = async (messageId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            content: editMessageContent,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: editMessageContent,
                }
              : msg,
          ),
        );

        setEditingMessageId(null);
        setEditMessageContent("");
      } else {
        alert(data.message || "Failed to edit message");
      }
    } catch (error) {
      alert("Error editing message");
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/messages/${messageId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      } else {
        alert(data.message || "Failed to delete message");
      }
    } catch (error) {
      alert("Error deleting message");
    }
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);

    socket.emit("start-typing", {
      roomId,
      userId: currentUser.id,
    });

    clearTimeout(typingTimer.current);

    typingTimer.current = setTimeout(() => {
      socket.emit("stop-typing", {
        roomId,
        userId: currentUser.id,
      });
    }, 1000);
  };

  const sendMessage = () => {
    if (!message.trim()) {
      return;
    }

    const content = message.trim();

    socket.emit(
      "send-message",
      {
        roomId,
        content,
      },
      (response) => {
        if (!response.success) {
          console.log("Message failed:", response.error);

          return;
        }

        /*
        The server already saved the message.

        Add it immediately to OUR UI.
      */

        setMessages((previousMessages) => {
          const alreadyExists = previousMessages.some(
            (existingMessage) => existingMessage.id === response.message.id,
          );

          if (alreadyExists) {
            return previousMessages;
          }

          return [...previousMessages, response.message];
        });
      },
    );

    setMessage("");
  };

  return (
    <div style={{ display: "flex", flex: 1, minWidth: 0, height: "100%" }}>
      <div className="chat-core">
        <div className="chat-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <button className="icon-btn ghost" onClick={onBack} title="Close Chat" style={{ marginRight: -4 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                <span style={{ color: "var(--color-text-muted)" }}>#</span>

                {roomDetails ? roomDetails.name : "Loading..."}

                {roomDetails && roomDetails.is_private && (
                  <span
                    className="badge private"
                    style={{
                      padding: "2px 6px",
                      fontSize: 10,
                    }}
                  >
                    Private
                  </span>
                )}
              </div>

              {roomDetails && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {roomDetails.description}
                </div>
              )}
            </div>
          </div>

          <div style={{ position: "relative" }}>
            {!isOwner ? (
              <button className="danger" onClick={leaveRoom}>
                Leave Room
              </button>
            ) : (
              <button
                className="icon-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            )}

            {isMenuOpen && isOwner && (
              <>
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 99,
                  }}
                  onClick={() => setIsMenuOpen(false)}
                ></div>

                <div className="overflow-menu">
                  <button
                    className="menu-item"
                    onClick={() => {
                      setIsEditingRoom(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    ✎ Edit Room Settings
                  </button>

                  <div className="menu-divider"></div>

                  <button
                    className="menu-item danger"
                    onClick={() => {
                      deleteRoom();
                      setIsMenuOpen(false);
                    }}
                  >
                    🗑 Delete Room
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {isEditingRoom && (
          <div
            style={{
              padding: "16px 24px",
              background: "var(--color-surface)",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            <h4 style={{ marginBottom: 12 }}>Edit Room Settings</h4>

            <div style={{ display: "flex", gap: 12 }}>
              <input
                value={editRoomName}
                onChange={(e) => setEditRoomName(e.target.value)}
                style={{ flex: 1 }}
              />

              <input
                value={editRoomDesc}
                onChange={(e) => setEditRoomDesc(e.target.value)}
                style={{ flex: 2 }}
              />

              <button className="primary" onClick={submitEditRoom}>
                Save Changes
              </button>

              <button className="ghost" onClick={() => setIsEditingRoom(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="chat-history">
          {isLoadingMessages ? (
            <div
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 16,
                  }}
                >
                  <div
                    className="skeleton"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                    }}
                  ></div>

                  <div style={{ flex: 1 }}>
                    <div
                      className="skeleton"
                      style={{
                        width: 120,
                        height: 16,
                        marginBottom: 8,
                      }}
                    ></div>

                    <div
                      className="skeleton"
                      style={{
                        width: "60%",
                        height: 16,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              <h3>No messages yet</h3>
              <p>Be the first to say hello.</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const prevMsg = messages[index - 1];
              const nextMsg = messages[index + 1];

              const isGroupedWithPrev =
                prevMsg &&
                prevMsg.username === msg.username &&
                new Date(msg.created_at) - new Date(prevMsg.created_at) < 300000;

              const isGroupedWithNext =
                nextMsg &&
                nextMsg.username === msg.username &&
                new Date(nextMsg.created_at) - new Date(msg.created_at) < 300000;

              let bubblePosition = "single";
              if (isGroupedWithPrev && isGroupedWithNext) bubblePosition = "middle";
              else if (isGroupedWithPrev && !isGroupedWithNext) bubblePosition = "last";
              else if (!isGroupedWithPrev && isGroupedWithNext) bubblePosition = "first";

              const isMine = msg.username === currentUser?.username;
              const alignClass = isMine ? "mine" : "theirs";

              return (
                <div
                  key={msg.id}
                  className={`message-row ${alignClass} ${!isGroupedWithPrev ? "new-group" : ""}`}
                >
                  {/* For 'theirs' we show the name on the first message of a group */}
                  {!isMine && !isGroupedWithPrev && (
                    <div className="msg-author-name">{msg.username}</div>
                  )}

                  <div className={`bubble-container ${alignClass} ${!isMine && isGroupedWithNext ? "no-avatar" : ""}`}>
                    {!isMine && !isGroupedWithNext && (
                      <div className="msg-avatar">
                        {msg.username.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className={`msg-bubble ${bubblePosition}`}>
                      {editingMessageId === msg.id ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={editMessageContent}
                            onChange={(e) => setEditMessageContent(e.target.value)}
                            autoFocus
                            style={{ padding: "4px 8px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
                          />
                          <button className="primary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => submitEditMessage(msg.id)}>
                            Save
                          </button>
                          <button className="ghost" style={{ padding: "4px 8px", fontSize: 12, color: "#fff" }} onClick={() => setEditingMessageId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="msg-content">
                          {msg.content}
                        </div>
                      )}
                    </div>

                    <div className="bubble-meta">
                      {isMine && editingMessageId !== msg.id && (
                        <div className="msg-actions">
                          <button
                            className="icon-btn ghost"
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditMessageContent(msg.content);
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                            </svg>
                          </button>
                          <button
                            className="icon-btn ghost danger"
                            onClick={() => deleteMessage(msg.id)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      )}

                      <span className="msg-time">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      
                      {isMine && deliveredMessages.has(msg.id) && (
                        <span className={`msg-receipt ${readMessages.has(msg.id) ? "read" : deliveredMessages.has(msg.id) ? "delivered" : "sent"}`}>
                          {readMessages.has(msg.id) ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} style={{ height: 24 }} />
        </div>

        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            <span className="typing-dots">
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </span>
            <span className="typing-text">
              {typingUsers.size === 1
                ? `${Array.from(typingUsers.values())[0]} is typing...`
                : `${typingUsers.size} people are typing...`}
            </span>
          </div>
        )}
        <div className="composer-wrapper">
          <div className="composer-box">
            <button
              className="icon-btn ghost"
              style={{ color: "var(--color-text-muted)" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>

            <textarea
              placeholder={`Message ${
                roomDetails ? "#" + roomDetails.name : "..."
              }`}
              value={message}
              onChange={handleMessageChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
            />

            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={!message.trim()}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="chat-panel">
        <div className="panel-section">
          <h4
            style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            Members <span>{members.length}</span>
          </h4>

          {isLoadingMembers ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div
                    className="skeleton"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                    }}
                  ></div>

                  <div
                    className="skeleton"
                    style={{
                      flex: 1,
                      height: 14,
                    }}
                  ></div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {members.map((member) => (
                <div key={member.id} className="member-row">
                  <div className="member-avatar-wrapper">
                    <div className="member-avatar">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={`member-status-dot ${
                        onlineUsers.has(member.id) ? "online" : "offline"
                      }`}
                      title={onlineUsers.has(member.id) ? "Online" : "Offline"}
                      aria-label={
                        onlineUsers.has(member.id) ? "Online" : "Offline"
                      }
                    ></div>
                  </div>

                  <div className="member-name">{member.username}</div>

                  {member.role === "owner" && (
                    <span className="badge" style={{ fontSize: 9 }}>
                      OWNER
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isOwner && (
          <div className="panel-section">
            <h4
              style={{
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                color: "var(--color-brand)",
              }}
            >
              Join Requests
              {joinRequests.length > 0 && (
                <span
                  className="badge private"
                  style={{
                    background: "var(--color-brand)",
                    color: "#fff",
                  }}
                >
                  {joinRequests.length}
                </span>
              )}
            </h4>

            {joinRequests.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>
                No pending requests.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {joinRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      background: "var(--color-surface)",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        marginBottom: 8,
                      }}
                    >
                      {req.username}{" "}
                      <span
                        style={{
                          color: "var(--color-text-muted)",
                          fontWeight: 400,
                        }}
                      >
                        wants to join
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      <button
                        className="primary"
                        style={{
                          flex: 1,
                          padding: "4px 0",
                        }}
                        onClick={() => handleRequestAction(req.id, "approve")}
                      >
                        Approve
                      </button>

                      <button
                        className="danger"
                        style={{
                          flex: 1,
                          padding: "4px 0",
                        }}
                        onClick={() => handleRequestAction(req.id, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            paddingTop: 24,
          }}
        >
          <button
            className="danger"
            onClick={onLogout}
            style={{ width: "100%" }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === "success" ? "✓" : "✕"}
            </span>

            <span>{toast.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatRoom;
