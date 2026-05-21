"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { useAuth } from "@/components/providers/AuthProvider";
import { MonitorX } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function ScreenShare({ roomId, isSharing, onStopSharing }) {
  const { role } = useRoomStore();
  const { user } = useAuth();
  const isHost = role === "host";

  const videoRef = useRef(null);
  const peerInstanceRef = useRef(null);
  const localStreamRef = useRef(null);
  const callsRef = useRef([]); // Track active participant streams

  const [error, setError] = useState("");

  const handleStopSharing = () => {
    if(isHost){
        supabase.channel(`screen_sync_${roomId}`).send({
            type: "broadcast",
            event: "toggle_screen",
            payload: { isSharing: false }
        });
    }

    callsRef.current.forEach((call) => call.close());
    callsRef.current = [];

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (peerInstanceRef.current) {
      peerInstanceRef.current.destroy();
    }
    onStopSharing();
  };  

  useEffect(() => {
    if (!roomId || !user?.id) return;

    import("peerjs").then(({ Peer }) => {
      const myPeerId = isHost ? `${roomId}_host` : `${roomId}_${user.id}`;
      
      const peer = new Peer(myPeerId, {
        host: "0.peerjs.com",
        port: 443,
        secure: true,
      });

      peerInstanceRef.current = peer;

      peer.on("open", () => {
        if (isHost) {
          navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            .then((stream) => {
              localStreamRef.current = stream;
              if (videoRef.current) videoRef.current.srcObject = stream;

              // 2. 🚨 THE FIX: Tell participants to connect ONLY AFTER the stream is successfully captured!
              supabase.channel(`screen_sync_${roomId}`).send({
                type: "broadcast",
                event: "toggle_screen",
                payload: { isSharing: true }
              });

              stream.getVideoTracks()[0].onended = () => {
                handleStopSharing();
              };
            })
            .catch(() => {
              setError("Permission to share screen denied.");
              onStopSharing();
            });
        }
      });

      // 3. HOST MODE: Listen for incoming participant connection requests
      peer.on("call", (call) => {
        if (isHost && localStreamRef.current) {
          // Answer the call by pushing our screen capture stream directly to them
          call.answer(localStreamRef.current);
          callsRef.current.push(call);
        }
      });

      // 4. PARTICIPANT MODE: Connect directly to the Host's known peer ID
      if (!isHost) {
        // We know the host's ID convention structurally
        const hostPeerId = `${roomId}_host`; 
        
        // Pass an empty stream to trigger the receive pipeline hook
        const call = peer.call(hostPeerId, new MediaStream());
        
        call.on("stream", (remoteStream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = remoteStream;
          }
        });

        call.on("close", () => {
          if (videoRef.current) videoRef.current.srcObject = null;
          onStopSharing();
        });

        callsRef.current.push(call);
      }
    });

    return () => handleStopSharing();
  }, [roomId, user?.id, isHost]);


  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
      {error && <div className="absolute z-50 bg-destructive/95 text-white px-4 py-2 rounded-md text-xs">{error}</div>}
      
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isHost} // Prevents painful mic echo loops
        className="w-full h-full object-contain"
      />
      
      {!isSharing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-secondary/10">
          <MonitorX className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">Stream Offline</p>
        </div>
      )}
    </div>
  );
}