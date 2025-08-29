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
  const isRoomCreator = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState('Welcome to PeerDrop!');
  const receiveBuffer = useRef<ArrayBuffer[]>([]);
  const receivedFileSize = useRef(0);

  useEffect(() => {
  
    ws.current = new WebSocket('ws://localhost:3001')
   
    ws.current.onmessage = async (msg) => {
     const data = JSON.parse(msg.data)

     if(!peerConnection  && (data.type === 'offer' || data.type === 'candidate')){
      await initiatePeerConnection()
     }
     switch(data.type){
      case 'offer':
        if (!peerConnection.current) {
          await initiatePeerConnection();
        }
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
          if (!peerConnection.current) {
            await initiatePeerConnection();
          }
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
        if(isRoomCreator.current){
          await createOffer();
        }
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

    peerConnection.current.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      setupDataChannelEvents();
    };
    
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
    isRoomCreator.current = true

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
    <main className="flex flex-col items-center justify-center min-h-screen bg-[#faebd7] text-white p-4">
      <div className="w-full max-w-md bg-[#d0dc7f] p-6 rounded-lg shadow-xl">
        <h1 className="text-3xl text-[#381D2A] font-bold text-center  mb-2">PeerDrop</h1>
        <p className="text-center text-[#381D2A] mb-6">Direct P2P File Transfer</p>

        <div className="space-y-4">
          <div>
            <button onClick={createRoom} className="w-full bg-[#381D2A] hover:bg-[#26111b] text-white font-bold py-2 px-4 rounded transition-colors">
              Create New Room
            </button>
            {localRoomId && <p className="text-center mt-2">Your Room ID: <strong className="text-[#051a0c]">{localRoomId}</strong></p>}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter Room ID"
              className="flex-grow bg-[#faebd7] border border-gray-600 rounded p-2 focus:outline-none focus:ring-2 text-black"
            />
            <button onClick={joinRoom} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition-colors">
              Join
            </button>
          </div>
        </div>

        <div className="my-6 border-t border-gray-700"></div>
        
        {isConnected ? (
          <div className="space-y-4">
             <h2 className="text-xl font-semibold text-center">Connection Established!</h2>
             <input type="file" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"/>
             <button onClick={sendFile} className="w-full bg-[#dcaf7f] hover:bg-[#36230f] text-white font-bold py-2 px-4 rounded transition-colors">
               Send File
             </button>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <p>Please create or join a room to connect.</p>
          </div>
        )}

        <div className="mt-6 p-3 bg-gray-900 rounded text-center">
            <p className="text-sm font-mono text-gray-300">Status: {statusMessage}</p>
        </div>
      </div>
    </main>
  );
}