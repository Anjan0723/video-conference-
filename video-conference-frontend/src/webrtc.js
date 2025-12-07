import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

export let socket = null;

// TURN/STUN SERVERS
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "YOUR_METERED_USERNAME",
    credential: "YOUR_METERED_PASSWORD"
  }
];

let device = null;

// GLOBAL TRANSPORTS
let sendTransport = null;
let recvTransport = null;

export let localStream = null;

let params = {
  roomId: null,
  name: null
};

// =========================================================
// CONNECT SOCKET
// =========================================================
export function connectSocket() {
 socket = io("http://192.168.1.104:3001");


  socket.on("connect", () => {
    console.log("Connected:", socket.id);
  });

  return socket;
}

// =========================================================
// JOIN ROOM
// =========================================================
export async function joinRoom(roomId, name, onNewStream) {
  params.roomId = roomId;
  params.name = name;

  return new Promise((resolve) => {
    socket.emit("joinRoom", { roomId, name }, async (data) => {
      console.log("Joined Room:", data);

      await loadDevice(data.rtpCapabilities);

      // Create a persistent recv transport
      recvTransport = await createRecvTransport();

      resolve(data.peers);

      socket.on("newPeer", (peer) => {
        console.log("New Peer:", peer);
      });

      socket.on("newProducer", async ({ producerId, peerId }) => {
        console.log("New Producer:", producerId);
        await consumePeer(producerId, peerId, onNewStream);
      });
    });
  });
}

// =========================================================
// LOAD DEVICE
// =========================================================
async function loadDevice(routerRtpCapabilities) {
  device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities });
}

// =========================================================
// START SENDING LOCAL STREAM
// =========================================================
export async function startProducing() {
  console.log("Starting local stream...");

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

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

// =========================================================
// CREATE SEND TRANSPORT
// =========================================================
function createSendTransport() {
  return new Promise((resolve) => {
    socket.emit(
      "createSendTransport",
      { roomId: params.roomId },
      (transportOptions) => {
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
      }
    );
  });
}

// =========================================================
// CREATE RECV TRANSPORT
// =========================================================
function createRecvTransport() {
  return new Promise((resolve) => {
    socket.emit(
      "createRecvTransport",
      { roomId: params.roomId },
      (transportOptions) => {
        recvTransport = device.createRecvTransport(transportOptions);

        recvTransport.on("connect", ({ dtlsParameters }, callback) => {
          socket.emit("connectRecvTransport", {
            roomId: params.roomId,
            dtlsParameters
          });
          callback();
        });

        resolve(recvTransport);
      }
    );
  });
}

// =========================================================
// CONSUME STREAM
// =========================================================
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

      const consumer = await recvTransport.consume({
        id: response.id,
        producerId: response.producerId,
        kind: response.kind,
        rtpParameters: response.rtpParameters
      });

      const stream = new MediaStream([consumer.track]);

      onNewStream(peerId, stream);

      socket.emit("resumeConsumer", {
        roomId: params.roomId,
        consumerId: consumer.id
      });
    }
  );
}
