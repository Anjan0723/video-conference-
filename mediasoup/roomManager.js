const mediasoup = require("mediasoup");

const rooms = new Map();

async function createRoom(roomId, worker) {
  const mediaCodecs = [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: { "x-google-start-bitrate": 1000 }
    }
  ];

  const router = await worker.createRouter({ mediaCodecs });

  const room = {
    id: roomId,
    router,
    peers: new Map(),

    addPeer(id, name) {
      const peer = {
        id,
        name,
        transports: [],
        producers: [],
        consumers: []
      };
      this.peers.set(id, peer);
      return peer;
    },

    getPeerList() {
      return Array.from(this.peers.values()).map(p => ({
        id: p.id,
        name: p.name
      }));
    },

    async createSendTransport(peerId) {
      const transport = await this.router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: null }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true
      });

      this.peers.get(peerId).transports.push(transport);

      return {
        transport,
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        }
      };
    },

    async connectSendTransport(peerId, dtlsParameters) {
      const transport = this.peers.get(peerId).transports[0];
      await transport.connect({ dtlsParameters });
    },

    async produce(peerId, kind, rtpParameters) {
      const transport = this.peers.get(peerId).transports[0];

      const producer = await transport.produce({ kind, rtpParameters });

      this.peers.get(peerId).producers.push(producer);

      return producer.id;
    },

    async createRecvTransport(peerId) {
      const transport = await this.router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: null }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true
      });

      this.peers.get(peerId).transports.push(transport);

      return {
        transport,
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        }
      };
    },

    async connectRecvTransport(peerId, dtlsParameters) {
      const transports = this.peers.get(peerId).transports;
      const transport = transports[transports.length - 1];
      await transport.connect({ dtlsParameters });
    },

    async consume(peerId, producerId, rtpCapabilities) {
      const transport = this.peers.get(peerId).transports.slice(-1)[0];

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true
      });

      this.peers.get(peerId).consumers.push(consumer);

      return consumer;
    },

    async resumeConsumer(peerId, consumerId) {
      const peer = this.peers.get(peerId);
      const consumer = peer.consumers.find(c => c.id === consumerId);
      await consumer.resume();
    }
  };

  rooms.set(roomId, room);

  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

module.exports = { createRoom, getRoom };
