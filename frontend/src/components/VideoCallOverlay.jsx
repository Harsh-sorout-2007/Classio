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
  remoteUser,
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

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
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

  useEffect(() => {
    if (localVideoRef?.current?.srcObject) {
      localVideoRef.current.play().catch(() => {});
    }
    if (remoteVideoRef?.current?.srcObject) {
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef?.current?.srcObject) {
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [callState, callType]);

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
   *
   * IMPORTANT:
   * This is intentionally centered.
   * Do NOT turn this into a top-right notification.
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
                color: "#fff",
                fontSize: "24px",
                fontWeight: 600,
              }}
            >
              {getUsername()}
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary, #aaa)",
                fontSize: "15px",
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
              justifyContent: "center",
              gap: "20px",
              width: "100%",
              marginTop: "8px",
            }}
          >
            <button
              onClick={rejectCall}
              style={{
                minWidth: "130px",
                padding: "14px 22px",
                border: "none",
                borderRadius: "10px",
                backgroundColor: "var(--color-danger, #ef4444)",
                color: "#fff",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕ Reject
            </button>

            <button
              onClick={acceptCall}
              style={{
                minWidth: "130px",
                padding: "14px 22px",
                border: "none",
                borderRadius: "10px",
                backgroundColor: "var(--color-brand, #2563eb)",
                color: "#fff",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✓ Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ACTIVE / OUTGOING CALL
   * ============================================================
   */

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
      {/* ========================================================
          MINIMIZED CALL
          ======================================================== */}

      {isMinimized && (
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          {callType === "video" && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                backgroundColor: "#000",
              }}
            />
          )}

          {callType === "audio" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                color: "#fff",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-bg-tertiary, #333)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: 600,
                }}
              >
                {getInitials(getUsername())}
              </div>

              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                {getUsername()}
              </span>
            </div>
          )}

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
              zIndex: 2,
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
              onClick={(e) => {
                e.stopPropagation();
                endCall();
              }}
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "var(--color-danger, #ef4444)",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {!isMinimized && (
        <>
          {/* ======================================================
              TOP BAR
              ====================================================== */}

          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "90px",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.75), rgba(0,0,0,0))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 24px",
              zIndex: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <button
                className="icon-btn ghost"
                onClick={() => setIsMinimized(true)}
                title="Minimize Call"
                style={{
                  color: "#fff",
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
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <span
                style={{
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "18px",
                }}
              >
                {getUsername()}
              </span>

              <span
                style={{
                  color: "rgba(255,255,255,0.75)",
                  fontSize: "14px",
                  padding: "4px 9px",
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

            <button
              className="icon-btn ghost"
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              style={{
                color: "#fff",
              }}
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

            {callType === "video" && callState === "connected" && (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  backgroundColor: "#000",
                }}
              />
            )}

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
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-bg-tertiary, #333)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "40px",
                    fontWeight: 600,
                  }}
                >
                  {getInitials(getUsername())}
                </div>

                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 500,
                  }}
                >
                  {getUsername()}
                </div>

                <div
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: "15px",
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
                  right: "24px",
                  bottom: "120px",
                  width: "240px",
                  aspectRatio: "4 / 3",
                  backgroundColor: "#111",
                  borderRadius: "12px",
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
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        backgroundColor: "var(--color-bg-tertiary, #333)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "22px",
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
              BOTTOM CONTROLS
              ====================================================== */}

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
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
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
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>

            {/* Camera */}

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
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M21 17.16V5a2 2 0 0 0-2-2H4.84" />
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1.16" />
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
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              )}
            </button>

            {/* Screen Share */}

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

            {/* End Call */}

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
                boxShadow: "0 4px 12px rgba(239,68,68,0.4)",
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
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-7-7 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 1 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                <line x1="23" y1="1" x2="1" y2="23" />
              </svg>
            </button>
          </div>
        </>
      )}

      <audio
        ref={remoteAudioRef}
        autoPlay
        style={{
          display: "none",
        }}
      />
    </div>
  );
}

export default VideoCallOverlay;
