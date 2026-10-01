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
              Join your classroom.
              <br />
              Actually connected.
            </h1>
            <p>
              Create an account to join professional workspaces and communities.
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
            <h2>Create Account</h2>
          </div>
          <p className="subtitle text-muted">
            Sign up to get started with Classio
          </p>

          <form onSubmit={handleRegister}>
            {error && (
              <div
                style={{
                  color: "var(--danger)",
                  marginBottom: 12,
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}
            {successMsg && (
              <div
                style={{
                  color: "var(--success)",
                  marginBottom: 12,
                  fontSize: 14,
                }}
              >
                {successMsg}
              </div>
            )}

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              style={{ width: "100%", padding: "12px", marginTop: 8 }}
            >
              Create Account
            </button>

            <div style={{ textAlign: "center", marginTop: 24 }}>
              <span className="text-muted" style={{ fontSize: 14 }}>
                Already have an account?{" "}
              </span>
              <button
                type="button"
                className="ghost"
                style={{ padding: "4px 8px" }}
                onClick={onGoToLogin}
              >
                Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;
