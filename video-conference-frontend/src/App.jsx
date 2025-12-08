// src/App.jsx  ← REPLACE YOUR ENTIRE FILE WITH THIS
import React, { useState, useEffect, useRef } from "react";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Copy, Check } from "lucide-react";

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
  const isHostRef = useRef(false);

  useEffect(() => {
    connectSocket();

    socket?.on("newPeer", ({ id, name, isHost }) => {
      console.log("New peer joined:", name, id);
      setParticipants((prev) => {
        if (prev.some(p => p.id === id)) return prev;
        return [...prev, { id, name, isHost, stream: null }];
      });
    });

    return () => socket?.off("newPeer");
  }, []);

  const startLocalPreview = async () => {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      alert("Camera/Microphone access denied");
      return null;
    }
  };

  const createRoom = () => {
    setRoomId(Math.random().toString(36).substring(2, 9).toUpperCase());
    setCurrentView("lobby");
  };

  const goToLobby = () => {
    if (!roomId.trim()) return alert("Please enter a Meeting ID");
    setCurrentView("lobby");
  };

  const enterRoom = async () => {
    if (!userName.trim()) return alert("Please enter your name");

    const previewStream = await startLocalPreview();
    if (!previewStream) return;

    const { peers, isHost } = await joinRoom(roomId, userName, (peerId, stream) => {
      // This callback runs when a remote peer's video/audio arrives
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === peerId ? { ...p, stream } : p
        )
      );
    });

    isHostRef.current = isHost;

    // Add all existing peers (without stream yet — will come via callback)
    setParticipants(
      peers
        .filter((p) => p.id !== socket.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          stream: null,
        }))
    );

    await startProducing(previewStream, roomId);
    setCurrentView("room");
  };

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
    setTimeout(() => setCopied(false), 1500);
  };

  // ====================== RENDER ======================

  if (currentView === "home") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-10 rounded-3xl shadow-2xl max-w-md w-full">
          <h1 className="text-3xl font-bold text-white mb-8 text-center">Video Conference</h1>

          <button
            onClick={createRoom}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl text-lg font-medium mb-6 transition"
          >
            Create New Meeting
          </button>

          <div className="relative">
            <input
              className="w-full p-4 bg-gray-700 text-white rounded-xl text-center text-lg"
              placeholder="Enter Meeting ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            />
          </div>

          <button
            onClick={goToLobby}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-xl text-lg font-medium mt-6 transition"
          >
            Join Meeting
          </button>
        </div>
      </div>
    );
  }

  if (currentView === "lobby") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-3xl p-8 max-w-lg w-full">
          <VideoTile peerId="local" name="You" stream={localStreamRef.current} />

          <input
            className="w-full p-4 bg-gray-700 text-white rounded-xl mt-6 text-center"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />

          <div className="bg-gray-700 rounded-xl p-5 mt-6 flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm">Meeting ID</p>
              <p className="text-xl font-bold">{roomId}</p>
            </div>
            <button onClick={copyRoomId} className="p-3 bg-gray-600 rounded-lg">
              {copied ? <Check className="text-green-400" /> : <Copy />}
            </button>
          </div>

          <button
            onClick={enterRoom}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl mt-6 text-lg font-medium transition"
          >
            Join Now
          </button>
        </div>
      </div>
    );
  }

  // ====================== ROOM VIEW ======================
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
          <span className="font-medium">Live • Meeting ID: {roomId}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Users size={18} />
          <span>{participants.length + 1} participants</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
          {/* Local Video */}
          <VideoTile
            peerId="local"
            name={`${userName} ${isHostRef.current ? "(Host)" : "(You)"}`}
            stream={localStreamRef.current}
          />

          {/* Remote Participants */}
          {participants.map((p) => (
            <VideoTile
              key={p.id}                    // ← ONLY p.id — no streamKey anymore!
              peerId={p.id}
              name={`${p.name}${p.isHost ? " (Host)" : ""}`}
              stream={p.stream}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-5 flex justify-center gap-6">
        <button
          onClick={toggleAudio}
          className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition"
        >
          {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} className="text-red-500" />}
        </button>

        <button
          onClick={toggleVideo}
          className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition"
        >
          {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} className="text-red-500" />}
        </button>

        <button
          onClick={leaveRoom}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}