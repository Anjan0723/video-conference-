import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

export let socket = null;

// --------------------------------------------
// CONNECT SOCKET OVER HTTPS (WSS)
// --------------------------------------------
export function connectSocket() {
  const backendURL = `https://${window.location.hostname}:3001`;

  socket = io(backendURL, {
    transports: ["websocket"],
    secure: true,
    rejectUnauthorized: false, // Allow self-signed cert
  });

  socket.on("connect", () => {
    console.log("Connected to backend:", backendURL);
  });

  return socket;
}

let device;
let sendTransport;
let recvTransport;

export let localStream = null;

let params = {
  roomId: null,
  name: null,
};

// --------------------------------------------
// JOIN ROOM
// --------------------------------------------
export async function joinRoom(roomId, name, onNewStream) {
  params.roomId = roomId;
  params.name = name;

  return new Promise((resolve) => {
    socket.emit("joinRoom", { roomId, name }, async (data) => {
      console.log("Joined room:", data);

      await loadDevice(data.rtpCapabilities);
      recvTransport = await createRecvTransport();

      resolve(data.peers);

      // Consume existing producers
      data.peers.forEach((p) => {
        if (p.id !== socket.id && p.producers?.length) {
          p.producers.forEach((producerId) => {
            consumePeer(producerId, p.id, onNewStream);
          });
        }
      });

      socket.on("newProducer", async ({ producerId, peerId }) => {
        consumePeer(producerId, peerId, onNewStream);
      });
    });
  });
}

// --------------------------------------------
// LOAD DEVICE
// --------------------------------------------
async function loadDevice(routerRtpCapabilities) {
  device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities });
}

// --------------------------------------------
// START PRODUCING (SEND VIDEO + AUDIO)
// --------------------------------------------
export async function startProducing(previewStream) {
  localStream = previewStream;

  sendTransport = await createSendTransport();

  // VIDEO
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) await sendTransport.produce({ track: videoTrack });

  // AUDIO
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) await sendTransport.produce({ track: audioTrack });

  return localStream;
}

// --------------------------------------------
// SEND TRANSPORT
// --------------------------------------------
function createSendTransport() {
  return new Promise((resolve) => {
    socket.emit("createSendTransport", { roomId: params.roomId }, (options) => {
      const transport = device.createSendTransport(options);

      transport.on("connect", ({ dtlsParameters }, callback) => {
        socket.emit("connectSendTransport", {
          roomId: params.roomId,
          dtlsParameters,
        });
        callback();
      });

      transport.on("produce", ({ kind, rtpParameters }, callback) => {
        socket.emit(
          "produce",
          { roomId: params.roomId, kind, rtpParameters },
          ({ id }) => callback({ id })
        );
      });

      resolve(transport);
    });
  });
}

// --------------------------------------------
// RECV TRANSPORT
// --------------------------------------------
function createRecvTransport() {
  return new Promise((resolve) => {
    socket.emit("createRecvTransport", { roomId: params.roomId }, (options) => {
      const transport = device.createRecvTransport(options);

      transport.on("connect", ({ dtlsParameters }, callback) => {
        socket.emit("connectRecvTransport", {
          roomId: params.roomId,
          dtlsParameters,
        });
        callback();
      });

      resolve(transport);
    });
  });
}

// --------------------------------------------
// CONSUME STREAM
// --------------------------------------------
async function consumePeer(producerId, peerId, onNewStream) {
  socket.emit(
    "consume",
    {
      roomId: params.roomId,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    },
    async (res) => {
      if (res.error) return console.error("Consume error:", res.error);

      const consumer = await recvTransport.consume({
        id: res.id,
        producerId: res.producerId,
        kind: res.kind,
        rtpParameters: res.rtpParameters,
      });

      const stream = new MediaStream([consumer.track]);
      onNewStream(peerId, stream);

      socket.emit("resumeConsumer", {
        roomId: params.roomId,
        consumerId: consumer.id,
      });
    }
  );
}
