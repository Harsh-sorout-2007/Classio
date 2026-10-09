import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from "react";
import socket from "../services/socket";
import VideoCallOverlay from "../components/VideoCallOverlay";

const CallContext = createContext();

export const useCallContext = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [callState, setCallState] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [callType, setCallType] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);

  const peerConnection = useRef(null);
  const currentCallUser = useRef(null);
  const remoteAudio = useRef(null);
  const localStream = useRef(null);
  const localVideo = useRef(null);
  const remoteUserId = useRef(null);
  const remoteVideo = useRef(null);
  const remoteStream = useRef(null);

  const screenStream = useRef(null);
  const cameraTrack = useRef(null);
  const screenTrack = useRef(null);

  const callTypeRef = useRef(null);
  const pendingIceCandidates = useRef([]);
  const hasRecovered = useRef(false);

  const [iceServers, setIceServers] = useState([{ urls: "stun:stun.l.google.com:19302" }]);

  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const response = await fetch(`${API_URL}/api/v1/room/ice-servers`, {
          credentials: "include",
        });
        const data = await response.json();
        if (data.success && data.data && data.data.iceServers) {
          setIceServers(data.data.iceServers);
        }
      } catch (err) {
        console.error("Failed to fetch ICE servers:", err);
      }
    };
    fetchIceServers();
  }, []);

  const cleanupPeerConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.onconnectionstatechange = null;
      peerConnection.current.oniceconnectionstatechange = null;
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: iceServers,
    });

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        setCallState("reconnecting");
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        setCallState("connected");
      } else if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "failed"
      ) {
        setCallState("reconnecting");
      }
    };

    pc.ontrack = (event) => {
      if (event.track.kind === "video") {
        setCallType("video");
        callTypeRef.current = "video";
      }

      let remoteStreamVar = event.streams?.[0];
      if (!remoteStreamVar) {
        if (remoteStream.current instanceof MediaStream) {
          remoteStreamVar = remoteStream.current;
          remoteStreamVar.addTrack(event.track);
        } else {
          remoteStreamVar = new MediaStream([event.track]);
        }
      }

      remoteStream.current = remoteStreamVar;

      if (remoteAudio.current) {
        remoteAudio.current.srcObject = remoteStream.current;
        remoteAudio.current.play().catch((error) => {
          console.warn("Remote audio autoplay blocked:", error);
        });
      }

      if (remoteVideo.current) {
        remoteVideo.current.srcObject = remoteStream.current;
        remoteVideo.current.play().catch((error) => {
          console.warn("Remote video autoplay blocked:", error);
        });
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      const targetUser = remoteUserId.current || currentCallUser.current;
      if (!targetUser) return;

      socket.emit("ice-candidate", {
        to: targetUser,
        candidate: event.candidate,
      });
    };

    peerConnection.current = pc;
    return pc;
  };

  const startMedia = async (type = "audio") => {
    cleanupPeerConnection();
    pendingIceCandidates.current = [];

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }

    if (screenStream.current) {
      screenStream.current.getTracks().forEach((track) => track.stop());
      screenStream.current = null;
    }
    screenTrack.current = null;
    cameraTrack.current = null;
    setIsScreenSharing(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });

      if (!currentCallUser.current && !remoteUserId.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      // Prevent leak if startMedia was called concurrently
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }

      localStream.current = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
        localVideo.current.play().catch((error) => {
          console.warn("Local video autoplay blocked:", error);
        });
      }

      const pc = createPeerConnection();

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      setCallType(type);
      callTypeRef.current = type;
      setIsVideoOff(type === "audio");
    } catch (err) {
      console.error("Failed to start media", err);
    }
  };

  const toggleMute = () => {
    if (!localStream.current) return;
    const audioTrack = localStream.current.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  const toggleVideo = async () => {
    if (isScreenSharing) return;

    if (localStream.current && !localStream.current.getVideoTracks().length) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        
        if (!currentCallUser.current && !remoteUserId.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        
        // Prevent leak if toggleVideo was called concurrently
        if (localStream.current && localStream.current.getVideoTracks().length > 0) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const videoTrack = stream.getVideoTracks()[0];
        // Stop any additional tracks (like audio) if browser erroneously provides them
        stream.getTracks().forEach((track) => {
          if (track !== videoTrack) track.stop();
        });
        
        localStream.current.addTrack(videoTrack);

        if (localVideo.current) {
          localVideo.current.srcObject = localStream.current;
          localVideo.current.play().catch((error) => {
            console.warn("Local video autoplay blocked:", error);
          });
        }

        const pc = peerConnection.current;
        if (!pc) return;

        pc.addTrack(videoTrack, localStream.current);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        callTypeRef.current = "video";
        setCallType("video");
        setIsVideoOff(false);

        socket.emit("camera-state", {
          to: remoteUserId.current || currentCallUser.current,
          enabled: true,
        });

        socket.emit("webrtc-offer", {
          to: remoteUserId.current,
          offer,
          callType: "video",
        });
      } catch (error) {
        console.error("Failed to turn on video:", error);
      }
      return;
    }

    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        
        socket.emit("camera-state", {
          to: remoteUserId.current || currentCallUser.current,
          enabled: videoTrack.enabled,
        });
      }
    }
  };

  const stopScreenShare = async (fromBrowser = false) => {
    const pc = peerConnection.current;
    const activeScreenTrack = screenTrack.current;
    const activeScreenStream = screenStream.current;

    if (!pc || !activeScreenTrack) {
      setIsScreenSharing(false);
      if (activeScreenStream) {
        activeScreenStream.getTracks().forEach((track) => track.stop());
      }
      screenStream.current = null;
      screenTrack.current = null;
      cameraTrack.current = null;
      return;
    }

    if (cameraTrack.current) {
      const videoSender = pc
        .getSenders()
        .find((sender) => sender.track?.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(cameraTrack.current);
      }
      if (localVideo.current && localStream.current) {
        localVideo.current.srcObject = localStream.current;
        localVideo.current.play().catch(() => {});
      }
      setCallType("video");
      callTypeRef.current = "video";
      setIsVideoOff(!cameraTrack.current.enabled);
    } else {
      const videoSender = pc
        .getSenders()
        .find((sender) => sender.track?.kind === "video");
      if (videoSender) {
        pc.removeTrack(videoSender);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", {
          to: remoteUserId.current,
          offer,
          callType: "audio",
        });
      }
      if (localVideo.current && localStream.current) {
        localVideo.current.srcObject = localStream.current;
        localVideo.current.play().catch(() => {});
      }
      setCallType("audio");
      callTypeRef.current = "audio";
      setIsVideoOff(true);
    }

    if (activeScreenStream) {
      activeScreenStream.getTracks().forEach((track) => {
        if (track.readyState !== "ended") track.stop();
      });
    } else if (activeScreenTrack.readyState !== "ended") {
      activeScreenTrack.stop();
    }

    screenStream.current = null;
    screenTrack.current = null;
    cameraTrack.current = null;
    setIsScreenSharing(false);
  };

  const startScreenShare = async () => {
    try {
      const pc = peerConnection.current;
      if (!pc) return;
      if (isScreenSharing) return;

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      screenStream.current = stream;
      screenTrack.current = track;

      const videoSender = pc
        .getSenders()
        .find((sender) => sender.track?.kind === "video");

      if (videoSender) {
        cameraTrack.current = videoSender.track;
        await videoSender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const targetUser = remoteUserId.current || currentCallUser.current;
        if (targetUser) {
          socket.emit("webrtc-offer", {
            to: targetUser,
            offer,
            callType: "video",
          });
        }
      }

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
        localVideo.current.play().catch(() => {});
      }

      setCallType("video");
      callTypeRef.current = "video";
      setIsVideoOff(false);
      setIsScreenSharing(true);

      track.onended = async () => {
        await stopScreenShare(true);
      };
    } catch (error) {
      if (error.name === "NotAllowedError") return;
      console.error("Failed to start screen sharing:", error);
    }
  };

  const endCall = () => {
    const targetUser = remoteUserId.current || currentCallUser.current;

    setCallState("idle");
    setIncomingCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsCallMinimized(false);
    setIsScreenSharing(false);
    setRemoteUser(null);
    setRemoteVideoEnabled(true);

    if (targetUser) {
      socket.emit("end-call", { to: targetUser });
    }

    if (screenStream.current) {
      screenStream.current.getTracks().forEach((track) => track.stop());
      screenStream.current = null;
    }
    screenTrack.current = null;
    cameraTrack.current = null;

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }

    cleanupPeerConnection();

    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    remoteStream.current = null;
    pendingIceCandidates.current = [];
    remoteUserId.current = null;
    currentCallUser.current = null;
    callTypeRef.current = null;
    setCallType(null);
  };

  useEffect(() => {
    const handleIncomingCall = ({ from, username, callType }) => {
      remoteUserId.current = from;
      currentCallUser.current = from;
      callTypeRef.current = callType;
      setIncomingCall({ from, username, callType });
      setCallState("incoming");
    };

    const handleCallAccepted = async ({ from, username }) => {
      try {
        setRemoteUser({ username });
        remoteUserId.current = from;
        currentCallUser.current = from;
        setRemoteVideoEnabled(true);
        const pc = peerConnection.current || createPeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", {
          to: from,
          offer,
          callType: callTypeRef.current,
        });
      } catch (error) {
        console.error("Failed to create WebRTC offer:", error);
      }
    };

    const handleCallRejected = ({ username }) => {
      setCallState("idle");
      setIncomingCall(null);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsCallMinimized(false);
      setIsScreenSharing(false);
      setRemoteUser(null);

      if (screenStream.current) {
        screenStream.current.getTracks().forEach((t) => t.stop());
        screenStream.current = null;
      }
      screenTrack.current = null;
      cameraTrack.current = null;

      if (localStream.current) {
        localStream.current.getTracks().forEach((t) => t.stop());
        localStream.current = null;
      }
      cleanupPeerConnection();

      if (localVideo.current) localVideo.current.srcObject = null;
      if (remoteAudio.current) remoteAudio.current.srcObject = null;
      if (remoteVideo.current) remoteVideo.current.srcObject = null;

      pendingIceCandidates.current = [];
      remoteUserId.current = null;
      currentCallUser.current = null;
      callTypeRef.current = null;
      setCallType(null);
    };

    const handleCallError = ({ message }) => {
      // Treat as rejected if busy or offline
      alert(message || "Call failed");
      handleCallRejected({});
    };

    const handleWebRTCOffer = async ({ from, username, offer, isRecovery }) => {
      try {
        setRemoteUser({ username });
        remoteUserId.current = from;
        currentCallUser.current = from;
        setRemoteVideoEnabled(true);
        let pc = peerConnection.current;
        if (pc && isRecovery) {
          cleanupPeerConnection();
          pc = null;
        }

        if (!pc) {
          pc = createPeerConnection();
          if (localStream.current) {
            localStream.current.getTracks().forEach((track) => {
              pc.addTrack(track, localStream.current);
            });
          }
        }

        remoteUserId.current = from;
        currentCallUser.current = from;
        await pc.setRemoteDescription(offer);

        for (const candidate of pendingIceCandidates.current) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (error) {
            console.error("Failed to add buffered ICE candidate:", error);
          }
        }
        pendingIceCandidates.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc-answer", { to: from, answer });
      } catch (error) {
        console.error("Failed to handle WebRTC offer:", error);
      }
    };

    const handleWebRTCAnswer = async ({ from, username, answer }) => {
      const pc = peerConnection.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(answer);
        for (const candidate of pendingIceCandidates.current) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (error) {
            console.error("Failed to add buffered ICE candidate:", error);
          }
        }
        pendingIceCandidates.current = [];
      } catch (error) {
        console.error("Failed to set remote answer:", error);
      }
    };

    const handleResumeCall = async ({
      remoteUserId: peerId,
      callType: recoveredCallType,
    }) => {
      if (hasRecovered.current) return;
      hasRecovered.current = true;

      try {
        remoteUserId.current = peerId;
        currentCallUser.current = peerId;
        callTypeRef.current = recoveredCallType;

        setCallType(recoveredCallType);
        setCallState("reconnecting");

        await startMedia(recoveredCallType);

        const pc = peerConnection.current;
        if (!pc) return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          to: peerId,
          offer,
          callType: recoveredCallType,
          isRecovery: true,
        });
      } catch (error) {
        console.error("Failed to resume call:", error);
      }
    };

    const handleICECandidate = async ({ candidate }) => {
      const pc = peerConnection.current;
      if (!pc || !pc.remoteDescription) {
        pendingIceCandidates.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error("Failed to add ICE candidate:", error);
      }
    };

    const handleCallEnded = () => {
      handleCallRejected({});
    };

    const handleCameraState = ({ enabled }) => {
      setRemoteVideoEnabled(enabled);
    };

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("call-rejected", handleCallRejected);
    socket.on("call-error", handleCallError);
    socket.on("webrtc-offer", handleWebRTCOffer);
    socket.on("webrtc-answer", handleWebRTCAnswer);
    socket.on("resume-call", handleResumeCall);
    socket.on("ice-candidate", handleICECandidate);
    socket.on("call-ended", handleCallEnded);
    socket.on("camera-state", handleCameraState);

    return () => {
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("call-rejected", handleCallRejected);
      socket.off("call-error", handleCallError);
      socket.off("webrtc-offer", handleWebRTCOffer);
      socket.off("webrtc-answer", handleWebRTCAnswer);
      socket.off("resume-call", handleResumeCall);
      socket.off("ice-candidate", handleICECandidate);
      socket.off("call-ended", handleCallEnded);
      socket.off("camera-state", handleCameraState);
    };
  }, []);

  const initiateCall = async (memberId, memberUsername, type) => {
    currentCallUser.current = memberId;
    remoteUserId.current = memberId;
    setRemoteUser({ username: memberUsername });
    setCallState("calling");
    await startMedia(type);
    socket.emit("call-user", { to: memberId, callType: type });
  };

  const getCallRemoteUser = () => {
    if (incomingCall) return { username: incomingCall.username };
    if (remoteUser) return remoteUser;
    return null;
  };

  return (
    <CallContext.Provider value={{ initiateCall, callState }}>
      {children}
      <VideoCallOverlay
        callState={callState}
        callType={callType}
        incomingCall={incomingCall}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        localVideoRef={localVideo}
        localStreamRef={localStream}
        remoteVideoRef={remoteVideo}
        remoteStreamRef={remoteStream}
        remoteAudioRef={remoteAudio}
        toggleMute={toggleMute}
        toggleVideo={toggleVideo}
        startScreenShare={startScreenShare}
        stopScreenShare={stopScreenShare}
        isScreenSharing={isScreenSharing}
        endCall={endCall}
        acceptCall={async () => {
          if (incomingCall) {
            remoteUserId.current = incomingCall.from;
            setCallState("calling");
            await startMedia(incomingCall.callType);
            socket.emit("accept-call", {
              to: incomingCall.from,
              callType: incomingCall.callType,
            });
            setRemoteUser({ username: incomingCall.username });
            setIncomingCall(null);
          }
        }}
        rejectCall={() => {
          if (incomingCall) {
            socket.emit("reject-call", { to: incomingCall.from });
            setIncomingCall(null);
            setCallState("idle");
            remoteUserId.current = null;
            currentCallUser.current = null;
          }
        }}
        remoteUser={getCallRemoteUser()}
        isMinimized={isCallMinimized}
        setIsMinimized={setIsCallMinimized}
        remoteVideoEnabled={remoteVideoEnabled}
      />
    </CallContext.Provider>
  );
};
