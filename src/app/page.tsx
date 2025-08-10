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
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    const [roomId, setRoomId] = useState('');
    const [localRoomId, setLocalRoomId] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [statusMessage, setStatusMessage] = useState('Welcome to PeerDrop!');

    // Buffer for receiving file chunks
    const receiveBuffer = useRef<ArrayBuffer[]>([]);
    const receivedFileSize = useRef(0);

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

  const initiatePeerConnection = async () => {
    peerConnection.current = new RTCPeerConnection(peerConnectionConfig)
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.current?.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, roomId: localRoomId || roomId }));
      }
    };

    // This listener handles the data channel created by the other peer
    peerConnection.current.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      setupDataChannelEvents();
    };
    
    // Listen for connection state changes
    peerConnection.current.onconnectionstatechange = () => {
        if (peerConnection.current?.connectionState === 'connected') {
            setIsConnected(true);
            setStatusMessage('Connection established successfully!');
        }
    }
  }

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