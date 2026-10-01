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
        <div>
          <div className="brand-logo">
            <img
              src={logo}
              alt="Classio Logo"
              className="brand-icon"
              style={{ width: 40, height: 40 }}
            />
            <span style={{ fontSize: 24 }}>Classio</span>
          </div>
          <div className="login-brand">
            <h1>
              Your classroom.
              <br />
              But actually connected.
            </h1>
            <p>
              Experience the speed of a modern messenger combined with the
              structured organization of a professional workspace.
            </p>
          </div>
        </div>
        <div style={{ color: "var(--text-faint)", fontSize: 13 }}>
          © {new Date().getFullYear()} Classio Platform
        </div>
      </div>

      <div className="login-form-area">
        <div className="login-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <img
              src={logo}
              alt="Logo"
              style={{ width: 32, height: 32, borderRadius: "50%" }}
            />
            <h2>Welcome back</h2>
          </div>
          <p className="subtitle text-muted">
            Sign in to your account to continue
          </p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
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
              style={{ width: "100%", padding: "12px", marginTop: 8 }}
            >
              Sign In
            </button>

            <div style={{ textAlign: "center", marginTop: 24 }}>
              <span className="text-muted" style={{ fontSize: 14 }}>
                Don't have an account?{" "}
              </span>
              <button
                type="button"
                className="ghost"
                style={{ padding: "4px 8px" }}
                onClick={onGoToRegister}
              >
                Register
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
