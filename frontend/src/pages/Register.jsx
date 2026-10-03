import { useState } from "react";
import logo from "../assets/logo/classio-logo.png";

function Register({ onGoToLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("Username, email, and password cannot be empty.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:5000/api/v1/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            username,
            email,
            password,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setSuccessMsg("Account created successfully. Please log in.");
        setTimeout(() => {
          onGoToLogin();
        }, 2000);
      } else {
        setError(data.message || "Registration failed.");
      }
    } catch (err) {
      console.error("Register request failed:", err);
      setError("Network error. Please try again later.");
    }
  };

  return (
    <div className="login-page">
      <div
        className="login-visuals"
        style={{ background: "var(--color-navy)", color: "var(--color-white)" }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                marginBottom: 80,
                letterSpacing: "0.1em",
              }}
            >
              CLASSIO
            </div>
            <div className="login-brand">
              <h1 style={{ color: "var(--color-brand)" }}>
                START
                <br />
                BUILDING
                <br />
                YOUR
                <br />
                SPACE.
              </h1>
              <p style={{ marginTop: 24 }}>
                Join the new standard for communication.
              </p>
            </div>
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              opacity: 0.6,
            }}
          >
            02 / REGISTER
          </div>
        </div>
      </div>

      <div
        className="login-form-area"
        style={{
          background: "var(--color-offwhite)",
          color: "var(--color-navy)",
        }}
      >
        <div className="login-card">
          <div style={{ marginBottom: 40 }}>
            <h2>Create Account</h2>
            <p className="subtitle" style={{ fontSize: 18, color: "#666" }}>
              Join Classio today.
            </p>
          </div>

          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--color-danger)",
                padding: 12,
                marginBottom: 24,
                borderLeft: "4px solid var(--color-danger)",
              }}
            >
              {error}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                color: "var(--color-success)",
                padding: 12,
                marginBottom: 24,
                borderLeft: "4px solid var(--color-success)",
              }}
            >
              {successMsg}
            </div>
          )}

          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 24 }}>
              <label>Username</label>
              <input
                type="text"
                placeholder="name"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div style={{ marginBottom: 48 }}>
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="primary"
              style={{
                width: "100%",
                justifyContent: "space-between",
                padding: 24,
              }}
            >
              Create Account
              <span className="btn-arrow">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </form>

          <div
            style={{
              marginTop: 64,
              borderTop: "1px solid #ccc",
              paddingTop: 32,
            }}
          >
            <p style={{ color: "#666", fontSize: 14 }}>
              Already have an account?{" "}
              <button
                className="ghost"
                style={{
                  color: "var(--color-brand)",
                  padding: 0,
                  fontWeight: 800,
                  fontSize: 14,
                }}
                onClick={onGoToLogin}
              >
                LOG IN
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
