import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RoomList from "./pages/RoomList";
import ChatRoom from "./pages/ChatRoom";
import socket from "./services/socket";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authScreen, setAuthScreen] = useState("login");
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/v1/auth/refresh",
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
      await fetch("http://localhost:5000/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      setIsLoggedIn(false);
      setCurrentUser(null);
      setSelectedRoomId(null);
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

  if (!selectedRoomId) {
    return (
      <RoomList
        onRoomSelect={(roomId) => setSelectedRoomId(roomId)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <ChatRoom
      roomId={selectedRoomId}
      onBack={() => setSelectedRoomId(null)}
      onLogout={handleLogout}
      currentUser={currentUser}
      onlineUsers={onlineUsers}
    />
  );
}

export default App;
