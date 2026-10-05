import React, { useState, useEffect } from "react";

function SearchPage({ onRoomSelect }) {
  const [query, setQuery] = useState("");
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // We can fetch discovered rooms initially or on type
  useEffect(() => {
    const fetchAllRooms = async () => {
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
        console.error("Error getting discovered rooms:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllRooms();
  }, []);

  const filtered =
    query.trim() === ""
      ? []
      : rooms.filter(
          (r) =>
            r.name.toLowerCase().includes(query.toLowerCase()) ||
            r.description?.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "64px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 640 }}>
        <h1 style={{ fontSize: 32, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Find anything in Classio
        </h1>
        <p className="text-muted" style={{ marginBottom: 32, fontSize: 16 }}>
          Search for rooms, classrooms, and communities.
        </p>

        <div style={{ position: "relative", marginBottom: 48 }}>
          <svg
            style={{
              position: "absolute",
              left: 24,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted)",
            }}
            width="24"
            height="24"
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "20px 24px 20px 64px",
              fontSize: 20,
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 1000,
              boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
              color: "var(--color-text-primary)",
            }}
            autoFocus
          />
        </div>

        {query.trim() !== "" && (
          <div>
            <h3
              style={{
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--color-text-muted)",
                marginBottom: 16,
              }}
            >
              Rooms ({filtered.length})
            </h3>
            {filtered.length === 0 && !isLoading ? (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  color: "var(--color-text-muted)",
                  background: "var(--color-bg-elevated)",
                  borderRadius: 16,
                }}
              >
                No rooms found matching "{query}"
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {filtered.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => onRoomSelect(room.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: 16,
                      background: "var(--color-bg-elevated)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 16,
                      cursor: "pointer",
                      transition: "all var(--transition-fast)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-accent)";
                      e.currentTarget.style.background =
                        "rgba(0, 149, 246, 0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-border)";
                      e.currentTarget.style.background =
                        "var(--color-bg-elevated)";
                    }}
                  >
                    <div
                      className="msg-avatar"
                      style={{ width: 48, height: 48, fontSize: 18 }}
                    >
                      {room.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {room.name}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {room.description || "No description provided."}
                      </div>
                    </div>
                    <div style={{ color: "var(--color-text-muted)" }}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
