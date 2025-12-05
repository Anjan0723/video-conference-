const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const mediasoup = require("mediasoup");
const { getRoom, createRoom } = require("./mediasoup/roomManager");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ------------------------------
// MEDIASOUP WORKER INIT
// ------------------------------
let worker;

(async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999
  });

  console.log("Mediasoup Worker started");
})();

// ------------------------------
// SOCKET.IO ROUTES
// ------------------------------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", async ({ roomId, name }, callback) => {
    let room = await getRoom(roomId);

    if (!room) {
      room = await createRoom(roomId, worker);
    }

    const peer = room.addPeer(socket.id, name);

    socket.join(roomId);

    callback({
      rtpCapabilities: room.router.rtpCapabilities,
      peers: room.getPeerList()
    });

    socket.to(roomId).emit("newPeer", peer);
  });

  socket.on("createSendTransport", async ({ roomId }, callback) => {
    const room = await getRoom(roomId);
    const transport = await room.createSendTransport(socket.id);

    callback(transport.params);
  });

  socket.on("connectSendTransport", async ({ roomId, dtlsParameters }) => {
    const room = await getRoom(roomId);
    await room.connectSendTransport(socket.id, dtlsParameters);
  });

  socket.on("produce", async ({ roomId, kind, rtpParameters }, callback) => {
    const room = await getRoom(roomId);
    const producerId = await room.produce(socket.id, kind, rtpParameters);

    socket.to(roomId).emit("newProducer", { producerId, peerId: socket.id });

    callback({ id: producerId });
  });

  socket.on("createRecvTransport", async ({ roomId }, callback) => {
    const room = await getRoom(roomId);
    const transport = await room.createRecvTransport(socket.id);

    callback(transport.params);
  });

  socket.on("connectRecvTransport", async ({ roomId, dtlsParameters }) => {
    const room = await getRoom(roomId);
    await room.connectRecvTransport(socket.id, dtlsParameters);
  });

  socket.on("consume", async ({ roomId, producerId, rtpCapabilities }, callback) => {
    const room = await getRoom(roomId);

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      return callback({ error: "Cannot consume" });
    }

    const consumer = await room.consume(socket.id, producerId, rtpCapabilities);

    callback({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters
    });
  });

  socket.on("resumeConsumer", async ({ roomId, consumerId }) => {
    const room = await getRoom(roomId);
    await room.resumeConsumer(socket.id, consumerId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("SFU server running on 3001");
});
