'use client';

import { useState, useEffect } from 'react';
import { useRef } from 'react';

const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};
export default function HomePage() {
  const [message, setMessage] = useState('');
  const [received, setReceived] = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3001')
    ws.current.onopen = () => {console.log('Websocket connected')}
    ws.current.onclose = () => {console.log('Websocket disconnected')}

    ws.current.onmessage = async (event) => {
      if(event.data instanceof Blob){
        const receivedMessage = await event.data.text()
        setReceived((prev) => [...prev, receivedMessage])
      }
    }
    return () => {
      ws.current?.close();
    };
  },[])

  const sendMessage = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && message) {
      ws.current.send(message);
      setMessage('');
    }
  };
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">PeerDrop</h1>
      <div className="my-4">
        <input 
          type="text" 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="border p-2 rounded"
          placeholder="Type a message..."
        />
        <button className="bg-blue-500 text-white p-2 rounded ml-2" 
        onClick={sendMessage}>
          Send Message
        </button>
      </div>
      <div>
        <h2 className="font-bold">Received Messages:</h2>
        <ul>
          {received.map((msg, index) => <li key={index}>{msg}</li>)}
        </ul>
      </div>
    </main>
  );
}