"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRoomStore } from "@/store/roomStore";
import { useAuth } from "@/components/providers/AuthProvider";
import { MonitorX, MonitorUp, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";


export default function ScreenShare({ roomId, isSharing, onStopSharing }) {
  const { role } = useRoomStore();
  const { user } = useAuth();
  const isHost = role === "host";

  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const callsRef = useRef([]);
  const channelRef = useRef(null);
  const isMountedRef = useRef(true);

  const [status, setStatus] = useState("idle"); 
  const [error, setError] = useState("");

  
  const cleanup = useCallback(() => {
    // Stop all active PeerJS calls
    callsRef.current.forEach((call) => {
      try { call.close(); } catch (_) { /* ignore */ }
    });
    callsRef.current = [];

    // Stop local media tracks (host screen capture)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    // Destroy PeerJS instance to free the ID on the signaling server
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (_) { /* ignore */ }
      peerRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // ─── HOST FLOW ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost || !isSharing || !roomId || !user?.id) return;

    isMountedRef.current = true;
    let cancelled = false;

    const startHostSharing = async () => {
      setStatus("connecting");
      setError("");

      // Step 1: Capture the screen FIRST (so user sees the browser prompt immediately)
      let stream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: true,
        });
      } catch (err) {
        if (!cancelled) {
          setError("Screen sharing permission denied.");
          setStatus("error");
          onStopSharing();
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = stream;

      // Show preview to host immediately
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Listen for the browser's native "Stop sharing" button
      stream.getVideoTracks()[0].onended = () => {
        if (isMountedRef.current) {
          broadcastStop();
          cleanup();
          onStopSharing();
        }
      };

      // Step 2: Create PeerJS instance with a RANDOM ID (avoids ID collision)
      const { Peer } = await import("peerjs");
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const hostPeerId = `roomix_${roomId}_host_${randomSuffix}`;

      const peer = new Peer(hostPeerId, {
        host: "0.peerjs.com",
        port: 443,
        secure: true,
      });

      peerRef.current = peer;

      peer.on("open", (id) => {
        if (cancelled) return;

        // Step 3: Answer incoming calls from participants with our screen stream
        peer.on("call", (call) => {
          if (localStreamRef.current) {
            call.answer(localStreamRef.current);
            callsRef.current.push(call);

            call.on("close", () => {
              callsRef.current = callsRef.current.filter((c) => c !== call);
            });
          }
        });

        // Step 4: Broadcast our peerId to all participants via Supabase Realtime
        // We MUST subscribe before sending
        const channel = supabase.channel(`screen_sync_${roomId}`);
        channelRef.current = channel;

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED" && !cancelled) {
            channel.send({
              type: "broadcast",
              event: "screen_share_started",
              payload: { hostPeerId: id },
            });
            setStatus("streaming");
          }
        });
      });

      peer.on("error", (err) => {
        console.error("Host PeerJS error:", err);
        if (!cancelled) {
          setError(`Connection error: ${err.type}`);
          setStatus("error");
        }
      });
    };

    startHostSharing();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      broadcastStop();
      cleanup();
    };
  }, [isHost, isSharing, roomId, user?.id]);

  // ─── PARTICIPANT FLOW ─────────────────────────────────────────────
  useEffect(() => {
    if (isHost || !isSharing || !roomId || !user?.id) return;

    isMountedRef.current = true;
    let cancelled = false;
    setStatus("connecting");
    setError("");

    // Subscribe to the screen_sync channel and wait for the host's peerId
    const channel = supabase.channel(`screen_sync_participant_${roomId}_${user.id}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "screen_share_started" }, async ({ payload }) => {
        if (cancelled || !payload?.hostPeerId) return;

        // Connect to the host via PeerJS
        const { Peer } = await import("peerjs");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const myPeerId = `roomix_${roomId}_viewer_${randomSuffix}`;

        const peer = new Peer(myPeerId, {
          host: "0.peerjs.com",
          port: 443,
          secure: true,
        });

        peerRef.current = peer;

        peer.on("open", () => {
          if (cancelled) return;

          // Call the host — send an empty MediaStream to trigger the receive pipeline
          const call = peer.call(payload.hostPeerId, new MediaStream());
          callsRef.current.push(call);

          call.on("stream", (remoteStream) => {
            if (videoRef.current && !cancelled) {
              videoRef.current.srcObject = remoteStream;
              setStatus("streaming");
            }
          });

          call.on("close", () => {
            if (videoRef.current) videoRef.current.srcObject = null;
            if (!cancelled) {
              setStatus("idle");
              onStopSharing();
            }
          });

          call.on("error", (err) => {
            console.error("Participant call error:", err);
            if (!cancelled) {
              setError("Failed to connect to host's stream.");
              setStatus("error");
            }
          });
        });

        peer.on("error", (err) => {
          console.error("Participant PeerJS error:", err);
          if (!cancelled) {
            setError(`Connection error: ${err.type}`);
            setStatus("error");
          }
        });
      })
      .on("broadcast", { event: "screen_share_stopped" }, () => {
        if (!cancelled) {
          cleanup();
          setStatus("idle");
          onStopSharing();
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      cleanup();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isHost, isSharing, roomId, user?.id]);

  // ─── Broadcast stop helper ────────────────────────────────────────
  const broadcastStop = useCallback(() => {
    // Create a fresh channel, subscribe, send stop, then remove
    const ch = supabase.channel(`screen_sync_${roomId}`);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({
          type: "broadcast",
          event: "screen_share_stopped",
          payload: {},
        });
        // Give it a moment to send before removing
        setTimeout(() => supabase.removeChannel(ch), 500);
      }
    });
  }, [roomId]);

  // ─── Host stop button handler ─────────────────────────────────────
  const handleStopClick = () => {
    broadcastStop();
    cleanup();
    onStopSharing();
  };

  // ─── RENDER ───────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
      {/* Error banner */}
      {error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-destructive/95 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
          {error}
        </div>
      )}

      {/* Connecting state */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-black/80 z-40 gap-3">
          <Loader2 className="w-8 h-8 animate-spin opacity-60" />
          <p className="text-sm font-medium">
            {isHost ? "Starting screen share..." : "Connecting to host's screen..."}
          </p>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isHost}
        className="w-full h-full object-contain"
      />

      {/* Host: Stop Sharing overlay button */}
      {isHost && status === "streaming" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleStopClick}
            className="gap-2 shadow-lg rounded-full px-5"
          >
            <MonitorX className="w-4 h-4" />
            Stop Sharing
          </Button>
        </div>
      )}

      {/* Offline fallback (when not sharing) */}
      {!isSharing && status === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-secondary/10">
          <MonitorUp className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">Stream Offline</p>
        </div>
      )}
    </div>
  );
}