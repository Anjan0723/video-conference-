import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare, Users, Copy, Check, Monitor } from 'lucide-react';

import {
  connectSocket,
  joinRoom,
  startProducing
} from "./webrtc";

export default function VideoConferenceApp() {
  const [currentView, setCurrentView] = useState("home");
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [participants, setParticipants] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  // Connect socket once
  useEffect(() => {
    connectSocket();
  }, []);

  // Rename your old joinRoom → goToLobby (no conflict)
  const goToLobby = () => {
    if (!roomId.trim()) {
      alert("Please enter a room ID");
      return;
    }
    setCurrentView("lobby");
  };

  const createRoom = async () => {
    const newRoomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    setRoomId(newRoomId);
    setCurrentView("lobby");
  };

  const startLocalPreview = async () => {
    try {

      // ✅ FIX INSERTED HERE — reuse camera if already active
      if (localStreamRef.current) {
        console.warn("Camera already active — reusing the existing stream");
        return localStreamRef.current;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("Media Error:", err);
      alert("Camera/Mic permission denied");
      return null;
    }
  };

  const enterRoom = async () => {
    if (!userName.trim()) {
      alert("Please enter your name");
      return;
    }

    // Start camera preview first
    await startLocalPreview();

    // Join MediaSoup SFU room
    const list = await joinRoom(roomId, userName, (peerId, stream) => {
      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.id !== peerId);
        return [...filtered, { id: peerId, name: `User ${peerId}`, stream }];
      });
    });

    // Show other participants
    setParticipants(list);

    // Start producing local audio/video to SFU
    const localStream = await startProducing();
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }

    setCurrentView("room");
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        localVideoRef.current.srcObject = screen;

        screen.getTracks()[0].onended = () => {
          localVideoRef.current.srcObject = localStreamRef.current;
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error("Screen Share Error:", err);
      }
    } else {
      localVideoRef.current.srcObject = localStreamRef.current;
      setIsScreenSharing(false);
    }
  };

  const leaveRoom = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setCurrentView("home");
    setParticipants([]);
    setChatMessages([]);
    setRoomId("");
    setUserName("");
    setIsScreenSharing(false);
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const msg = {
      id: Date.now(),
      userName,
      message: chatInput,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isOwn: true,
    };
    setChatMessages((p) => [...p, msg]);
    setChatInput("");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // -------------------------
  // HOME VIEW (unchanged)
  // -------------------------
  if (currentView === "home") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Video className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              StreamMeet
            </h1>
            <p className="text-gray-600">Professional video conferencing made simple</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={createRoom}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl"
            >
              Create New Meeting
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">OR</span>
              </div>
            </div>

            <div>
              <input
                type="text"
                placeholder="Enter Meeting ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center font-mono text-lg"
              />
              <button
                onClick={goToLobby}
                className="w-full bg-gray-100 text-gray-800 py-4 px-6 rounded-xl mt-3"
              >
                Join Existing Meeting
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------
  // LOBBY VIEW
  // -------------------------
  if (currentView === "lobby") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-3xl w-full">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Get Ready</h2>
          <p className="text-gray-600 mb-6">Set up your audio and video before joining</p>

          <div className="mb-6 relative rounded-2xl overflow-hidden shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-2xl bg-gray-900 aspect-video object-cover"
            />
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                <VideoOff className="w-16 h-16 text-gray-300" />
              </div>
            )}
            <div className="absolute bottom-4 w-full flex justify-center gap-3">
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full ${isVideoEnabled ? "bg-white" : "bg-red-600"}`}
              >
                {isVideoEnabled ? (
                  <Video className="w-5 h-5 text-gray-800" />
                ) : (
                  <VideoOff className="w-5 h-5 text-white" />
                )}
              </button>

              <button
                onClick={toggleAudio}
                className={`p-4 rounded-full ${isAudioEnabled ? "bg-white" : "bg-red-600"}`}
              >
                {isAudioEnabled ? (
                  <Mic className="w-5 h-5 text-gray-800" />
                ) : (
                  <MicOff className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <input
              type="text"
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
            />

            <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-xl">
              <div>
                <span className="text-sm text-gray-600">Meeting ID</span>
                <span className="font-mono font-bold text-xl text-indigo-600 block">
                  {roomId}
                </span>
              </div>
              <button onClick={copyRoomId}>
                {copied ? <Check className="text-green-600" /> : <Copy className="text-indigo-600" />}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setCurrentView("home")}
              className="flex-1 bg-gray-100 py-4 rounded-xl"
            >
              Cancel
            </button>

            <button
              onClick={enterRoom}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl"
            >
              Join Meeting
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------
  // ROOM VIEW
  // -------------------------
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex justify-between">
        <div className="flex items-center gap-4 text-white">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live • Meeting ID: {roomId}
        </div>
        <div className="text-gray-400 flex items-center gap-1">
          <Users className="w-4 h-4" /> {participants.length + 1} participants
        </div>
      </div>

      <div className="flex-1 p-4 grid gap-4"
        style={{
          gridTemplateColumns: participants.length === 0 ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))",
        }}
      >
        {/* Local Video */}
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full bg-black rounded-xl object-cover"
        />

        {/* Remote Streams */}
        {participants.map((p) => (
          <video
            key={p.id}
            autoPlay
            playsInline
            className="w-full h-full bg-black rounded-xl object-cover"
            ref={(el) => {
              if (el && p.stream) el.srcObject = p.stream;
            }}
          />
        ))}
      </div>

      <div className="bg-gray-800 border-t border-gray-700 p-4 flex justify-between">
        <div></div>

        <div className="flex items-center gap-3">
          <button onClick={toggleAudio} className="p-3 bg-gray-700 rounded-xl">
            {isAudioEnabled ? <Mic className="text-white" /> : <MicOff className="text-red-500" />}
          </button>

          <button onClick={toggleVideo} className="p-3 bg-gray-700 rounded-xl">
            {isVideoEnabled ? <Video className="text-white" /> : <VideoOff className="text-red-500" />}
          </button>

          <button onClick={toggleScreenShare} className="p-3 bg-gray-700 rounded-xl">
            <Monitor className="text-white" />
          </button>

          <button onClick={leaveRoom} className="p-3 bg-red-600 rounded-xl">
            <PhoneOff className="text-white" />
          </button>
        </div>

        <button onClick={copyRoomId} className="text-gray-400 font-mono flex items-center gap-2">
          {roomId}
          {copied ? <Check className="text-green-500" /> : <Copy />}
        </button>
      </div>
    </div>
  );
}
