import { useEffect, useState } from "react";
import logo from "../assets/logo/classio-logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function RoomList({ onRoomSelect, onLogout, currentUser }) {
  const [rooms, setRooms] = useState([]);
  const [discoveredRooms, setDiscoveredRooms] = useState([]);
  const [activeTab, setActiveTab] = useState("my-rooms");

  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(true);

  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  };

  const getRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/room/`, {
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
      setIsLoadingRooms(false);
    }
  };

  const getDiscoveredRooms = async () => {
    setIsLoadingDiscover(true);
    try {
      const response = await fetch(
        `${API_URL}/api/v1/room/discover`,
        {
          method: "GET",
          credentials: "include",
        },
      );
      const data = await response.json();
      if (response.ok) {
        setDiscoveredRooms(data.data.rooms);
      }
    } catch (error) {
      console.error("Error getting discovered rooms:", error);
    } finally {
      setIsLoadingDiscover(false);
    }
  };

  useEffect(() => {
    getRooms();
    getDiscoveredRooms();
  }, []);

  const createRoom = async () => {
    if (!roomName.trim()) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/room/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: roomName,
          description: roomDescription,
          is_private: isPrivate,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRooms((prev) => [...prev, data.data.room]);
        setRoomName("");
        setRoomDescription("");
        setIsPrivate(false);
      } else {
        console.error("Failed to create room:", data.message);
      }
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  const joinRoom = async (room) => {
    try {
      const response = await fetch(
        `${API_URL}/api/v1/room/${room.id}/join`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await response.json();
      if (response.ok) {
        if (room.is_private) {
          addToast("Join request sent", "success");
        } else {
          addToast("Joined room successfully", "success");
        }
        getRooms();
        getDiscoveredRooms();
      } else {
        addToast(data.message || "Failed to join room", "error");
      }
    } catch (error) {
      addToast("Error joining room", "error");
    }
  };

  const renderRoomCards = (roomList, isDiscover = false) => {
    return (
      <div className="room-grid">
        {roomList.map((room) => (
          <div key={room.id} className="room-card">
            <div className="room-header">
              <div className="room-avatar">
                {room.name.charAt(0).toUpperCase()}
              </div>
              <div className="room-info">
                <div className="room-title">{room.name}</div>
                <div className="room-badges">
                  <span className={`badge ${room.is_private ? "private" : ""}`}>
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
              <button
                className={isDiscover ? "secondary" : "primary"}
                onClick={() =>
                  isDiscover ? joinRoom(room) : onRoomSelect(room.id)
                }
                style={!isDiscover ? { minWidth: "110px" } : {}}
              >
                {isDiscover ? (room.is_private ? "Request" : "Join") : "Open"}
              </button>
            </div>
          </div>
        ))}

        {!isDiscover && (
          <div
            className="room-card"
            style={{
              border: "1px dashed var(--color-border)",
              background: "transparent",
              boxShadow: "none",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              minHeight: "180px",
              transition: "all 0.15s ease-out",
            }}
            onClick={() => setActiveTab("create")}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
              e.currentTarget.style.background = "rgba(0, 149, 246, 0.05)";
              e.currentTarget.querySelector("svg").style.color =
                "var(--color-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.background = "transparent";
              e.currentTarget.querySelector("svg").style.color =
                "var(--color-text-muted)";
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: 12, transition: "color 0.15s ease-out" }}
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <span
              style={{
                color: "var(--color-text-primary)",
                fontWeight: 500,
                fontSize: 15,
              }}
            >
              {roomList.length === 0
                ? "Create your first room"
                : "+ Create a new room"}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      <div className="shell-sidebar">
        <div className="shell-header">
          <div className="brand-logo" style={{ fontSize: 16 }}>
            <img
              src={logo}
              alt="Classio Logo"
              className="brand-icon"
              style={{ width: 24, height: 24 }}
            />
            Classio
          </div>
        </div>

        <div style={{ padding: "16px 16px 8px" }}>
          <div style={{ position: "relative" }}>
            <svg
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-text-muted)",
              }}
              width="14"
              height="14"
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
              style={{
                borderRadius: "1000px",
                background: "#1D2129",
                paddingLeft: 36,
                paddingTop: 8,
                paddingBottom: 8,
                border: "none",
                width: "100%",
                fontSize: 14,
              }}
            />
          </div>
        </div>

        <div className="shell-nav">
          <h4
            style={{
              padding: "8px 16px 8px",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-text-muted)",
            }}
          >
            Workspace
          </h4>
          <button
            className={`nav-link no-prefix ${activeTab === "my-rooms" ? "active" : ""}`}
            onClick={() => setActiveTab("my-rooms")}
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
              style={{
                opacity: activeTab === "my-rooms" ? 1 : 0.5,
                color:
                  activeTab === "my-rooms" ? "var(--color-accent)" : "inherit",
              }}
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            My Rooms
          </button>
          <button
            className={`nav-link no-prefix ${activeTab === "discover" ? "active" : ""}`}
            onClick={() => setActiveTab("discover")}
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
              style={{
                opacity: activeTab === "discover" ? 1 : 0.5,
                color:
                  activeTab === "discover" ? "var(--color-accent)" : "inherit",
              }}
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
            Discover Rooms
          </button>

          <h4
            style={{
              padding: "24px 16px 8px",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-text-muted)",
            }}
          >
            Management
          </h4>
          <button
            className={`nav-link no-prefix ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
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
              style={{
                opacity: activeTab === "create" ? 1 : 0.5,
                color:
                  activeTab === "create" ? "var(--color-accent)" : "inherit",
              }}
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Create Room
          </button>
        </div>

        <div
          style={{
            marginTop: "auto",
            padding: "16px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div className="msg-avatar" style={{ width: 32, height: 32 }}>
            {currentUser ? currentUser.username.charAt(0).toUpperCase() : "U"}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentUser ? currentUser.username : "User"}
            </div>
          </div>
          <button
            className="icon-btn ghost"
            onClick={onLogout}
            title="Logout"
            style={{ width: 32, height: 32, flexShrink: 0 }}
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>

      <div className="shell-main">
        <div className="shell-header">
          <h2>
            {activeTab === "my-rooms" && "My Rooms"}
            {activeTab === "discover" && "Discover Rooms"}
            {activeTab === "create" && "Create a Room"}
          </h2>
          {activeTab !== "create" && (
            <button
              className="primary"
              style={{ padding: "6px 16px", fontSize: 13 }}
              onClick={() => setActiveTab("create")}
            >
              + Create Room
            </button>
          )}
        </div>

        <div className="shell-content">
          {activeTab === "create" && (
            <div
              className="room-card"
              style={{ maxWidth: 480, margin: "0 auto" }}
            >
              <h3 style={{ marginBottom: 4 }}>Create a New Room</h3>
              <p className="text-muted" style={{ marginBottom: 24 }}>
                Set up a space for your class, team, or project.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label>Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. Design Team Sync"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label>Description</label>
                <textarea
                  placeholder="What is this room about?"
                  value={roomDescription}
                  onChange={(e) => setRoomDescription(e.target.value)}
                  rows="3"
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontWeight: "normal",
                    marginBottom: 0,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  Private room
                </label>
                <button
                  className="primary"
                  onClick={() => {
                    createRoom();
                    setActiveTab("my-rooms");
                  }}
                >
                  Create Room
                </button>
              </div>
            </div>
          )}

          {activeTab === "my-rooms" &&
            (isLoadingRooms ? (
              <div className="room-grid">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="room-card skeleton"
                    style={{ height: 180 }}
                  ></div>
                ))}
              </div>
            ) : (
              renderRoomCards(rooms, false)
            ))}

          {activeTab === "discover" &&
            (isLoadingDiscover ? (
              <div className="room-grid">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="room-card skeleton"
                    style={{ height: 180 }}
                  ></div>
                ))}
              </div>
            ) : discoveredRooms.length === 0 ? (
              <div className="empty-state">
                <svg
                  width="40"
                  height="40"
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
                <h3>No rooms to discover</h3>
                <p>Check back later or create your own community.</p>
              </div>
            ) : (
              renderRoomCards(discoveredRooms, true)
            ))}
        </div>
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

export default RoomList;
