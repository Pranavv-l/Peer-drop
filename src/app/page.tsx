'use client';

import { useState, useEffect } from 'react';
import { useRef } from 'react';

export default function HomePage() {
  const [message, setMessage] = useState('');
  const [received, setReceived] = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3000')
    ws.current.onopen = () => {console.log('Websocket connected')}
    ws.current.onclose = () => {console.log('Websocket connected')}

    ws.current.onmessage = (event) => {
      const receivedMessage = event.data.toString();
      setReceived((prev) => [...prev, receivedMessage])
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