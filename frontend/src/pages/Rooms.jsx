import React, { useEffect, useState } from "react";

function RoomsPage({ onRoomSelect }) {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  };

  const getRooms = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "http://localhost:5000/api/v1/room/discover",
        {
          method: "GET",
          credentials: "include",
        },
      );
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

  const joinRoom = async (room) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${room.id}/join`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await response.json();
      if (response.ok) {
        addToast(
          room.is_private ? "Join request sent" : "Joined room successfully",
          "success",
        );
        onRoomSelect(room.id); // Navigate to it directly on join
      } else {
        addToast(data.message || "Failed to join room", "error");
      }
    } catch (error) {
      addToast("Error joining room", "error");
    }
  };

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      style={{
        flex: 1,
        padding: "48px 48px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1200 }}>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          Explore Classrooms
        </h1>
        <p className="text-muted" style={{ fontSize: 16, marginBottom: 32 }}>
          Discover communities and study groups to join.
        </p>

        <div style={{ position: "relative", maxWidth: 400, marginBottom: 40 }}>
          <svg
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted)",
            }}
            width="18"
            height="18"
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
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px 12px 48px",
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 1000,
              fontSize: 15,
            }}
          />
        </div>

        {isLoading ? (
          <div className="room-grid">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="room-card skeleton"
                style={{ height: 200 }}
              ></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: 16 }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <h3>No rooms found</h3>
            <p>Try a different search term.</p>
          </div>
        ) : (
          <div className="room-grid">
            {filtered.map((room) => {
              // We'll generate a consistent hue based on room ID or name
              const hue =
                [...room.name].reduce(
                  (acc, char) => acc + char.charCodeAt(0),
                  0,
                ) % 360;
              const identityColor = `hsl(${hue}, 70%, 60%)`;

              return (
                <div
                  key={room.id}
                  className="room-card"
                  style={{ position: "relative", overflow: "hidden" }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: identityColor,
                    }}
                  ></div>
                  <div className="room-header">
                    <div
                      className="room-avatar"
                      style={{
                        background: `hsla(${hue}, 70%, 60%, 0.1)`,
                        color: identityColor,
                      }}
                    >
                      {room.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="room-info">
                      <div className="room-title">{room.name}</div>
                      <div className="room-badges">
                        <span
                          className={`badge ${room.is_private ? "private" : ""}`}
                        >
                          {room.is_private ? "🔒 Private" : "🌎 Public"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="room-desc">{room.description}</div>
                  <div
                    className="room-footer"
                    style={{ justifyContent: "space-between" }}
                  >
                    <div
                      className="room-owner text-muted"
                      style={{
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: "rgba(255, 180, 50, 0.8)" }}
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                      <span>
                        Owner:{" "}
                        <strong
                          style={{
                            color: "var(--color-text-primary)",
                            fontWeight: 500,
                          }}
                        >
                          @{room.owner_username}
                        </strong>
                      </span>
                    </div>
                    <button className="primary" onClick={() => joinRoom(room)}>
                      {room.is_private ? "Request" : "Join"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === "success" ? "✓" : "✕"}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RoomsPage;
