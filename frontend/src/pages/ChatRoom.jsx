import { useEffect, useRef, useState } from "react";
import socket from "../services/socket";
import VideoCallOverlay from "../components/VideoCallOverlay";

function ChatRoom({ roomId, onBack, onLogout, currentUser, onlineUsers }) {
  /*
  ============================================================
  STATE
  ============================================================
  */

  // Messages
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  // Room
  const [roomDetails, setRoomDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // Join requests / owner
  const [joinRequests, setJoinRequests] = useState([]);
  const [isOwner, setIsOwner] = useState(false);

  // Rooms
  const [userRooms, setUserRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Typing
  const [typingUsers, setTypingUsers] = useState(new Map());

  // Message receipts
  const [deliveredMessages, setDeliveredMessages] = useState(new Set());
  const [readMessages, setReadMessages] = useState(new Set());

  // Menu / toasts
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Room editing
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomDesc, setEditRoomDesc] = useState("");

  // Message editing
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editMessageContent, setEditMessageContent] = useState("");

  // WebRTC
  const [incomingCall, setIncomingCall] = useState(null);
  const [callState, setCallState] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [callType, setCallType] = useState(null);

  /*
  ============================================================
  REFS
  ============================================================
  */

  const messagesEndRef = useRef(null);
  const typingTimer = useRef(null);

  // WebRTC
  const peerConnection = useRef(null);
  const currentCallUser = useRef(null);
  const remoteAudio = useRef(null);
  const localStream = useRef(null);
  const localVideo = useRef(null);
  const remoteUserId = useRef(null);
  const remoteVideo = useRef(null);

  // WebRTC recovery / negotiation
  const callTypeRef = useRef(null);
  const pendingIceCandidates = useRef([]);
  const hasRecovered = useRef(false);

  /*
  ============================================================
  TOASTS
  ============================================================
  */

  const addToast = (msg, type = "success") => {
    const id = Date.now();

    setToasts((prev) => [...prev, { id, msg, type }]);

    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  };

  /*
  ============================================================
  WEBRTC
  ============================================================
  */

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
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    /*
    ==========================================================
    CONNECTION STATE
    ==========================================================
    */

    pc.onconnectionstatechange = () => {
      console.log("WebRTC connection state:", pc.connectionState);

      console.log("ICE connection state:", pc.iceConnectionState);

      console.log("ICE gathering state:", pc.iceGatheringState);

      console.log("Signaling state:", pc.signalingState);

      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        setCallState("reconnecting");
      }
    };

    /*
    ==========================================================
    ICE CONNECTION STATE
    ==========================================================
    */

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state changed:", pc.iceConnectionState);

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

    /*
    ==========================================================
    REMOTE TRACK
    ==========================================================
    */

    pc.ontrack = (event) => {
      console.log("Remote track received:", event.track);

      console.log("Remote track kind:", event.track.kind);

      console.log("Remote streams:", event.streams);

      if (event.track.kind === "video") {
        setCallType("video");
        callTypeRef.current = "video";
      }

      const remoteStream = event.streams[0];

      if (!remoteStream) {
        console.log("No remote stream found");
        return;
      }

      /*
      ----------------------------------------------------------
      REMOTE AUDIO
      ----------------------------------------------------------
      */

      if (remoteAudio.current) {
        remoteAudio.current.srcObject = remoteStream;

        remoteAudio.current
          .play()
          .then(() => {
            console.log("Remote audio playing");
          })
          .catch((error) => {
            console.error("Audio play failed:", error);
          });
      }

      /*
      ----------------------------------------------------------
      REMOTE VIDEO
      ----------------------------------------------------------
      */

      if (remoteVideo.current) {
        remoteVideo.current.srcObject = remoteStream;

        console.log("Remote video stream attached");
      }
    };

    /*
    ==========================================================
    ICE CANDIDATE
    ==========================================================
    */

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      const targetUser = remoteUserId.current || currentCallUser.current;

      if (!targetUser) {
        console.log("No remote user. ICE candidate ignored.");
        return;
      }

      console.log("Sending ICE candidate");

      socket.emit("ice-candidate", {
        to: targetUser,
        candidate: event.candidate,
      });
    };

    peerConnection.current = pc;

    return pc;
  };

  /*
  ============================================================
  START MEDIA
  ============================================================
  */

  const startMedia = async (type = "audio") => {
    cleanupPeerConnection();

    pendingIceCandidates.current = [];

    /*
    ----------------------------------------------------------
    STOP OLD MEDIA
    ----------------------------------------------------------
    */

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        track.stop();
      });

      localStream.current = null;
    }

    /*
    ----------------------------------------------------------
    GET NEW MEDIA
    ----------------------------------------------------------
    */

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });

    localStream.current = stream;

    /*
    ----------------------------------------------------------
    LOCAL VIDEO
    ----------------------------------------------------------
    */

    if (localVideo.current) {
      localVideo.current.srcObject = stream;
    }

    /*
    ----------------------------------------------------------
    CREATE PEER CONNECTION
    ----------------------------------------------------------
    */

    const pc = createPeerConnection();

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    /*
    ----------------------------------------------------------
    CALL TYPE
    ----------------------------------------------------------
    */

    setCallType(type);
    callTypeRef.current = type;

    setIsVideoOff(type === "audio");
  };

  /*
  ============================================================
  TOGGLE MUTE
  ============================================================
  */

  const toggleMute = () => {
    if (!localStream.current) {
      return;
    }

    const audioTrack = localStream.current.getAudioTracks()[0];

    if (!audioTrack) {
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;

    setIsMuted(!audioTrack.enabled);
  };

  /*
  ============================================================
  TOGGLE VIDEO
  ============================================================
  */

  const toggleVideo = async () => {
    /*
    ----------------------------------------------------------
    AUDIO CALL -> TURN CAMERA ON
    ----------------------------------------------------------
    */

    if (localStream.current && !localStream.current.getVideoTracks().length) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });

        const videoTrack = stream.getVideoTracks()[0];

        localStream.current.addTrack(videoTrack);

        if (localVideo.current) {
          localVideo.current.srcObject = localStream.current;
        }

        const pc = peerConnection.current;

        if (!pc) {
          console.log("No peer connection found");
          return;
        }

        pc.addTrack(videoTrack, localStream.current);

        const offer = await pc.createOffer();

        await pc.setLocalDescription(offer);

        callTypeRef.current = "video";
        setCallType("video");
        setIsVideoOff(false);

        socket.emit("webrtc-offer", {
          to: remoteUserId.current,
          offer,
          callType: "video",
        });

        console.log("Video enabled and renegotiation offer sent");
      } catch (error) {
        console.error("Failed to turn on video:", error);
      }

      return;
    }

    /*
    ----------------------------------------------------------
    VIDEO ALREADY EXISTS -> ENABLE / DISABLE
    ----------------------------------------------------------
    */

    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];

      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;

        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  /*
  ============================================================
  END CALL
  ============================================================
  */

  const endCall = () => {
    console.log("Ending call");

    const targetUser = remoteUserId.current || currentCallUser.current;

    setCallState("idle");
    setIncomingCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsCallMinimized(false);

    /*
    ----------------------------------------------------------
    NOTIFY OTHER USER
    ----------------------------------------------------------
    */

    if (targetUser) {
      socket.emit("end-call", {
        to: targetUser,
      });
    }

    /*
    ----------------------------------------------------------
    STOP LOCAL MEDIA
    ----------------------------------------------------------
    */

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        track.stop();
      });

      localStream.current = null;
    }

    /*
    ----------------------------------------------------------
    CLOSE PEER CONNECTION
    ----------------------------------------------------------
    */

    cleanupPeerConnection();

    /*
    ----------------------------------------------------------
    CLEAR MEDIA ELEMENTS
    ----------------------------------------------------------
    */

    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
    }

    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }

    /*
    ----------------------------------------------------------
    RESET WEBRTC REFS
    ----------------------------------------------------------
    */

    pendingIceCandidates.current = [];

    remoteUserId.current = null;
    currentCallUser.current = null;

    callTypeRef.current = null;
    setCallType(null);

    console.log("Call cleaned up");
  };

  /*
  ============================================================
  MESSAGE API / DATA
  ============================================================
  */

  const getMessages = async () => {
    setIsLoadingMessages(true);

    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/messages`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        setMessages(data.data.messages);

        markMessagesAsRead(data.data.messages);
      }
    } catch (error) {
      console.error("Error getting messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const syncReceipts = () => {
    socket.emit("sync-room-receipts", roomId, (response) => {
      if (!response.success) {
        console.error("Failed to sync receipts:", response.error);

        return;
      }

      const delivered = new Set();

      const read = new Set();

      response.receipts.forEach((receipt) => {
        if (
          receipt.total_recipients > 0 &&
          receipt.delivered_count === receipt.total_recipients
        ) {
          delivered.add(receipt.message_id);
        }

        if (
          receipt.total_recipients > 0 &&
          receipt.read_count === receipt.total_recipients
        ) {
          read.add(receipt.message_id);
        }
      });

      setDeliveredMessages(delivered);

      setReadMessages(read);
    });
  };

  const markMessagesAsRead = (messages) => {
    messages.forEach((msg) => {
      if (msg.user_id !== currentUser.id) {
        console.log("Marking message as read:", msg.id);

        socket.emit("message-read", {
          messageId: msg.id,
        });
      }
    });
  };

  /*
  ============================================================
  ROOM API / DATA
  ============================================================
  */

  const getMembers = async () => {
    setIsLoadingMembers(true);

    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/members`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        setMembers(data.data.members);
      }
    } catch (error) {
      console.error("Error getting members:", error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  /*
  ============================================================
  INITIAL ROOM / USER DATA
  ============================================================
  */

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/v1/room/", {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        if (response.ok) {
          setUserRooms(data.data.rooms);
        }
      } catch (error) {
        console.error("Error getting rooms:", error);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    fetchRooms();
  }, []);

  /*
  ============================================================
  ROOM EFFECT
  ============================================================
  */

  useEffect(() => {
    const getJoinRequests = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/v1/room/${roomId}/join-requests`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        const data = await response.json();

        if (response.ok) {
          setJoinRequests(data.data.requests);

          setIsOwner(true);
        } else if (response.status === 403) {
          setIsOwner(false);
        }
      } catch (error) {
        console.error("Error getting join requests:", error);
      }
    };

    const getRoomDetails = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/v1/room/${roomId}`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        const data = await response.json();

        if (response.ok) {
          setRoomDetails(data.data.room);

          setEditRoomName(data.data.room.name);

          setEditRoomDesc(data.data.room.description);
        }
      } catch (error) {
        console.error("Error getting room details:", error);
      }
    };

    getMessages();
    getJoinRequests();
    getRoomDetails();
    getMembers();

    /*
    ==========================================================
    SOCKET CONNECTION
    ==========================================================
    */

    const handleConnect = () => {
      socket.emit("join-room", roomId);
      socket.emit("call-recovery-ready");
    };

    socket.on("connect", handleConnect);

    if (socket.connected) {
      handleConnect();
    }

    /*
    ==========================================================
    ROOM EVENTS
    ==========================================================
    */

    socket.on("joined-room", () => {
      getMessages();

      socket.emit("mark-room-read", roomId, () => {
        syncReceipts();
      });
    });

    socket.on("join-room-error", (message) => {
      console.error("Join room error:", message);
    });

    /*
    ==========================================================
    MESSAGE EVENTS
    ==========================================================
    */

    socket.on("new-message", (message) => {
      setMessages((previousMessages) => {
        const alreadyExists = previousMessages.some(
          (existingMessage) => existingMessage.id === message.id,
        );

        if (alreadyExists) {
          return previousMessages;
        }

        return [...previousMessages, message];
      });

      if (message.user_id !== currentUser.id) {
        socket.emit("message-read", {
          messageId: message.id,
        });
      }
    });

    /*
    ==========================================================
    RECEIPT EVENTS
    ==========================================================
    */

    socket.on(
      "receipt-update",
      ({ messageId, totalRecipients, deliveredCount, readCount }) => {
        if (totalRecipients > 0 && deliveredCount === totalRecipients) {
          setDeliveredMessages((previous) => {
            const updated = new Set(previous);

            updated.add(messageId);

            return updated;
          });
        }

        if (totalRecipients > 0 && readCount === totalRecipients) {
          setReadMessages((previous) => {
            const updated = new Set(previous);

            updated.add(messageId);

            return updated;
          });
        }
      },
    );

    socket.on("message-delivered", ({ messageId }) => {
      setDeliveredMessages((previous) => {
        const updated = new Set(previous);

        updated.add(messageId);

        return updated;
      });
    });

    socket.on("message-error", (message) => {
      console.error("Message error:", message);
    });

    /*
    ==========================================================
    SOCKET CONNECTION EVENTS
    ==========================================================
    */

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    socket.on("disconnect", () => {
      setTypingUsers(new Map());
    });

    /*
    ==========================================================
    TYPING EVENTS
    ==========================================================
    */

    socket.on("user-typing", ({ userId, username }) => {
      setTypingUsers((previous) => {
        const updated = new Map(previous);

        updated.set(userId, username);

        return updated;
      });
    });

    socket.on("user-stopped-typing", ({ userId }) => {
      setTypingUsers((previous) => {
        const updated = new Map(previous);

        updated.delete(userId);

        return updated;
      });
    });

    /*
    ==========================================================
    WEBRTC SIGNALING EVENTS
    ==========================================================
    */

    /*
    ----------------------------------------------------------
    INCOMING CALL
    ----------------------------------------------------------
    */

    const handleIncomingCall = ({ from, username, callType }) => {
      console.log("Incoming call from:", username, from, "Type:", callType);

      remoteUserId.current = from;

      currentCallUser.current = from;

      callTypeRef.current = callType;

      setIncomingCall({
        from,
        username,
        callType,
      });

      setCallState("incoming");
    };

    socket.on("incoming-call", handleIncomingCall);

    /*
    ----------------------------------------------------------
    CALL ACCEPTED
    ----------------------------------------------------------
    */

    const handleCallAccepted = async ({ from, username }) => {
      console.log("Call accepted by:", username, from);

      try {
        const pc = peerConnection.current || createPeerConnection();

        const offer = await pc.createOffer();

        await pc.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          to: from,
          offer,
          callType: callTypeRef.current,
        });

        console.log(
          "Initial WebRTC offer sent. Call type:",
          callTypeRef.current,
        );
      } catch (error) {
        console.error("Failed to create WebRTC offer:", error);
      }
    };

    socket.on("call-accepted", handleCallAccepted);

    /*
    ----------------------------------------------------------
    CALL REJECTED
    ----------------------------------------------------------
    */

    const handleCallRejected = ({ username }) => {
      console.log("Call rejected by:", username);

      setCallState("idle");
      setIncomingCall(null);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsCallMinimized(false);

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          track.stop();
        });

        localStream.current = null;
      }

      cleanupPeerConnection();

      if (remoteAudio.current) {
        remoteAudio.current.srcObject = null;
      }

      if (remoteVideo.current) {
        remoteVideo.current.srcObject = null;
      }

      pendingIceCandidates.current = [];

      remoteUserId.current = null;

      currentCallUser.current = null;

      callTypeRef.current = null;

      setCallType(null);
    };

    socket.on("call-rejected", handleCallRejected);

    /*
    ----------------------------------------------------------
    WEBRTC OFFER
    ----------------------------------------------------------
    */

    const handleWebRTCOffer = async ({ from, username, offer, isRecovery }) => {
      console.log("WebRTC offer received from:", username, from);

      try {
        let pc = peerConnection.current;

        /*
          ----------------------------------------------------
          IMPORTANT:
          Do NOT automatically destroy an existing PC here.

          During normal negotiation the callee already has
          a peer connection because startMedia() created it.

          Destroying it here creates another race.
          ----------------------------------------------------
          */

        if (pc && isRecovery) {
          console.log("Recovery offer detected. Recreating peer connection.");
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

        console.log("Remote description set");

        /*
          ----------------------------------------------------
          FLUSH BUFFERED ICE CANDIDATES
          ----------------------------------------------------
          */

        for (const candidate of pendingIceCandidates.current) {
          try {
            await pc.addIceCandidate(candidate);

            console.log("Buffered ICE candidate added");
          } catch (error) {
            console.error("Failed to add buffered ICE candidate:", error);
          }
        }

        pendingIceCandidates.current = [];

        /*
          ----------------------------------------------------
          CREATE ANSWER
          ----------------------------------------------------
          */

        const answer = await pc.createAnswer();

        await pc.setLocalDescription(answer);

        socket.emit("webrtc-answer", {
          to: from,
          answer,
        });

        console.log("WebRTC answer sent");
      } catch (error) {
        console.error("Failed to handle WebRTC offer:", error);
      }
    };

    socket.on("webrtc-offer", handleWebRTCOffer);

    /*
    ----------------------------------------------------------
    WEBRTC ANSWER
    ----------------------------------------------------------
    */

    const handleWebRTCAnswer = async ({ from, username, answer }) => {
      console.log("WebRTC answer received from:", username, from);

      const pc = peerConnection.current;

      if (!pc) {
        console.log("No peer connection found for answer");

        return;
      }

      try {
        await pc.setRemoteDescription(answer);

        console.log("Remote answer description set");

        /*
          ----------------------------------------------------
          FLUSH BUFFERED ICE CANDIDATES
          ----------------------------------------------------
          */

        for (const candidate of pendingIceCandidates.current) {
          try {
            await pc.addIceCandidate(candidate);

            console.log("Buffered ICE candidate added after answer");
          } catch (error) {
            console.error("Failed to add buffered ICE candidate:", error);
          }
        }

        pendingIceCandidates.current = [];
      } catch (error) {
        console.error("Failed to set remote answer:", error);
      }
    };

    socket.on("webrtc-answer", handleWebRTCAnswer);

    /*
    ----------------------------------------------------------
    RESUME CALL AFTER REFRESH
    ----------------------------------------------------------
    */

    const handleResumeCall = async ({
      remoteUserId: peerId,
      callType: recoveredCallType,
    }) => {
      if (hasRecovered.current) {
        console.log("Already recovered, ignoring duplicate resume-call");
        return;
      }
      hasRecovered.current = true;

      console.log("Resuming call with:", peerId, recoveredCallType);

      try {
        remoteUserId.current = peerId;

        currentCallUser.current = peerId;

        callTypeRef.current = recoveredCallType;

        setCallType(recoveredCallType);

        setCallState("reconnecting");

        /*
          ----------------------------------------------------
          CREATE NEW MEDIA + NEW PEER CONNECTION
          ----------------------------------------------------
          */

        await startMedia(recoveredCallType);

        const pc = peerConnection.current;

        if (!pc) {
          console.log("No peer connection after recovery media setup");

          return;
        }

        /*
          ----------------------------------------------------
          CREATE FRESH RECOVERY OFFER
          ----------------------------------------------------
          */

        const offer = await pc.createOffer();

        await pc.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          to: peerId,
          offer,
          callType: recoveredCallType,
          isRecovery: true,
        });

        console.log("Recovery offer sent");
      } catch (error) {
        console.error("Failed to resume call:", error);
      }
    };

    socket.on("resume-call", handleResumeCall);

    /*
    ----------------------------------------------------------
    ICE CANDIDATE
    ----------------------------------------------------------
    */

    const handleICECandidate = async ({ candidate }) => {
      console.log("ICE candidate received");

      const pc = peerConnection.current;

      /*
        ------------------------------------------------------
        NO PEER CONNECTION YET
        ------------------------------------------------------
        */

      if (!pc) {
        console.log("No peer connection. Buffering candidate.");

        pendingIceCandidates.current.push(candidate);

        return;
      }

      /*
        ------------------------------------------------------
        REMOTE DESCRIPTION NOT READY
        ------------------------------------------------------
        */

      if (!pc.remoteDescription) {
        console.log("Remote description not ready. Buffering candidate.");

        pendingIceCandidates.current.push(candidate);

        return;
      }

      /*
        ------------------------------------------------------
        ADD ICE CANDIDATE
        ------------------------------------------------------
        */

      try {
        await pc.addIceCandidate(candidate);

        console.log("ICE candidate added");
      } catch (error) {
        console.error("Failed to add ICE candidate:", error);
      }
    };

    socket.on("ice-candidate", handleICECandidate);

    /*
    ----------------------------------------------------------
    CALL ENDED
    ----------------------------------------------------------
    */

    const handleCallEnded = () => {
      console.log("Call ended by other user");

      setCallState("idle");
      setIncomingCall(null);
      setIsMuted(false);
      setIsVideoOff(false);
      setIsCallMinimized(false);

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          track.stop();
        });

        localStream.current = null;
      }

      cleanupPeerConnection();

      if (remoteAudio.current) {
        remoteAudio.current.srcObject = null;
      }

      if (remoteVideo.current) {
        remoteVideo.current.srcObject = null;
      }

      pendingIceCandidates.current = [];

      remoteUserId.current = null;

      currentCallUser.current = null;

      callTypeRef.current = null;

      setCallType(null);

      console.log("Call state fully reset");
    };

    socket.on("call-ended", handleCallEnded);

    /*
    ==========================================================
    CLEANUP
    ==========================================================
    */

    return () => {
      clearTimeout(typingTimer.current);

      socket.off("connect", handleConnect);

      socket.off("joined-room");

      socket.off("join-room-error");

      socket.off("new-message");

      socket.off("receipt-update");

      socket.off("message-delivered");

      socket.off("message-error");

      socket.off("connect_error");

      socket.off("user-typing");

      socket.off("user-stopped-typing");

      /*
      --------------------------------------------------------
      WEBRTC CLEANUP
      --------------------------------------------------------
      */

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          track.stop();
        });
        localStream.current = null;
      }

      cleanupPeerConnection();

      socket.off("incoming-call", handleIncomingCall);

      socket.off("call-accepted", handleCallAccepted);

      socket.off("call-rejected", handleCallRejected);

      socket.off("webrtc-offer", handleWebRTCOffer);

      socket.off("webrtc-answer", handleWebRTCAnswer);

      socket.off("resume-call", handleResumeCall);

      socket.off("ice-candidate", handleICECandidate);

      socket.off("call-ended", handleCallEnded);
    };
  }, [roomId]);

  /*
  ============================================================
  SCROLL TO LATEST MESSAGE
  ============================================================
  */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /*
  ============================================================
  JOIN REQUEST ACTIONS
  ============================================================
  */

  const handleRequestAction = async (requestId, action) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/join-requests/${requestId}/${action}`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        addToast(`Request ${action}d successfully`);

        setJoinRequests((prev) => prev.filter((req) => req.id !== requestId));

        await getMembers();
      } else {
        addToast(data.message || `Failed to ${action} request`, "error");
      }
    } catch (error) {
      addToast(`Error ${action}ing request`, "error");
    }
  };

  /*
  ============================================================
  ROOM ACTIONS
  ============================================================
  */

  const leaveRoom = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/leave`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Room left successfully");

        onBack();
      } else {
        alert(data.message || "Failed to leave room");
      }
    } catch (error) {
      alert("Error leaving room");
    }
  };

  const deleteRoom = async () => {
    if (!window.confirm("Are you sure you want to delete this room?")) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Room deleted successfully");

        onBack();
      } else {
        alert(data.message || "Failed to delete room");
      }
    } catch (error) {
      alert("Error deleting room");
    }
  };

  const submitEditRoom = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: editRoomName,
            description: editRoomDesc,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "Room updated successfully");

        setRoomDetails(data.data.room);

        setIsEditingRoom(false);
      } else {
        alert(data.message || "Failed to update room");
      }
    } catch (error) {
      alert("Error updating room");
    }
  };

  /*
  ============================================================
  MESSAGE ACTIONS
  ============================================================
  */

  const submitEditMessage = async (messageId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            content: editMessageContent,
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: editMessageContent,
                }
              : msg,
          ),
        );

        setEditingMessageId(null);

        setEditMessageContent("");
      } else {
        alert(data.message || "Failed to edit message");
      }
    } catch (error) {
      alert("Error editing message");
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/v1/room/${roomId}/messages/${messageId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      } else {
        alert(data.message || "Failed to delete message");
      }
    } catch (error) {
      alert("Error deleting message");
    }
  };

  /*
  ============================================================
  TYPING / SEND MESSAGE
  ============================================================
  */

  const handleMessageChange = (e) => {
    setMessage(e.target.value);

    socket.emit("start-typing", {
      roomId,
      userId: currentUser.id,
    });

    clearTimeout(typingTimer.current);

    typingTimer.current = setTimeout(() => {
      socket.emit("stop-typing", {
        roomId,
        userId: currentUser.id,
      });
    }, 1000);
  };

  const sendMessage = () => {
    if (!message.trim()) {
      return;
    }

    const content = message.trim();

    socket.emit(
      "send-message",
      {
        roomId,
        content,
      },
      (response) => {
        if (!response.success) {
          console.log("Message failed:", response.error);

          return;
        }

        setMessages((previousMessages) => {
          const alreadyExists = previousMessages.some(
            (existingMessage) => existingMessage.id === response.message.id,
          );

          if (alreadyExists) {
            return previousMessages;
          }

          return [...previousMessages, response.message];
        });
      },
    );

    setMessage("");
  };

  /*
  ============================================================
  CALL REMOTE USER
  ============================================================
  */

  const getCallRemoteUser = () => {
    if (incomingCall) {
      return {
        username: incomingCall.username,
      };
    }

    if (currentCallUser.current) {
      const member = members.find((m) => m.id === currentCallUser.current);

      if (member) {
        return {
          username: member.username,
        };
      }
    }

    return null;
  };

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        height: "100%",
        position: "relative",
      }}
    >
      <VideoCallOverlay
        callState={callState}
        callType={callType}
        incomingCall={incomingCall}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        localVideoRef={localVideo}
        remoteVideoRef={remoteVideo}
        remoteAudioRef={remoteAudio}
        toggleMute={toggleMute}
        toggleVideo={toggleVideo}
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
      />

      <div className="chat-core">
        {/* ==================================================
          CHAT HEADER
          ================================================== */}

        <div className="chat-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <button
              className="icon-btn ghost"
              onClick={onBack}
              title="Close Chat"
              style={{ marginRight: -4 }}
            >
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
                <line x1="19" y1="12" x2="5" y2="12" />

                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>

            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    color: "var(--color-text-muted)",
                  }}
                >
                  #
                </span>

                {roomDetails ? roomDetails.name : "Loading..."}

                {roomDetails && roomDetails.is_private && (
                  <span
                    className="badge private"
                    style={{
                      padding: "2px 6px",
                      fontSize: 10,
                    }}
                  >
                    Private
                  </span>
                )}
              </div>

              {roomDetails && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {roomDetails.description}
                </div>
              )}
            </div>
          </div>

          {/* ==================================================
            CALL STATUS + ROOM MENU
            ================================================== */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              position: "relative",
            }}
          >
            {/* OWNER MENU / LEAVE ROOM */}

            {!isOwner ? (
              <button className="danger" onClick={leaveRoom}>
                Leave Room
              </button>
            ) : (
              <button
                className="icon-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="1" />

                  <circle cx="12" cy="5" r="1" />

                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            )}

            {isMenuOpen && isOwner && (
              <>
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 99,
                  }}
                  onClick={() => setIsMenuOpen(false)}
                />

                <div className="overflow-menu">
                  <button
                    className="menu-item"
                    onClick={() => {
                      setIsEditingRoom(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    ✎ Edit Room Settings
                  </button>

                  <div className="menu-divider"></div>

                  <button
                    className="menu-item danger"
                    onClick={() => {
                      deleteRoom();
                      setIsMenuOpen(false);
                    }}
                  >
                    🗑 Delete Room
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ==================================================
          EDIT ROOM
          ================================================== */}

        {isEditingRoom && (
          <div
            style={{
              padding: "16px 24px",
              background: "var(--color-surface)",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            <h4 style={{ marginBottom: 12 }}>Edit Room Settings</h4>

            <div
              style={{
                display: "flex",
                gap: 12,
              }}
            >
              <input
                value={editRoomName}
                onChange={(e) => setEditRoomName(e.target.value)}
                style={{ flex: 1 }}
              />

              <input
                value={editRoomDesc}
                onChange={(e) => setEditRoomDesc(e.target.value)}
                style={{ flex: 2 }}
              />

              <button className="primary" onClick={submitEditRoom}>
                Save Changes
              </button>

              <button className="ghost" onClick={() => setIsEditingRoom(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ==================================================
          MESSAGES
          ================================================== */}

        <div className="chat-history">
          {isLoadingMessages ? (
            <div
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 16,
                  }}
                >
                  <div
                    className="skeleton"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    <div
                      className="skeleton"
                      style={{
                        width: 120,
                        height: 16,
                        marginBottom: 8,
                      }}
                    />

                    <div
                      className="skeleton"
                      style={{
                        width: "60%",
                        height: 16,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: 16 }}
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>

              <h3>No messages yet</h3>
              <p>Be the first to say hello.</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const prevMsg = messages[index - 1];

              const nextMsg = messages[index + 1];

              const isGroupedWithPrev =
                prevMsg &&
                prevMsg.username === msg.username &&
                new Date(msg.created_at) - new Date(prevMsg.created_at) <
                  300000;

              const isGroupedWithNext =
                nextMsg &&
                nextMsg.username === msg.username &&
                new Date(nextMsg.created_at) - new Date(msg.created_at) <
                  300000;

              let bubblePosition = "single";

              if (isGroupedWithPrev && isGroupedWithNext) {
                bubblePosition = "middle";
              } else if (isGroupedWithPrev && !isGroupedWithNext) {
                bubblePosition = "last";
              } else if (!isGroupedWithPrev && isGroupedWithNext) {
                bubblePosition = "first";
              }

              const isMine = msg.username === currentUser?.username;

              const alignClass = isMine ? "mine" : "theirs";

              return (
                <div
                  key={msg.id}
                  className={`message-row ${alignClass} ${
                    !isGroupedWithPrev ? "new-group" : ""
                  }`}
                >
                  {!isMine && !isGroupedWithPrev && (
                    <div className="msg-author-name">{msg.username}</div>
                  )}

                  <div
                    className={`bubble-container ${alignClass} ${
                      !isMine && isGroupedWithNext ? "no-avatar" : ""
                    }`}
                  >
                    {!isMine && !isGroupedWithNext && (
                      <div className="msg-avatar">
                        {msg.username.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className={`msg-bubble ${bubblePosition}`}>
                      {editingMessageId === msg.id ? (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          <input
                            value={editMessageContent}
                            onChange={(e) =>
                              setEditMessageContent(e.target.value)
                            }
                            autoFocus
                            style={{
                              padding: "4px 8px",
                              background: "transparent",
                              border: "1px solid rgba(255,255,255,0.2)",
                              color: "#fff",
                            }}
                          />

                          <button
                            className="primary"
                            style={{
                              padding: "4px 8px",
                              fontSize: 12,
                            }}
                            onClick={() => submitEditMessage(msg.id)}
                          >
                            Save
                          </button>

                          <button
                            className="ghost"
                            style={{
                              padding: "4px 8px",
                              fontSize: 12,
                              color: "#fff",
                            }}
                            onClick={() => setEditingMessageId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="msg-content">{msg.content}</div>
                      )}
                    </div>

                    <div className="bubble-meta">
                      {isMine && editingMessageId !== msg.id && (
                        <div className="msg-actions">
                          <button
                            className="icon-btn ghost"
                            onClick={() => {
                              setEditingMessageId(msg.id);

                              setEditMessageContent(msg.content);
                            }}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>

                          <button
                            className="icon-btn ghost danger"
                            onClick={() => deleteMessage(msg.id)}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6" />

                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      )}

                      <span className="msg-time">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {isMine && deliveredMessages.has(msg.id) && (
                        <span
                          className={`msg-receipt ${
                            readMessages.has(msg.id) ? "read" : "delivered"
                          }`}
                        >
                          {readMessages.has(msg.id) ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} style={{ height: 24 }} />
        </div>

        {/* ==================================================
          TYPING
          ================================================== */}

        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            <span className="typing-dots">
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </span>

            <span className="typing-text">
              {typingUsers.size === 1
                ? `${Array.from(typingUsers.values())[0]} is typing...`
                : `${typingUsers.size} people are typing...`}
            </span>
          </div>
        )}

        {/* ==================================================
          MESSAGE COMPOSER
          ================================================== */}

        <div className="composer-wrapper">
          <div className="composer-box">
            <button
              className="icon-btn ghost"
              style={{
                color: "var(--color-text-muted)",
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
                <line x1="12" y1="5" x2="12" y2="19" />

                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <textarea
              placeholder={`Message ${
                roomDetails ? "#" + roomDetails.name : "..."
              }`}
              value={message}
              onChange={handleMessageChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
            />

            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={!message.trim()}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />

                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================
        RIGHT SIDEBAR
        ================================================== */}

      <div className="chat-panel">
        {/* MEMBERS */}

        <div className="panel-section">
          <h4
            style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            Members
            <span>{members.length}</span>
          </h4>

          {isLoadingMembers ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div
                    className="skeleton"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                    }}
                  />

                  <div
                    className="skeleton"
                    style={{
                      flex: 1,
                      height: 14,
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div>
              {members.map((member) => (
                <div key={member.id} className="member-row">
                  {/* AVATAR */}

                  <div className="member-avatar-wrapper">
                    <div className="member-avatar">
                      {member.username.charAt(0).toUpperCase()}
                    </div>

                    <div
                      className={`member-status-dot ${
                        onlineUsers.has(member.id) ? "online" : "offline"
                      }`}
                      title={onlineUsers.has(member.id) ? "Online" : "Offline"}
                    />
                  </div>
                  {/* NAME */}

                  <div className="member-name">{member.username}</div>

                  {/* OWNER BADGE */}

                  {member.role === "owner" && (
                    <span
                      className="badge"
                      style={{
                        fontSize: 9,
                        marginRight: 4,
                      }}
                    >
                      OWNER
                    </span>
                  )}

                  {/* CALL BUTTONS */}

                  {member.id !== currentUser.id &&
                    onlineUsers.has(member.id) &&
                    callState === "idle" && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="icon-btn"
                          title={`Audio call ${member.username}`}
                          onClick={async () => {
                            currentCallUser.current = member.id;
                            remoteUserId.current = member.id;
                            setCallState("calling");
                            await startMedia("audio");
                            socket.emit("call-user", {
                              to: member.id,
                              callType: "audio",
                            });
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                          </svg>
                        </button>
                        <button
                          className="icon-btn"
                          title={`Video call ${member.username}`}
                          onClick={async () => {
                            currentCallUser.current = member.id;
                            remoteUserId.current = member.id;
                            setCallState("calling");
                            await startMedia("video");
                            socket.emit("call-user", {
                              to: member.id,
                              callType: "video",
                            });
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect
                              x="1"
                              y="5"
                              width="15"
                              height="14"
                              rx="2"
                              ry="2"
                            ></rect>
                          </svg>
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* JOIN REQUESTS */}

        {isOwner && (
          <div className="panel-section">
            <h4
              style={{
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                color: "var(--color-brand)",
              }}
            >
              Join Requests
              {joinRequests.length > 0 && (
                <span
                  className="badge private"
                  style={{
                    background: "var(--color-brand)",
                    color: "#fff",
                  }}
                >
                  {joinRequests.length}
                </span>
              )}
            </h4>

            {joinRequests.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>
                No pending requests.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {joinRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      background: "var(--color-surface)",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        marginBottom: 8,
                      }}
                    >
                      {req.username}{" "}
                      <span
                        style={{
                          color: "var(--color-text-muted)",
                          fontWeight: 400,
                        }}
                      >
                        wants to join
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                      }}
                    >
                      <button
                        className="primary"
                        style={{
                          flex: 1,
                          padding: "4px 0",
                        }}
                        onClick={() => handleRequestAction(req.id, "approve")}
                      >
                        Approve
                      </button>

                      <button
                        className="danger"
                        style={{
                          flex: 1,
                          padding: "4px 0",
                        }}
                        onClick={() => handleRequestAction(req.id, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LOGOUT */}

        <div
          style={{
            marginTop: "auto",
            paddingTop: 24,
          }}
        >
          <button
            className="danger"
            onClick={onLogout}
            style={{ width: "100%" }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* TOASTS */}

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === "success" ? "✓" : "✕"}
            </span>

            <span>{toast.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatRoom;
