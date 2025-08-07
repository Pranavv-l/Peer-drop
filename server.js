
const {createServer} = require('http')
const next = require('next')
const {parse} = require('url')
const {WebSocketServer} = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const port = 3000
const hostname = 'localhost'

const app = next({dev, hostname, port})
const handle = app.getRequestHandler()

app.prepare().then(() => {
    const server = createServer((req,res) => {
        const parsedURL = parse(req.url, true)
        handle(req,res,parsedURL)
    })
    const wss = new WebSocketServer({server})

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

    server.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
})


