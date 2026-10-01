import { useEffect, useState } from "react";
import logo from "../assets/logo/classio-logo.png";

function RoomList({ onRoomSelect, onLogout }) {
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
      setIsLoadingRooms(false);
    }
  };

  const getDiscoveredRooms = async () => {
    setIsLoadingDiscover(true);
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
    if (!roomName.trim()) {
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/v1/room/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: roomName,
          description: roomDescription,
          is_private: isPrivate,
        }),
      });

      const data = await response.json();

      console.log("Create room response:", data);

      if (response.ok) {
        setRooms((previousRooms) => [...previousRooms, data.data.room]);

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
        `http://localhost:5000/api/v1/room/${room.id}/join`,
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

        <div className="shell-nav">
          <h4 style={{ padding: "12px 12px 4px", fontSize: 11 }}>Workspace</h4>
          <button
            className={`nav-link ${activeTab === "my-rooms" ? "active" : ""}`}
            onClick={() => setActiveTab("my-rooms")}
          >
            My Rooms
          </button>
          <button
            className={`nav-link ${activeTab === "discover" ? "active" : ""}`}
            onClick={() => setActiveTab("discover")}
          >
            Discover Rooms
          </button>

          <h4 style={{ padding: "24px 12px 4px", fontSize: 11 }}>Management</h4>
          <button
            className={`nav-link ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            Create Room
          </button>

          <div style={{ marginTop: "auto", paddingTop: 24 }}>
            <button
              className="nav-link danger"
              onClick={onLogout}
              style={{
                width: "100%",
                textAlign: "left",
                color: "var(--danger)",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="shell-main">
        <div className="shell-header">
          <h2>
            {activeTab === "my-rooms" && "My Rooms"}
            {activeTab === "discover" && "Discover Rooms"}
            {activeTab === "create" && "Create a Room"}
          </h2>
        </div>

        <div className="shell-content">
          {activeTab === "create" && (
            <div
              className="room-card"
              style={{ maxWidth: 600, margin: "0 auto" }}
            >
              <h3 style={{ marginBottom: 4 }}>Create a New Room</h3>
              <p className="text-muted" style={{ marginBottom: 24 }}>
                Set up a space for your class, team, or project.
              </p>

              <div className="form-group">
                <label>Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. Design Team Sync"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>
              <div className="form-group">
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
                  marginTop: 32,
                }}
              >
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  Make this room private
                </label>
                <button
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
            ) : rooms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏠</div>
                <h3>Your workspace is empty</h3>
                <p style={{ marginBottom: 24 }}>
                  Join a community or create a new room to get started.
                </p>
                <button onClick={() => setActiveTab("discover")}>
                  Discover Rooms
                </button>
              </div>
            ) : (
              <div className="room-grid">
                {rooms.map((room) => (
                  <div key={room.id} className="room-card">
                    <div className="room-header">
                      <div className="room-avatar">
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
                          gap: "4px",
                        }}
                      >
                        <span style={{ fontSize: "16px" }}>👑</span>
                        <span>
                          Owner:{" "}
                          <strong
                            style={{
                              color: "var(--text-main)",
                              fontWeight: 500,
                            }}
                          >
                            @{room.owner_username}
                          </strong>
                        </span>
                      </div>
                      <button onClick={() => onRoomSelect(room.id)}>
                        Open Room
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                <div className="empty-icon">🔍</div>
                <h3>No rooms to discover</h3>
                <p>Check back later or create your own community.</p>
              </div>
            ) : (
              <div className="room-grid">
                {discoveredRooms.map((room) => (
                  <div key={room.id} className="room-card">
                    <div className="room-header">
                      <div className="room-avatar">
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
                          gap: "4px",
                        }}
                      >
                        <span style={{ fontSize: "16px" }}>👑</span>
                        <span>
                          Owner:{" "}
                          <strong
                            style={{
                              color: "var(--text-main)",
                              fontWeight: 500,
                            }}
                          >
                            @{room.owner_username}
                          </strong>
                        </span>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => joinRoom(room)}
                      >
                        {room.is_private ? "Request to Join" : "Join Room"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
