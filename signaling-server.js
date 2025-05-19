import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3001 });
console.log('✅ Signaling server listening on port 3001');

const clients = new Map();

wss.on('connection', socket => {
  socket.on('message', raw => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch (e) {
      console.error('Invalid JSON:', raw);
      return;
    }

    const { type, data } = message;

    if (type === 'join') {
      const { language } = data;
      clients.set(socket, { language, isAvailable: true, peer: null });

      const match = [...clients.entries()].find(([s, c]) =>
        s !== socket &&
        c.language === language &&
        c.isAvailable &&
        !c.peer
      );

      if (match) {
        const [peerSocket] = match;

        clients.get(socket).isAvailable = false;
        clients.get(peerSocket).isAvailable = false;
        clients.get(socket).peer = peerSocket;
        clients.get(peerSocket).peer = socket;

        // ✅ THIS IS THE FIXED PART:
        socket.send(JSON.stringify({ type: 'match', data: { isCaller: true } }));
        peerSocket.send(JSON.stringify({ type: 'match', data: { isCaller: false } }));
      }
    }

    if (['offer', 'answer', 'candidate'].includes(type)) {
      const peer = clients.get(socket)?.peer;
      if (peer) {
        peer.send(JSON.stringify({ type, data }));
      }
    }

    if (type === 'leave') {
      const peer = clients.get(socket)?.peer;
      if (peer) {
        peer.send(JSON.stringify({ type: 'leave' }));
        clients.get(peer).isAvailable = true;
        clients.get(peer).peer = null;
      }
      clients.get(socket).isAvailable = true;
      clients.get(socket).peer = null;
    }
  });

  socket.on('close', () => {
    const peer = clients.get(socket)?.peer;
    if (peer) {
      peer.send(JSON.stringify({ type: 'leave' }));
      clients.get(peer).isAvailable = true;
      clients.get(peer).peer = null;
    }
    clients.delete(socket);
  });
});
