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

let params = {
  roomId: null,
  name: null
};

// Store peer connections and streams
export const peers = {};
export let localStream = null;

// ------------------------------------
// CONNECT SOCKET
// ------------------------------------
export function connectSocket() {
  socket = io("http://localhost:3001");

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

      await loadDevice(data.rtpCapabilities);

      resolve(data.peers);

      // When another peer joins
      socket.on("newPeer", (peer) => {
        console.log("New Peer Joined:", peer);
      });

      // When new producer is available
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
    }
  }

  await device.load({ routerRtpCapabilities });
}

// ------------------------------------
// PRODUCE (SEND AUDIO/VIDEO)
// ------------------------------------
export async function startProducing() {
  console.log("Starting local stream…");

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  // SEND TRANSPORT
  const sendTransport = await createSendTransport();

  // Produce VIDEO
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    await sendTransport.produce({ track: videoTrack });
  }

  // Produce AUDIO
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    await sendTransport.produce({ track: audioTrack });
  }

  return localStream;
}

// ------------------------------------
// CREATE SEND TRANSPORT
// ------------------------------------
async function createSendTransport() {
  return new Promise((resolve) => {
    socket.emit("createSendTransport", { roomId: params.roomId }, async (transportOptions) => {
      const transport = device.createSendTransport(transportOptions);

      transport.on("connect", async ({ dtlsParameters }, callback) => {
        socket.emit("connectSendTransport", {
          roomId: params.roomId,
          dtlsParameters
        });
        callback();
      });

      transport.on("produce", async ({ kind, rtpParameters }, callback) => {
        socket.emit(
          "produce",
          {
            roomId: params.roomId,
            kind,
            rtpParameters
          },
          ({ id }) => {
            callback({ id });
          }
        );
      });

      resolve(transport);
    });
  });
}

// ------------------------------------
// CREATE RECEIVE TRANSPORT
// ------------------------------------
async function createRecvTransport() {
  return new Promise((resolve) => {
    socket.emit("createRecvTransport", { roomId: params.roomId }, (transportOptions) => {
      const transport = device.createRecvTransport(transportOptions);

      transport.on("connect", ({ dtlsParameters }, callback) => {
        socket.emit("connectRecvTransport", {
          roomId: params.roomId,
          dtlsParameters
        });
        callback();
      });

      resolve(transport);
    });
  });
}

// ------------------------------------
// CONSUME A PRODUCER
// ------------------------------------
async function consumePeer(producerId, peerId, onNewStream) {
  const recvTransport = await createRecvTransport();

  socket.emit(
    "consume",
    {
      roomId: params.roomId,
      producerId,
      rtpCapabilities: device.rtpCapabilities
    },
    async (result) => {
      if (result.error) {
        return console.error("Consume error:", result.error);
      }

      const consumer = await recvTransport.consume({
        id: result.id,
        producerId: result.producerId,
        kind: result.kind,
        rtpParameters: result.rtpParameters
      });

      const stream = new MediaStream();
      stream.addTrack(consumer.track);

      // Add video/audio to UI
      onNewStream(peerId, stream);

      socket.emit("resumeConsumer", {
        roomId: params.roomId,
        consumerId: consumer.id
      });
    }
  );
}
