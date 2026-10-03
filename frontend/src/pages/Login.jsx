import { useState } from "react";
import logo from "../assets/logo/classio-logo.png";

function Login({ onLogin, onGoToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch("http://localhost:5000/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.data.user);
      } else {
        console.error("Login failed:", data.message);
      }
    } catch (error) {
      console.error("Login request failed:", error);
    }
  };

  return (
    <div className="login-page">
      <div className="login-visuals">
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
              <h1>
                YOUR
                <br />
                CLASSROOM.
                <br />
                YOUR
                <br />
                SPACE.
              </h1>
              <p style={{ marginTop: 24 }}>Talk. Build. Learn. Together.</p>
            </div>
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              opacity: 0.6,
            }}
          >
            01 / LOGIN
          </div>
        </div>
      </div>

      <div className="login-form-area">
        <div className="login-card">
          <div style={{ marginBottom: 40 }}>
            <h2>Welcome</h2>
            <p className="subtitle" style={{ fontSize: 18, color: "#666" }}>
              Enter your credentials to continue.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 32 }}>
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: 48 }}>
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
              Enter Classio
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
              Don't have an account?{" "}
              <button
                className="ghost"
                style={{
                  color: "var(--color-brand)",
                  padding: 0,
                  fontWeight: 800,
                  fontSize: 14,
                }}
                onClick={onGoToRegister}
              >
                CREATE ONE
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
