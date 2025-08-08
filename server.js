
const {WebSocketServer} = require('ws')

const port = 3001
const wss = new WebSocketServer({port})

wss.on('connection',(ws) => {
    console.log('A client connected!');

    ws.on('message', (message) => {
        console.log(`recieved message: ${message}`)
        wss.clients.forEach((client) => {
            if ( client !== ws && client.readyState === ws.OPEN){
                client.send(message)
            }
        })
    })

    ws.on('close', () => {
        console.log('A client disconnected.');
    })
})

console.log(`Websocket started at ${port}`)

