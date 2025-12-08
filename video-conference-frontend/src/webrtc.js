// src/webrtc.js  ← REPLACE ENTIRE FILE WITH THIS
import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

export let socket = null;
let device = null;
let sendTransport = null;
let recvTransport = null;
export let localStream = null;

// ONE persistent MediaStream per peer — NEVER recreate
const peerStreams = new Map(); // peerId → MediaStream

export function connectSocket() {
  if (socket) return socket;

  const backend = `https://${window.location.hostname}:3001`;

  socket = io(backend, {
    transports: ["websocket"],
    secure: true,
    rejectUnauthorized: false,
  });

  socket.on("connect", () => console.log("Socket connected"));
  socket.on("connect_error", (e) => console.error("Socket error", e));
  return socket;
}

async function loadDevice(rtpCapabilities) {
  device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });
}

function createSendTransport(roomId) {
  return new Promise((resolve) => {
    socket.emit("createSendTransport", { roomId }, (params) => {
      if (!params) return resolve(null);
      const transport = device.createSendTransport(params);

      transport.on("connect", ({ dtlsParameters }, cb) => {
        socket.emit("connectSendTransport", { roomId, dtlsParameters });
        cb();
      });

      transport.on("produce", async ({ kind, rtpParameters }, cb) => {
        socket.emit("produce", { roomId, kind, rtpParameters }, ({ id }) => cb({ id }));
      });

      resolve(transport);
    });
  });
}

function createRecvTransport(roomId) {
  return new Promise((resolve) => {
    socket.emit("createRecvTransport", { roomId }, (params) => {
      if (!params) return resolve(null);
      const transport = device.createRecvTransport(params);

      transport.on("connect", ({ dtlsParameters }, cb) => {
        socket.emit("connectRecvTransport", { roomId, dtlsParameters });
        cb();
      });

      resolve(transport);
    });
  });
}

export async function joinRoom(roomId, name, onNewStream) {
  return new Promise((resolve) => {
    socket.emit("joinRoom", { roomId, name }, async (data) => {
      await loadDevice(data.rtpCapabilities);
      recvTransport = await createRecvTransport(roomId);

      // Initialize empty stream for each peer
      data.peers.forEach((p) => {
        if (p.id !== socket.id && !peerStreams.has(p.id)) {
          peerStreams.set(p.id, new MediaStream());
        }
      });

      // Consume existing producers
      data.peers.forEach((p) => {
        [...(p.videoProducers || []), ...(p.audioProducers || [])].forEach(
          (prodId) => consumeStream(roomId, prodId, p.id, onNewStream)
        );
      });

      // Listen for newly produced tracks
      socket.on("newProducer", ({ producerId, peerId }) => {
        if (!peerStreams.has(peerId)) peerStreams.set(peerId, new MediaStream());
        consumeStream(roomId, producerId, peerId, onNewStream);
      });

      resolve(data);
    });
  });
}


export async function startProducing(stream, roomId) {
  localStream = stream;
  sendTransport = await createSendTransport(roomId);

  const videoTrack = stream.getVideoTracks()[0];
  const audioTrack = stream.getAudioTracks()[0];

  if (videoTrack) await sendTransport.produce({ track: videoTrack });
  if (audioTrack) await sendTransport.produce({ track: audioTrack });
}

// THE MOST IMPORTANT FUNCTION THAT WAS BREAKING EVERYTHING
// src/webrtc.js → consumeStream — FINAL WORKING VERSION
async function consumeStream(roomId, producerId, peerId, onNewStream) {
  socket.emit("consume", {
    roomId,
    producerId,
    rtpCapabilities: device.rtpCapabilities,
  }, async (res) => {
    if (res.error) {
      console.error("Consume error:", res.error);
      return;
    }

    const consumer = await recvTransport.consume({
      id: res.id,
      producerId: res.producerId,
      kind: res.kind,
      rtpParameters: res.rtpParameters,
    });

    // Get or create persistent stream
    let stream = peerStreams.get(peerId);
    if (!stream) {
      stream = new MediaStream();
      peerStreams.set(peerId, stream);
    }

    // ADD THE TRACK
    stream.addTrack(consumer.track);
    console.log(`Added ${res.kind} track for ${peerId} → total ${stream.getTracks().length}`);

    // CALL onNewStream EVERY TIME A TRACK ARRIVES
    // This is the fix — was missing before!
    onNewStream(peerId, stream);

    // Resume consumer
    socket.emit("resumeConsumer", { roomId, consumerId: consumer.id });
  });
}