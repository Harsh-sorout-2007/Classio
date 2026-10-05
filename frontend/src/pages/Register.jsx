import { useState } from "react";
import logo from "../assets/logo/classio-logo.png";

function Register({ onGoToLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

    setIsLoading(true);

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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
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
            alt="Classio Logo"
            style={{ width: 24, height: 24, opacity: 0.8 }}
          />
          <span style={{ fontWeight: 600, fontSize: 16 }}>Classio</span>
        </div>

        <h2>Create an account</h2>
        <p className="subtitle">Sign up to get started.</p>

        {error && (
          <div
            style={{
              background: "var(--color-bg-base)",
              color: "var(--color-danger)",
              padding: 12,
              marginBottom: 16,
              border: "1px solid var(--color-danger)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              background: "var(--color-bg-base)",
              color: "var(--color-success)",
              padding: 12,
              marginBottom: 16,
              border: "1px solid var(--color-success)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
            }}
          >
            {successMsg}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 16 }}>
            <label>Username</label>
            <input
              type="text"
              placeholder="e.g. alex_dev"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Email</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
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
            className="primary"
            disabled={isLoading}
            style={{ width: "100%" }}
          >
            {isLoading ? "Creating..." : "Sign up"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Already have an account?{" "}
            <button
              className="ghost"
              style={{ color: "var(--color-text-primary)", padding: "0 4px" }}
              onClick={onGoToLogin}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
