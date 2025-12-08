const express = require("express");
const https = require("https");
const fs = require("fs");
const socketIO = require("socket.io");
const cors = require("cors");
const mediasoup = require("mediasoup");
const { getRoom, createRoom } = require("./mediasoup/roomManager");

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------------
// 1. LOAD HTTPS CERTIFICATES
// ------------------------------------------------------------
const options = {
  key: fs.readFileSync("./key.pem"),
  cert: fs.readFileSync("./cert.pem"),
};

// ------------------------------------------------------------
// 2. CREATE HTTPS SERVER
// ------------------------------------------------------------
const server = https.createServer(options, app);

// ------------------------------------------------------------
// 3. SOCKET.IO OVER HTTPS + WSS
// ------------------------------------------------------------
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ------------------------------------------------------------
// 4. MEDIASOUP WORKER
// ------------------------------------------------------------
let worker;
(async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });
  console.log("Mediasoup Worker started");
})();

// ------------------------------------------------------------
// 5. SOCKET.IO EVENTS
// ------------------------------------------------------------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", async ({ roomId, name }, callback) => {
    let room = getRoom(roomId);
    const isHost = !room;

    if (!room) room = await createRoom(roomId, worker);

    const peer = room.addPeer(socket.id, name);
    peer.isHost = isHost;

    socket.join(roomId);

    callback({
      rtpCapabilities: room.router.rtpCapabilities,
      peers: room.getPeerList(),
      isHost,
    });

    socket.to(roomId).emit("newPeer", peer);

    room.peers.forEach((otherPeer) => {
      if (otherPeer.id !== socket.id) {
        otherPeer.producers.forEach((producer) => {
          socket.emit("newProducer", {
            producerId: producer.id,
            peerId: otherPeer.id,
          });
        });
      }
    });
  });

  socket.on("createSendTransport", async ({ roomId }, callback) => {
    const room = getRoom(roomId);
    const { params } = await room.createSendTransport(socket.id);
    callback(params);
  });

  socket.on("connectSendTransport", async ({ roomId, dtlsParameters }) => {
    const room = getRoom(roomId);
    await room.connectSendTransport(socket.id, dtlsParameters);
  });

  socket.on("produce", async ({ roomId, kind, rtpParameters }, callback) => {
    const room = getRoom(roomId);
    const producerId = await room.produce(socket.id, kind, rtpParameters);

    socket.to(roomId).emit("newProducer", {
      producerId,
      peerId: socket.id,
    });

    callback({ id: producerId });
  });

  socket.on("createRecvTransport", async ({ roomId }, callback) => {
    const room = getRoom(roomId);
    const { params } = await room.createRecvTransport(socket.id);
    callback(params);
  });

  socket.on("connectRecvTransport", async ({ roomId, dtlsParameters }) => {
    const room = getRoom(roomId);
    await room.connectRecvTransport(socket.id, dtlsParameters);
  });

  socket.on("consume", async ({ roomId, producerId, rtpCapabilities }, callback) => {
    const room = getRoom(roomId);

    try {
      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: "Cannot consume" });
      }

      const consumer = await room.consume(socket.id, producerId, rtpCapabilities);

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (error) {
      console.error("Consume Error:", error);
      callback({ error: error.toString() });
    }
  });

  socket.on("resumeConsumer", async ({ roomId, consumerId }) => {
    const room = getRoom(roomId);
    await room.resumeConsumer(socket.id, consumerId);
  });
});

// ------------------------------------------------------------
// 6. START HTTPS SERVER
// ------------------------------------------------------------
server.listen(3001, "0.0.0.0", () => {
  console.log("🚀 HTTPS SFU running at:");
  console.log("👉 https://10.1.1.13:3001");
});
