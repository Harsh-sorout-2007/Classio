import React, { useRef, useState, useEffect } from "react";

function VideoCallOverlay({
  callState,
  callType,
  incomingCall,
  isMuted,
  isVideoOff,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  toggleMute,
  toggleVideo,
  startScreenShare,
  stopScreenShare,
  isScreenSharing,
  endCall,
  acceptCall,
  rejectCall,
  remoteUser, // { username, ... }
  isMinimized,
  setIsMinimized,
}) {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen?.();
    }
  };

  const getUsername = () => {
    if (incomingCall) return incomingCall.username;
    if (remoteUser) return remoteUser.username;
    return "Unknown";
  };

  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : "?";
  };

  if (callState === "idle") return null;

  // Incoming Call specific UI
  if (callState === "incoming") {
    return (
      <div
        style={{
          position: "fixed",
          top: "24px",
          right: "24px",
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: "320px",
            backgroundColor: "var(--color-bg-secondary, #1e1e1e)",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: "var(--color-bg-tertiary, #333)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {getInitials(getUsername())}
          </div>
          <div style={{ textAlign: "center" }}>
            <h3
              style={{ margin: "0 0 8px 0", color: "#fff", fontSize: "20px" }}
            >
              {getUsername()}
            </h3>
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary, #aaa)",
                fontSize: "14px",
              }}
            >
              {incomingCall?.callType === "audio"
                ? "Incoming audio call"
                : "Incoming video call"}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "16px",
              width: "100%",
              marginTop: "8px",
            }}
          >
            <button
              className="danger"
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                fontWeight: 600,
              }}
              onClick={rejectCall}
            >
              ✕ Reject
            </button>
            <button
              className="primary"
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                fontWeight: 600,
                backgroundColor: "var(--color-brand, #2563eb)",
                color: "#fff",
              }}
              onClick={acceptCall}
            >
              ✓ Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={() => {
        if (isMinimized) setIsMinimized(false);
      }}
      style={{
        position: "absolute",
        zIndex: 50,
        backgroundColor: "var(--color-bg-elevated, #222)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "all 0.3s ease",
        ...(isMinimized
          ? {
              top: "80px",
              right: "20px",
              width: "240px",
              aspectRatio: "16/9",
              borderRadius: "12px",
              border: "1px solid var(--color-border)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              cursor: "pointer",
            }
          : {
              inset: 0,
              backgroundColor: "#000",
            }),
      }}
    >
      {isMinimized && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "8px 12px",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 60,
          }}
        >
          <span
            style={{
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {getUsername()}
          </span>
          <button
            className="icon-btn ghost danger"
            style={{ width: "20px", height: "20px", padding: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              endCall();
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.59 13.41c.41-.41.41-1.08 0-1.49a12.08 12.08 0 0 0-3.33-2.22c-.42-.18-.91-.1-1.25.22L3.25 12.67a18.23 18.23 0 0 1-1.23-5.32l2.36-1.57c.39-.26.54-.78.33-1.2A11.96 11.96 0 0 0 3 2.01c-.13-.44-.54-.73-1-.73H1C.45 1.28 0 1.73 0 2.28 0 13.78 9.33 23.11 20.83 23.11c.55 0 1-.45 1-1v-1c0-.46-.29-.87-.73-1a11.96 11.96 0 0 0-2.57-1.71c-.42-.21-.94-.06-1.2.33l-1.57 2.36a18.23 18.23 0 0 1-5.32-1.23l2.75-2.76c.32-.34.4-.83.22-1.25a12.08 12.08 0 0 0-2.22-3.33z" />
            </svg>
          </button>
        </div>
      )}
      {!isMinimized && (
        <>
          {/* Top Bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "80px",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 24px",
              zIndex: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <button
                className="icon-btn ghost"
                style={{ color: "#fff" }}
                onClick={() => setIsMinimized(true)}
                title="Minimize Call"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <span
                style={{ color: "#fff", fontWeight: 600, fontSize: "18px" }}
              >
                {getUsername()}
              </span>
              <span
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "14px",
                  padding: "4px 8px",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                }}
              >
                {callState === "connected"
                  ? "Connected"
                  : callState === "reconnecting"
                    ? "Reconnecting..."
                    : "Calling..."}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                className="icon-btn ghost"
                style={{ color: "#fff" }}
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Video Area */}
      <div
        style={{
          flex: 1,
          position: "relative",
          backgroundColor: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display:
              callState === "connected" && callType === "video"
                ? "block"
                : "none",
          }}
        />

        {/* Remote Camera Off Placeholder or Calling State or Audio Call */}
        {(callState !== "connected" || callType === "audio") && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                backgroundColor: "var(--color-bg-tertiary, #333)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "40px",
                color: "#fff",
                fontWeight: 600,
              }}
            >
              {getInitials(getUsername())}
            </div>
            <div style={{ color: "#fff", fontSize: "20px", fontWeight: 500 }}>
              {getUsername()}
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px" }}>
              {callState === "connected"
                ? "Connected"
                : callState === "reconnecting"
                  ? "Reconnecting..."
                  : "Calling..."}
            </div>
          </div>
        )}

        {/* Local Video PiP */}
        <div
          style={{
            position: "absolute",
            bottom: "120px",
            right: "24px",
            width: "240px",
            aspectRatio: "4/3",
            backgroundColor: "#1a1a1a",
            borderRadius: "12px",
            overflow: "hidden",
            zIndex: 30,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: callType === "video" && !isMinimized ? "block" : "none",
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {isVideoOff && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "#1a1a1a",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-bg-tertiary, #333)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                You
              </div>
            </div>
          )}
        </div>
      </div>

      {!isMinimized && (
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(30, 30, 30, 0.8)",
            backdropFilter: "blur(12px)",
            padding: "12px 24px",
            borderRadius: "32px",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            zIndex: 40,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Mute Button */}
          <button
            className="icon-btn"
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: isMuted
                ? "var(--color-bg-tertiary, #333)"
                : "rgba(255,255,255,0.1)",
              color: isMuted ? "var(--color-danger, #ef4444)" : "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
          >
            {isMuted ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            )}
          </button>

          {/* Camera Button */}
          <button
            className="icon-btn"
            onClick={toggleVideo}
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: isVideoOff
                ? "var(--color-bg-tertiary, #333)"
                : "rgba(255,255,255,0.1)",
              color: isVideoOff ? "var(--color-danger, #ef4444)" : "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
          >
            {isVideoOff ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M21 17.16V5a2 2 0 0 0-2-2H4.84"></path>
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1.16"></path>
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            )}
          </button>

          {/* Screen Share Button */}
          <button
            className="icon-btn"
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: isScreenSharing
                ? "var(--color-brand, #3b82f6)"
                : "rgba(255,255,255,0.1)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
          >
            {isScreenSharing ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="18" x2="12" y2="21" />
                <line x1="9" y1="9" x2="15" y2="13" />
                <line x1="15" y1="9" x2="9" y2="13" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="18" x2="12" y2="21" />
                <path d="M12 8v5" />
                <path d="m9 11 3-3 3 3" />
              </svg>
            )}
          </button>

          {/* End Call Button */}
          <button
            className="icon-btn"
            onClick={endCall}
            title="End Call"
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "var(--color-danger, #ef4444)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
              transition: "all 0.2s ease",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-7-7 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
              <line x1="23" y1="1" x2="1" y2="23"></line>
            </svg>
          </button>
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay style={{ display: "none" }} />
    </div>
  );
}

export default VideoCallOverlay;
