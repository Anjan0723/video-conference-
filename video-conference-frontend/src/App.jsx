import React, { useState, useEffect, useRef } from "react";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Users, Copy, Check
} from "lucide-react";

import VideoTile from "./components/VideoTile";
import { connectSocket, joinRoom, startProducing, socket } from "./webrtc";

export default function App() {
  const [currentView, setCurrentView] = useState("home");
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [participants, setParticipants] = useState([]);

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  const localStreamRef = useRef(null);

  // Connect socket once
  useEffect(() => {
    connectSocket();
  }, []);

  // Start Local Camera Preview
  const startLocalPreview = async () => {
    try {
      if (localStreamRef.current) return localStreamRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error("Camera error:", err);
      alert("Camera/Mic permission denied");
      return null;
    }
  };

  // Home Actions
  const createRoom = () => {
    const newId = Math.random().toString(36).substring(2, 9).toUpperCase();
    setRoomId(newId);
    setCurrentView("lobby");
  };

  const goToLobby = () => {
    if (!roomId.trim()) return alert("Enter Meeting ID");
    setCurrentView("lobby");
  };

  // JOIN ROOM
  const enterRoom = async () => {
    if (!userName.trim()) return alert("Enter your name");

    await startLocalPreview();

    // Join room
    const existingPeers = await joinRoom(roomId, userName, (peerId, stream) => {
      console.log("STREAM RECEIVED FOR:", peerId);

      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.id !== peerId);
        return [...filtered, { id: peerId, name: `User ${peerId}`, stream }];
      });
    });

    // ❗ FIX: Remove your own ID from participants
    const filteredPeers = existingPeers.filter((p) => p.id !== socket.id);

    setParticipants(filteredPeers.map((p) => ({ ...p, stream: null })));

    // Start producing your own video/audio
    const localStream = await startProducing();
    localStreamRef.current = localStream;

    setCurrentView("room");
  };

  // AUDIO / VIDEO CONTROLS
  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsAudioEnabled(track.enabled);
    }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsVideoEnabled(track.enabled);
    }
  };

  const leaveRoom = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setParticipants([]);
    setRoomId("");
    setUserName("");
    setCurrentView("home");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  // ==========================================================
  // ======================= VIEWS ============================
  // ==========================================================

  // HOME VIEW
  if (currentView === "home") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-3xl shadow-xl w-full max-w-md">
          <button
            onClick={createRoom}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl mb-4 text-lg"
          >
            Create Meeting
          </button>

          <input
            className="w-full p-3 bg-gray-700 text-white rounded-xl mb-4 text-center"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            placeholder="Enter Meeting ID"
          />

          <button
            onClick={goToLobby}
            className="w-full bg-gray-600 text-white py-3 rounded-xl"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  // LOBBY VIEW
  if (currentView === "lobby") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-3xl shadow-xl w-full max-w-lg">

          <VideoTile peerId="local" name="You" stream={localStreamRef.current} />

          <input
            className="w-full p-3 bg-gray-700 text-white rounded-xl my-4"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />

          <div className="flex justify-between bg-gray-700 p-4 rounded-xl mb-4 text-white">
            <div>
              <div className="text-sm text-gray-400">Meeting ID</div>
              <div className="text-xl font-bold">{roomId}</div>
            </div>
            <button onClick={copyRoomId}>
              {copied ? <Check className="text-green-400" /> : <Copy />}
            </button>
          </div>

          <button
            onClick={enterRoom}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl mt-2"
          >
            Join Meeting
          </button>
        </div>
      </div>
    );
  }

  // ROOM VIEW
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">

      {/* HEADER */}
      <div className="p-4 bg-gray-800 flex justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live • Meeting ID: {roomId}
        </div>

        <div className="flex items-center gap-1 text-gray-400">
          <Users size={16} /> {participants.length + 1}
        </div>
      </div>

      {/* VIDEO GRID */}
      <div
        className="grid gap-4 p-4 flex-1"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        <VideoTile
          peerId="local"
          name="You"
          stream={localStreamRef.current}
        />

        {participants.map((p) => (
          <VideoTile
            key={p.id}
            peerId={p.id}
            name={p.name}
            stream={p.stream}
          />
        ))}
      </div>

      {/* CONTROLS */}
      <div className="p-4 bg-gray-800 flex justify-center gap-4">
        <button onClick={toggleAudio} className="p-3 bg-gray-700 rounded-xl">
          {isAudioEnabled ? <Mic /> : <MicOff className="text-red-500" />}
        </button>

        <button onClick={toggleVideo} className="p-3 bg-gray-700 rounded-xl">
          {isVideoEnabled ? <Video /> : <VideoOff className="text-red-500" />}
        </button>

        <button onClick={leaveRoom} className="p-3 bg-red-600 rounded-xl">
          <PhoneOff />
        </button>
      </div>
    </div>
  );
}
