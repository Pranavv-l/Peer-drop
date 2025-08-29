const rooms = {}
const {WebSocketServer} = require('ws')

const port = 3001
const wss = new WebSocketServer({port})

wss.on('connection',(ws) => {
    console.log('A client connected!');

    ws.on('message', (message) => {
        const data = JSON.parse(message)
        switch (data.type) {
            case 'create-room':
              const roomId = Math.random().toString(36).substring(7);
              rooms[roomId] = [ws];
              ws.roomId = roomId;
              ws.send(JSON.stringify({ type: 'room-created', roomId }));
              break;
            case 'join-room':
              if (rooms[data.roomId]) {
                rooms[data.roomId].push(ws);
                ws.roomId = data.roomId;
                rooms[data.roomId].forEach(client => {
                  if (client.readyState === ws.OPEN) {
                    client.send(JSON.stringify({ type: 'room-joined' }));
                  }
                });
              } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
              }
              break;
            default:
              if (ws.roomId && rooms[ws.roomId]) {
                rooms[ws.roomId].forEach(client => {
                  if (client !== ws && client.readyState === ws.OPEN) {
                    client.send(message.toString());
                  }
                });
              }
              break;
          }
    })

    ws.on('close', () => {
        console.log('A client disconnected.');
    })
})

console.log(`Websocket started at ${port}`)

