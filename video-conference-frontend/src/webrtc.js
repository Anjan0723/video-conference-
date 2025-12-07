import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

// TURN SERVER CONFIG
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "YOUR_METERED_USERNAME",
    credential: "YOUR_METERED_PASSWORD"
  }
];

let socket;
let device;

// GLOBAL TRANSPORTS
let sendTransport = null;
let recvTransport = null;

let params = {
  roomId: null,
  name: null
};

// Store peer streams
export const peers = {};
export let localStream = null;

// ------------------------------------
// CONNECT SOCKET
// ------------------------------------
export function connectSocket() {
  socket = io("http://192.168.1.104:3001");

  socket.on("connect", () => {
    console.log("Connected:", socket.id);
  });

  return socket;
}

// ------------------------------------
// JOIN ROOM
// ------------------------------------
export async function joinRoom(roomId, name, onNewStream) {
  params.roomId = roomId;
  params.name = name;

  return new Promise((resolve) => {
    socket.emit("joinRoom", { roomId, name }, async (data) => {
      console.log("Joined Room:", data);

      // Load mediasoup device
      await loadDevice(data.rtpCapabilities);

      // Create a single recv transport immediately
      recvTransport = await createRecvTransport();

      resolve(data.peers);

      // When another peer joins
      socket.on("newPeer", (peer) => {
        console.log("New Peer Joined:", peer);
      });

      // When a producer is created by any user
      socket.on("newProducer", async ({ producerId, peerId }) => {
        console.log("New Producer:", producerId);
        await consumePeer(producerId, peerId, onNewStream);
      });
    });
  });
}

// ------------------------------------
// LOAD MEDIASOUP DEVICE
// ------------------------------------
async function loadDevice(routerRtpCapabilities) {
  try {
    device = new mediasoupClient.Device();
  } catch (err) {
    if (err.name === "UnsupportedError") {
      console.error("Browser not supported for MediaSoup");
      return;
    }
  }
  await device.load({ routerRtpCapabilities });
}

// ------------------------------------
// START SENDING MEDIA
// ------------------------------------
export async function startProducing() {
  console.log("Starting local stream…");

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  // Create send transport once
  sendTransport = await createSendTransport();

  // Send VIDEO
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    await sendTransport.produce({ track: videoTrack });
  }

  // Send AUDIO
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    await sendTransport.produce({ track: audioTrack });
  }

  return localStream;
}

// ------------------------------------
// CREATE SEND TRANSPORT (ONE TIME)
// ------------------------------------
async function createSendTransport() {
  return new Promise((resolve) => {
    socket.emit("createSendTransport", { roomId: params.roomId }, async (transportOptions) => {
      sendTransport = device.createSendTransport(transportOptions);

      sendTransport.on("connect", ({ dtlsParameters }, callback) => {
        socket.emit("connectSendTransport", {
          roomId: params.roomId,
          dtlsParameters
        });
        callback();
      });

      sendTransport.on("produce", ({ kind, rtpParameters }, callback) => {
        socket.emit(
          "produce",
          { roomId: params.roomId, kind, rtpParameters },
          ({ id }) => callback({ id })
        );
      });

      resolve(sendTransport);
    });
  });
}

// ------------------------------------
// CREATE RECV TRANSPORT (ONE TIME)
// ------------------------------------
async function createRecvTransport() {
  return new Promise((resolve) => {
    socket.emit("createRecvTransport", { roomId: params.roomId }, async (transportOptions) => {
      recvTransport = device.createRecvTransport(transportOptions);

      recvTransport.on("connect", ({ dtlsParameters }, callback) => {
        socket.emit("connectRecvTransport", {
          roomId: params.roomId,
          dtlsParameters
        });
        callback();
      });

      resolve(recvTransport);
    });
  });
}

// ------------------------------------
// CONSUME A PRODUCER
// ------------------------------------
async function consumePeer(producerId, peerId, onNewStream) {
  socket.emit(
    "consume",
    {
      roomId: params.roomId,
      producerId,
      rtpCapabilities: device.rtpCapabilities
    },
    async (response) => {
      if (response.error) {
        console.error("Consume error:", response.error);
        return;
      }

      console.log("Consuming Producer →", producerId);

      const consumer = await recvTransport.consume({
        id: response.id,
        producerId: response.producerId,
        kind: response.kind,
        rtpParameters: response.rtpParameters
      });

      const stream = new MediaStream([consumer.track]);

      console.log("STREAM RECEIVED FOR PEER:", peerId);

      onNewStream(peerId, stream);

      // Resume the consumer so video starts
      socket.emit("resumeConsumer", {
        roomId: params.roomId,
        consumerId: consumer.id
      });
    }
  );
}
