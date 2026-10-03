import React, { useState } from "react";

function CreateRoomModal({ onClose, onRoomCreated }) {
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const createRoom = async () => {
    if (!roomName.trim()) return;

    try {
      const response = await fetch("http://localhost:5000/api/v1/room/", {
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
        onRoomCreated(data.data.room);
      } else {
        console.error("Failed to create room:", data.message);
      }
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div 
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      
      <div style={{
        position: "relative",
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: 24,
        padding: 40,
        width: "100%",
        maxWidth: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)"
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8, color: "var(--color-text-primary)" }}>
          CREATE A NEW ROOM
        </h2>
        <p className="text-muted" style={{ marginBottom: 32, fontSize: 15 }}>
          Give your classroom a place to live.
        </p>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)" }}>Room name</label>
          <input
            type="text"
            placeholder="e.g. Design Team Sync"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            style={{ fontSize: 16, padding: "12px 16px" }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 32 }}>
          <label style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)" }}>Description</label>
          <textarea
            placeholder="What is this room about?"
            value={roomDescription}
            onChange={(e) => setRoomDescription(e.target.value)}
            rows="3"
            style={{ fontSize: 16, padding: "12px 16px" }}
          />
        </div>

        <div style={{ marginBottom: 40 }}>
          <label style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)" }}>Privacy</label>
          <div style={{ display: "flex", gap: 12 }}>
            <button 
              className={!isPrivate ? "primary" : "secondary"}
              style={{ flex: 1, padding: "12px" }}
              onClick={() => setIsPrivate(false)}
            >
              Public
            </button>
            <button 
              className={isPrivate ? "primary" : "secondary"}
              style={{ flex: 1, padding: "12px" }}
              onClick={() => setIsPrivate(true)}
            >
              Private
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button className="ghost" onClick={onClose} style={{ padding: "10px 24px" }}>
            Cancel
          </button>
          <button className="primary" onClick={createRoom} style={{ padding: "10px 24px" }} disabled={!roomName.trim()}>
            Create room
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateRoomModal;
