import React, { useRef, useEffect } from "react";
import { useCallContext } from "../contexts/CallContext";

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
  remoteUser,
  isMinimized,
  setIsMinimized,
  remoteStreamRef,
  localStreamRef,
}) {
  const containerRef = useRef(null);

  // Media attach effect for race conditions
  useEffect(() => {
    // Local video
    if (localVideoRef?.current && localStreamRef?.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }

    // Remote video
    if (remoteVideoRef?.current && remoteStreamRef?.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().catch(() => {});
    }

    // Remote audio
    if (remoteAudioRef?.current && remoteStreamRef?.current) {
      if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [callState, callType, localStreamRef, remoteStreamRef]);

  const getUsername = () => {
    if (incomingCall) return incomingCall.username;
    if (remoteUser) return remoteUser.username;
    return "Unknown";
  };

  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : "?";
  };

  if (callState === "idle") {
    return null;
  }

  /*
   * ============================================================
   * INCOMING CALL
   * ============================================================
   */
  if (callState === "incoming") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          backgroundColor: "rgba(0, 0, 0, 0.82)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "min(380px, calc(100vw - 32px))",
            backgroundColor: "var(--color-bg-secondary, #1e1e1e)",
            borderRadius: "20px",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
          }}
        >
          <div
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              backgroundColor: "var(--color-bg-tertiary, #333)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {getInitials(getUsername())}
          </div>

          <div
            style={{
              textAlign: "center",
            }}
          >
            <h2
              style={{
                margin: "0 0 8px 0",
                fontSize: "24px",
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {getUsername()}
            </h2>
            <p
              style={{
                margin: 0,
                color: "var(--color-text-muted, #999)",
                fontSize: "15px",
              }}
            >
              Incoming {callType} call...
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "16px",
              width: "100%",
              marginTop: "12px",
            }}
          >
            <button
              onClick={rejectCall}
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: "#ef4444",
                color: "#fff",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "background 0.2s",
              }}
            >
              Reject
            </button>
            <button
              onClick={acceptCall}
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: "#22c55e",
                color: "#fff",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "background 0.2s",
              }}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ACTIVE CALL
   * ============================================================
   */

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={() => {
        if (isMinimized) {
          setIsMinimized(false);
        }
      }}
      style={{
        position: "fixed",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...(isMinimized
          ? {
              top: "80px",
              right: "20px",
              width: "280px",
              aspectRatio: "16 / 9",
              backgroundColor: "#111",
              borderRadius: "12px",
              zIndex: 10000,
              border: "1px solid var(--color-border, rgba(255,255,255,0.15))",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              cursor: "pointer",
            }
          : {
              inset: 0,
              zIndex: 9998,
              backgroundColor: "#000",
            }),
      }}
    >
      {/* ======================================================
          VIDEO STAGE
          ====================================================== */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Remote video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            display: callType === "video" ? "block" : "none",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backgroundColor: "#000",
          }}
        />

        {/* Audio / calling placeholder */}
        {(callType === "audio" || callState !== "connected") && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              color: "#fff",
            }}
          >
            <div
              style={{
                width: isMinimized ? "56px" : "120px",
                height: isMinimized ? "56px" : "120px",
                borderRadius: "50%",
                backgroundColor: "var(--color-bg-tertiary, #333)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: isMinimized ? "20px" : "40px",
                fontWeight: 600,
              }}
            >
              {getInitials(getUsername())}
            </div>

            <div
              style={{
                fontSize: isMinimized ? "13px" : "20px",
                fontWeight: 500,
              }}
            >
              {getUsername()}
            </div>

            <div
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: isMinimized ? "11px" : "15px",
              }}
            >
              {callState === "connected"
                ? "Connected"
                : callState === "reconnecting"
                  ? "Reconnecting..."
                  : "Calling..."}
            </div>
          </div>
        )}

        {/* ====================================================
            LOCAL CAMERA PREVIEW
            ==================================================== */}
        {callType === "video" && (
          <div
            style={{
              position: "absolute",
              right: isMinimized ? "8px" : "24px",
              bottom: isMinimized ? "8px" : "120px",
              width: isMinimized ? "64px" : "240px",
              aspectRatio: "4 / 3",
              backgroundColor: "#111",
              borderRadius: isMinimized ? "6px" : "12px",
              overflow: "hidden",
              zIndex: 30,
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />

            {isVideoOff && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "#1a1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: isMinimized ? "24px" : "60px",
                    height: isMinimized ? "24px" : "60px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-bg-tertiary, #333)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: isMinimized ? "10px" : "22px",
                    fontWeight: 600,
                  }}
                >
                  You
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          MINIMIZED OVERLAYS (Top Gradient + End Call)
          ====================================================== */}
      {isMinimized && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "8px 10px",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 40,
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
            Tap to expand
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              endCall();
            }}
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: "#ef4444",
              border: "none",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
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
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ======================================================
          FULL SCREEN CONTROLS (Top Bar)
          ====================================================== */}
      {!isMinimized && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "20px 24px",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              className="icon-btn ghost"
              onClick={() => setIsMinimized(true)}
              title="Minimize"
              style={{ color: "#fff" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 14h6v6" />
                <path d="M10 14l-7 7" />
              </svg>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-bg-tertiary, #333)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {getInitials(getUsername())}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{ color: "#fff", fontSize: "16px", fontWeight: 600 }}
                >
                  {getUsername()}
                </span>
                <span
                  style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px" }}
                >
                  {callState === "connected"
                    ? "Connected"
                    : callState === "reconnecting"
                      ? "Reconnecting..."
                      : "Calling..."}
                </span>
              </div>
            </div>
          </div>

          <button
            className="icon-btn ghost"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            style={{ color: "#fff" }}
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
      )}

      {/* ======================================================
          FULL SCREEN CONTROLS (Bottom Bar)
          ====================================================== */}
      {!isMinimized && (
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(30,30,30,0.88)",
            backdropFilter: "blur(12px)",
            padding: "12px 24px",
            borderRadius: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
            zIndex: 100,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Mute */}
          <button
            onClick={toggleMute}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: isMuted ? "#ef4444" : "rgba(255,255,255,0.1)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg
                width="22"
                height="22"
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
                width="22"
                height="22"
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

          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            disabled={isScreenSharing}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: isVideoOff ? "#ef4444" : "rgba(255,255,255,0.1)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              cursor: isScreenSharing ? "not-allowed" : "pointer",
              opacity: isScreenSharing ? 0.5 : 1,
              transition: "all 0.2s",
            }}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
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

          {/* Screen Share */}
          {callType === "video" && (
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: isScreenSharing
                  ? "#3b82f6"
                  : "rgba(255,255,255,0.1)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              title={isScreenSharing ? "Stop sharing" : "Share screen"}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </button>
          )}

          <div
            style={{
              width: "1px",
              height: "24px",
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          />

          {/* End Call */}
          <button
            onClick={endCall}
            style={{
              height: "48px",
              padding: "0 24px",
              borderRadius: "24px",
              backgroundColor: "#ef4444",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            title="End Call"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
              <line x1="23" y1="1" x2="1" y2="23"></line>
            </svg>
            End
          </button>
        </div>
      )}

      {/* Remote audio stream */}
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
}

export default VideoCallOverlay;
