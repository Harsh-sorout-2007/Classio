import React, { useEffect, useState } from "react";
import ChatRoom from "./ChatRoom";

function Messages({
  currentUser,
  onlineUsers,
  selectedRoomId,
  onRoomSelect,
  onLogout,
}) {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const getRooms = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/v1/room/", {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setRooms(data.data.rooms);
      }
    } catch (error) {
      console.error("Error getting rooms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getRooms();
  }, []);

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      {/* LEFT: Conversation List */}
      <div
        style={{
          width: 320,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-bg-secondary)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "24px 16px 16px" }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Messages</h2>
          <div style={{ position: "relative" }}>
            <svg
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-text-muted)",
              }}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                borderRadius: "1000px",
                background: "var(--color-bg-base)",
                paddingLeft: 36,
                border: "1px solid transparent",
                width: "100%",
                fontSize: 14,
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
          <div
            style={{
              padding: "8px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Recent
          </div>
          {isLoading ? (
            <div
              style={{
                padding: 16,
                color: "var(--color-text-muted)",
                textAlign: "center",
              }}
            >
              Loading...
            </div>
          ) : filteredRooms.length === 0 ? (
            <div
              style={{
                padding: 16,
                color: "var(--color-text-muted)",
                textAlign: "center",
              }}
            >
              No conversations found.
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isActive = room.id === selectedRoomId;
              return (
                <div
                  key={room.id}
                  onClick={() => onRoomSelect(room.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: isActive
                      ? "rgba(255, 255, 255, 0.05)"
                      : "transparent",
                    transition: "all var(--transition-fast)",
                    marginBottom: 4,
                  }}
                  onMouseEnter={(e) =>
                    !isActive &&
                    (e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.03)")
                  }
                  onMouseLeave={(e) =>
                    !isActive &&
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div
                    className="msg-avatar"
                    style={{ width: 44, height: 44, fontSize: 16 }}
                  >
                    {room.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--color-text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {room.name}
                      </span>
                      {/* Fake timestamp for visual structure, as we don't fetch last message from the room list API easily */}
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--color-text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        Active
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--color-text-secondary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Tap to view messages...
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: Active Chat Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          position: "relative",
        }}
      >
        {selectedRoomId ? (
          <ChatRoom
            roomId={selectedRoomId}
            onBack={() => onRoomSelect(null)}
            onLogout={onLogout}
            currentUser={currentUser}
            onlineUsers={onlineUsers}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle at center, rgba(88, 101, 242, 0.05) 0%, var(--color-bg-base) 70%)",
              textAlign: "center",
              padding: 40,
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, rgba(88,101,242,0.2), rgba(139,147,255,0.1))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 32,
                boxShadow: "0 0 60px rgba(88,101,242,0.1)",
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
            </div>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--color-text-primary)",
                marginBottom: 16,
              }}
            >
              YOUR CLASSROOMS,
              <br />
              YOUR CONVERSATIONS.
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "var(--color-text-secondary)",
                maxWidth: 400,
              }}
            >
              Pick a room from the left to start chatting, or explore new rooms
              in the Rooms tab.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;
