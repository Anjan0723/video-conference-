import React, { useState, useEffect, useRef } from 'react';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Users, Copy, Check, Monitor
} from 'lucide-react';

import VideoTile from "./components/VideoTile";
import { connectSocket, joinRoom, startProducing } from "./webrtc";

export default function VideoConferenceApp() {
  const [currentView, setCurrentView] = useState("home");
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [participants, setParticipants] = useState([]);

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localStreamRef = useRef(null);

  useEffect(() => {
    connectSocket();
  }, []);

  const startLocalPreview = async () => {
    try {
      if (localStreamRef.current) return localStreamRef.current;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error("Media Error:", err);
      alert("Camera/Mic permission denied");
      return null;
    }
  };

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 9).toUpperCase();
    setRoomId(id);
    setCurrentView("lobby");
  };

  const goToLobby = () => {
    if (!roomId.trim()) return alert("Enter a Meeting ID");
    setCurrentView("lobby");
  };

  const enterRoom = async () => {
    if (!userName.trim()) return alert("Please enter your name");

    await startLocalPreview();

    const existingPeers = await joinRoom(roomId, userName, (peerId, stream) => {
      setParticipants(prev => {
        const filtered = prev.filter(p => p.id !== peerId);
        return [...filtered, { id: peerId, name: `User ${peerId}`, stream }];
      });
    });

    setParticipants(existingPeers.map(p => ({ ...p, stream: null })));

    const stream = await startProducing();
    localStreamRef.current = stream;

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
    localStreamRef.current?.getTracks().forEach(t => t.stop());
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

  // ----------------------------------------------------------------
  // ------------------------------ UI ------------------------------
  // ----------------------------------------------------------------

  // ---------------- HOME VIEW ----------------
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

          <button
            onClick={createRoom}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl mb-4"
          >
            Create Meeting
          </button>

          <input
            type="text"
            placeholder="Enter Meeting ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center font-mono mb-3"
          />

          <button
            onClick={goToLobby}
            className="w-full bg-gray-100 text-gray-800 py-4 px-6 rounded-xl"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  // ---------------- LOBBY VIEW ----------------
  if (currentView === "lobby") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-3xl w-full">

          <h2 className="text-3xl font-bold text-gray-800 mb-4">Get Ready</h2>

          {/* LIVE PREVIEW */}
          <div className="mb-6 rounded-2xl overflow-hidden shadow-xl">
            <VideoTile peerId="local" name={userName || "You"} stream={localStreamRef.current} />
          </div>

          {/* Name input */}
          <input
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl mb-4"
          />

          {/* Meeting ID */}
          <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-xl mb-6">
            <div>
              <div className="text-sm text-gray-600">Meeting ID</div>
              <div className="font-mono font-bold text-xl text-indigo-600">{roomId}</div>
            </div>

            <button onClick={copyRoomId}>
              {copied ? <Check className="text-green-500" /> : <Copy className="text-indigo-600" />}
            </button>
          </div>

          <button
            onClick={enterRoom}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl"
          >
            Join Meeting
          </button>

        </div>
      </div>
    );
  }

  // ---------------- ROOM VIEW ----------------
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">

      <div className="bg-gray-800 text-white px-6 py-3 flex justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Live • Meeting ID: {roomId}
        </div>

        <div className="flex items-center gap-1 text-gray-400">
          <Users size={16} /> {participants.length + 1} participants
        </div>
      </div>

      {/* VIDEO GRID */}
      <div className="flex-1 p-4 grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}
      >
        <VideoTile peerId="local" name="You" stream={localStreamRef.current} />

        {participants.map((p) => (
          <VideoTile key={p.id} peerId={p.id} name={p.name} stream={p.stream} />
        ))}
      </div>

      {/* CONTROLS */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 flex justify-center gap-4">
        <button onClick={toggleAudio} className="p-3 bg-gray-700 rounded-xl">
          {isAudioEnabled ? <Mic className="text-white" /> : <MicOff className="text-red-500" />}
        </button>

        <button onClick={toggleVideo} className="p-3 bg-gray-700 rounded-xl">
          {isVideoEnabled ? <Video className="text-white" /> : <VideoOff className="text-red-500" />}
        </button>

        <button onClick={leaveRoom} className="p-3 bg-red-600 rounded-xl">
          <PhoneOff className="text-white" />
        </button>
      </div>
    </div>
  );
}
