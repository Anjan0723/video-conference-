import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare, Users, Copy, Check, Settings, Monitor } from 'lucide-react';

export default function VideoConferenceApp() {
  const [currentView, setCurrentView] = useState('home');
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      alert('Could not access camera/microphone. Please grant permissions.');
      return null;
    }
  };

  const createRoom = async () => {
    const newRoomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    setRoomId(newRoomId);
    setCurrentView('lobby');
  };

  const joinRoom = () => {
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }
    setCurrentView('lobby');
  };

  const enterRoom = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    const stream = await startLocalStream();
    if (!stream) return;

    // Simulate other participants joining (demo purposes)
    setTimeout(() => {
      setParticipants([
        { id: '1', name: 'Alice Johnson', videoEnabled: true, audioEnabled: true },
        { id: '2', name: 'Bob Smith', videoEnabled: true, audioEnabled: false }
      ]);
    }, 2000);

    setCurrentView('room');
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
        
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    } else {
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenSharing(false);
    }
  };

  const leaveRoom = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setCurrentView('home');
    setParticipants([]);
    setChatMessages([]);
    setRoomId('');
    setUserName('');
    setIsScreenSharing(false);
  };

  const sendMessage = () => {
    if (chatInput.trim()) {
      const newMessage = {
        id: Date.now(),
        userName,
        message: chatInput,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOwn: true
      };
      setChatMessages(prev => [...prev, newMessage]);
      setChatInput('');

      // Simulate response (demo purposes)
      setTimeout(() => {
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          userName: participants[0]?.name || 'Participant',
          message: 'Thanks for the message!',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwn: false
        }]);
      }, 1000);
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Home View
  if (currentView === 'home') {
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
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-center gap-2">
                <Video className="w-5 h-5" />
                Create New Meeting
              </div>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-medium">OR</span>
              </div>
            </div>

            <div>
              <input
                type="text"
                placeholder="Enter Meeting ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-3 text-center font-mono text-lg"
              />
              <button
                onClick={joinRoom}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-4 px-6 rounded-xl transition duration-200 border-2 border-gray-200"
              >
                Join Existing Meeting
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-indigo-600">HD</div>
                <div className="text-xs text-gray-600">Video Quality</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-600">∞</div>
                <div className="text-xs text-gray-600">Participants</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-600">🔒</div>
                <div className="text-xs text-gray-600">Encrypted</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lobby View
  if (currentView === 'lobby') {
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
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center">
                  <VideoOff className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400">Camera is off</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-3">
              <button
                onClick={async () => {
                  if (!localStreamRef.current) {
                    await startLocalStream();
                  }
                  toggleVideo();
                }}
                className={`p-4 rounded-full transition shadow-lg ${
                  isVideoEnabled ? 'bg-white/90 hover:bg-white' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isVideoEnabled ? 
                  <Video className="w-5 h-5 text-gray-800" /> : 
                  <VideoOff className="w-5 h-5 text-white" />
                }
              </button>
              <button
                onClick={async () => {
                  if (!localStreamRef.current) {
                    await startLocalStream();
                  }
                  toggleAudio();
                }}
                className={`p-4 rounded-full transition shadow-lg ${
                  isAudioEnabled ? 'bg-white/90 hover:bg-white' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isAudioEnabled ? 
                  <Mic className="w-5 h-5 text-gray-800" /> : 
                  <MicOff className="w-5 h-5 text-white" />
                }
              </button>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border-2 border-indigo-100">
              <div>
                <span className="text-sm text-gray-600 block">Meeting ID</span>
                <span className="font-mono font-bold text-xl text-indigo-600">{roomId}</span>
              </div>
              <button 
                onClick={copyRoomId} 
                className="p-2 hover:bg-white rounded-lg transition"
              >
                {copied ? 
                  <Check className="w-5 h-5 text-green-600" /> : 
                  <Copy className="w-5 h-5 text-indigo-600" />
                }
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                if (localStreamRef.current) {
                  localStreamRef.current.getTracks().forEach(track => track.stop());
                }
                setCurrentView('home');
              }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-4 px-6 rounded-xl transition duration-200"
            >
              Cancel
            </button>
            <button
              onClick={enterRoom}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition duration-200 shadow-lg"
            >
              Join Meeting
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Room View
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-white text-sm font-medium">Live</span>
            </div>
            <div className="text-gray-400 text-sm">
              Meeting ID: <span className="text-white font-mono">{roomId}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Users className="w-4 h-4" />
            <span>{participants.length + 1} participants</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 flex gap-4">
        {/* Video Grid */}
        <div className="flex-1 grid gap-4" style={{
          gridTemplateColumns: participants.length === 0 ? '1fr' : 
                              participants.length === 1 ? 'repeat(2, 1fr)' : 
                              participants.length === 2 ? 'repeat(2, 1fr)' :
                              'repeat(auto-fit, minmax(350px, 1fr))',
          gridTemplateRows: participants.length <= 2 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))'
        }}>
          {/* Local Video */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl group">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-medium">
              {userName} (You)
            </div>
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900">
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl font-bold text-white">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm">Camera is off</p>
                </div>
              </div>
            )}
            {isScreenSharing && (
              <div className="absolute top-3 left-3 bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
                <Monitor className="w-3 h-3" />
                Sharing Screen
              </div>
            )}
            <div className="absolute top-3 right-3 flex gap-2">
              {!isAudioEnabled && (
                <div className="bg-red-600 p-2 rounded-lg">
                  <MicOff className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Remote Videos */}
          {participants.map(participant => (
            <div key={participant.id} className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl group">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900">
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl font-bold text-white">
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm">{participant.name}</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                {participant.name}
              </div>
              <div className="absolute top-3 right-3 flex gap-2">
                {!participant.audioEnabled && (
                  <div className="bg-red-600 p-2 rounded-lg">
                    <MicOff className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 bg-gray-800 rounded-xl flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Meeting Chat
              </h3>
              <button 
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Start the conversation!</p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className={`${msg.isOwn ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block max-w-[80%] rounded-xl p-3 ${
                      msg.isOwn 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
                        : 'bg-gray-700 text-white'
                    }`}>
                      {!msg.isOwn && (
                        <div className="text-xs font-semibold mb-1 opacity-80">
                          {msg.userName}
                        </div>
                      )}
                      <div className="text-sm break-words">{msg.message}</div>
                      <div className="text-xs opacity-70 mt-1">{msg.timestamp}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={sendMessage}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-gray-400 text-sm font-medium">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-xl transition-all ${
                isAudioEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
              {isAudioEnabled ? 
                <Mic className="w-5 h-5 text-white" /> : 
                <MicOff className="w-5 h-5 text-white" />
              }
            </button>

            <button
              onClick={toggleVideo}
              className={`p-4 rounded-xl transition-all ${
                isVideoEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
            >
              {isVideoEnabled ? 
                <Video className="w-5 h-5 text-white" /> : 
                <VideoOff className="w-5 h-5 text-white" />
              }
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-xl transition-all ${
                isScreenSharing
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            >
              <Monitor className="w-5 h-5 text-white" />
            </button>

            <button
              onClick={() => setShowChat(!showChat)}
              className="p-4 rounded-xl bg-gray-700 hover:bg-gray-600 transition-all relative"
              title="Chat"
            >
              <MessageSquare className="w-5 h-5 text-white" />
              {chatMessages.length > 0 && !showChat && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-xs text-white font-bold">
                  {chatMessages.length}
                </div>
              )}
            </button>

            <div className="w-px h-8 bg-gray-700 mx-2"></div>

            <button
              onClick={leaveRoom}
              className="p-4 rounded-xl bg-red-600 hover:bg-red-700 transition-all"
              title="Leave Meeting"
            >
              <PhoneOff className="w-5 h-5 text-white" />
            </button>
          </div>

          <button 
            onClick={copyRoomId}
            className="text-gray-400 hover:text-white text-sm font-mono flex items-center gap-2 transition"
          >
            {roomId}
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}