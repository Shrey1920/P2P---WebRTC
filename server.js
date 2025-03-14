const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (frontend)
app.use(express.static('public'));

const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

// WebSocket Signaling Server
const wss = new WebSocketServer({ server });

const peers = new Set();

wss.on('connection', ws => {
    peers.add(ws);

    ws.on('message', message => {
        for (const peer of peers) {
            if (peer !== ws) peer.send(message); // Broadcast message to other peers
        }
    });

    ws.on('close', () => {
        peers.delete(ws);
    });
});
