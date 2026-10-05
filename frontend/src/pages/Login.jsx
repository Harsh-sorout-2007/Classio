import { useState } from "react";
import logo from "../assets/logo/classio-logo.png";

function Login({ onLogin, onGoToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);

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

        <h2>Sign in</h2>
        <p className="subtitle">Enter your details to continue.</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label>Email</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="primary"
            disabled={isLoading}
            style={{ width: "100%" }}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Don't have an account?{" "}
            <button
              className="ghost"
              style={{ color: "var(--color-text-primary)", padding: "0 4px" }}
              onClick={onGoToRegister}
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
