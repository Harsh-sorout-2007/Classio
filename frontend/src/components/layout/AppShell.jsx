import React from "react";
import logo from "../../assets/logo/classio-logo.png";

function AppShell({
  children,
  currentTab,
  onTabChange,
  currentUser,
  onLogout,
  onCreateRoomClick,
}) {
  return (
    <div className="app-shell">
      <nav className="top-navbar">
        <div className="navbar-brand">
          <img src={logo} alt="Classio" style={{ width: 28, height: 28 }} />
          Classio
        </div>

        <div className="navbar-nav">
          <button
            className={`navbar-link ${currentTab === "messages" ? "active" : ""}`}
            onClick={() => onTabChange("messages")}
          >
            Messages
          </button>
          <button
            className={`navbar-link ${currentTab === "rooms" ? "active" : ""}`}
            onClick={() => onTabChange("rooms")}
          >
            Rooms
          </button>
          <button
            className={`navbar-link ${currentTab === "search" ? "active" : ""}`}
            onClick={() => onTabChange("search")}
          >
            Search
          </button>
        </div>

        <div className="navbar-actions">
          <button className="primary" style={{ padding: "8px 16px" }} onClick={onCreateRoomClick}>
            + Create Room
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: 12 }}>
            <div
              className="msg-avatar"
              style={{ width: 32, height: 32, background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
              title={currentUser?.username}
            >
              {currentUser?.username.charAt(0).toUpperCase()}
            </div>
            <button className="icon-btn ghost" onClick={onLogout} title="Logout">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="shell-main">
        {children}
      </main>
    </div>
  );
}

export default AppShell;
