import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import socket from "./services/socket";

// Layout & Navigation
import AppShell from "./components/layout/AppShell";
import CreateRoomModal from "./components/common/CreateRoomModal";

// Pages
import Messages from "./pages/Messages";
import RoomsPage from "./pages/Rooms";


// Contexts
import { CallProvider } from "./contexts/CallContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authScreen, setAuthScreen] = useState("login");

  // Navigation State
  const [currentTab, setCurrentTab] = useState("messages");
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/v1/auth/refresh`,
          {
            method: "POST",
            credentials: "include",
          },
        );

        const data = await response.json();

        if (response.ok) {
          setIsLoggedIn(true);
          setCurrentUser(data.data.user);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const handleOnlineUsers = (userIds) => {
      setOnlineUsers(new Set(userIds));
    };

    const handleUserOnline = ({ userId }) => {
      setOnlineUsers((previous) => {
        const updated = new Set(previous);
        updated.add(userId);
        return updated;
      });
    };

    const handleUserOffline = ({ userId }) => {
      setOnlineUsers((previous) => {
        const updated = new Set(previous);
        updated.delete(userId);
        return updated;
      });
    };

    socket.on("online-users", handleOnlineUsers);
    socket.on("user-online", handleUserOnline);
    socket.on("user-offline", handleUserOffline);

    socket.connect();

    return () => {
      socket.off("online-users", handleOnlineUsers);
      socket.off("user-online", handleUserOnline);
      socket.off("user-offline", handleUserOffline);

      socket.disconnect();
    };
  }, [isLoggedIn]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      setIsLoggedIn(false);
      setCurrentUser(null);
      setSelectedRoomId(null);
      setCurrentTab("messages");
      setOnlineUsers(new Set());
    }
  };

  if (isCheckingAuth) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-background)",
          color: "var(--color-text-primary)",
          fontSize: "1.5rem",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
        }}
      >
        Loading Classio...
      </div>
    );
  }

  if (!isLoggedIn) {
    if (authScreen === "login") {
      return (
        <Login
          onLogin={(user) => {
            setIsLoggedIn(true);
            setCurrentUser(user);
          }}
          onGoToRegister={() => setAuthScreen("register")}
        />
      );
    } else {
      return <Register onGoToLogin={() => setAuthScreen("login")} />;
    }
  }

  const handleRoomSelect = (roomId) => {
    setSelectedRoomId(roomId);
    setCurrentTab("messages"); // Switch to messages tab when a room is opened
  };

  return (
    <CallProvider>
      <AppShell
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        onCreateRoomClick={() => setIsCreateModalOpen(true)}
      >
        {currentTab === "messages" && (
          <Messages
            currentUser={currentUser}
            onlineUsers={onlineUsers}
            selectedRoomId={selectedRoomId}
            onRoomSelect={handleRoomSelect}
            onLogout={handleLogout}
          />
        )}

        {currentTab === "rooms" && (
          <RoomsPage onRoomSelect={handleRoomSelect} />
        )}





        {isCreateModalOpen && (
          <CreateRoomModal
            onClose={() => setIsCreateModalOpen(false)}
            onRoomCreated={(room) => {
              setIsCreateModalOpen(false);
              handleRoomSelect(room.id);
            }}
          />
        )}
      </AppShell>
    </CallProvider>
  );
}

export default App;
