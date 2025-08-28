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
  const [roomId, setRoomId] = useState('');
  const [localRoomId, setLocalRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState('Welcome to PeerDrop!');
   // Buffer for receiving file chunks
  const receiveBuffer = useRef<ArrayBuffer[]>([]);
  const receivedFileSize = useRef(0);

  useEffect(() => {
  
    ws.current = new WebSocket('ws://localhost:3001')
   
    ws.current.onmessage = async (msg) => {
     const data = JSON.parse(msg.data)

     if(!peerConnection){
      await initiatePeerConnection()
     }
     switch(data.type){
      case 'offer':
        setStatusMessage('Recived offer, preparing message')
        await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(data.offer))
        const answer = await peerConnection.current!.createAnswer()
        await peerConnection.current!.setLocalDescription(answer)
        ws.current?.send(JSON.stringify({ type: 'answer', answer, roomId }));
        setStatusMessage('Answer sent.');
        break;
      
      case 'answer':
        setStatusMessage('Received answer.');
        await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(data.answer));
        break;
      
      case 'candidate':
        try {
          await peerConnection.current!.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
        break;

      case 'room-created':
        setLocalRoomId(data.roomId);
        setStatusMessage(`Room ${data.roomId} created. Share this ID with your friend.`);
        break;

      case 'room-joined':
        await createOffer();
        break;
        
      case 'error':
        setStatusMessage(`Error: ${data.message}`);
        break;
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

  const setupDataChannelEvents = () => {
    if (!dataChannel.current) return;
    
    dataChannel.current.onopen = () => {
      console.log('Data channel is open');
    };
    
    dataChannel.current.onmessage = (event) => {
      const { data } = event;
      if (typeof data === 'string') {
        const metadata = JSON.parse(data);
        if (metadata.type === 'file') {
            receivedFileSize.current = metadata.size;
            setStatusMessage(`Receiving file: ${metadata.name}`);
        }
      } else {
        receiveBuffer.current.push(data);
        const receivedSize = receiveBuffer.current.reduce((acc, chunk) => acc + chunk.byteLength, 0);

        if (receivedSize === receivedFileSize.current) {
          const receivedFile = new Blob(receiveBuffer.current);
          setStatusMessage('File received! Preparing download...');
          
          const downloadUrl = URL.createObjectURL(receivedFile);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = "received_file";
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(downloadUrl);
          a.remove();
          receiveBuffer.current = [];
          receivedFileSize.current = 0;
        }
      }
    };
  };

  const createRoom = async () => {
    await initiatePeerConnection()
    dataChannel.current = peerConnection.current!.createDataChannel('fileTransfer')
    setupDataChannelEvents()
    ws.current?.send(JSON.stringify({ type: 'create-room' }));
  }

  const createOffer = async () => {
    setStatusMessage('Creating offer')
    const offer = await peerConnection.current!.createOffer()
    await peerConnection.current!.setLocalDescription(offer)
    ws.current?.send(JSON.stringify({ type: 'offer', offer, roomId: localRoomId }))
  }
  
  const joinRoom = () => {
    if (roomId) {
      ws.current?.send(JSON.stringify({ type: 'join-room', roomId }));
      setStatusMessage(`Attempting to join room ${roomId}...`);
    }
  }

  const sendFile = () => {
    if(!file || !dataChannel.current || dataChannel.current.readyState !== 'open'){
      setStatusMessage('File not selected or connection not ready.');
      return
    }
    setStatusMessage(`Sending file :${file.name}`)
    dataChannel.current.send(JSON.stringify({type: 'file', name: file.name, size: file.size}))

    const reader = new FileReader()
    const chunkSize = 16384; 
    let offset = 0;

    reader.onload = () => {
      if(!reader.result) return
      dataChannel.current?.send(reader.result as ArrayBuffer)
      offset += (reader.result as ArrayBuffer).byteLength;
      if (offset < file.size) {
        readSlice(offset);
    } else {
        setStatusMessage(`File "${file.name}" sent successfully.`);
    }
    }

    const readSlice = (o : number) => {
       const slice = file.slice(o, o + chunkSize);
        reader.readAsArrayBuffer(slice);
    }
    readSlice(0)
  }
  
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">PeerDrop</h1>
      <div className="my-4">
        <input 
        />
        <button className="bg-blue-500 text-white p-2 rounded ml-2" 
        onClick={sendFile}>
          Send Message
        </button>
      </div>
      <div>
        <h2 className="font-bold">Received Messages:</h2>
        <ul>
        </ul>
      </div>
    </main>
  );
}