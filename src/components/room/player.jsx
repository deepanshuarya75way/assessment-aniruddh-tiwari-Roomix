"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRoomStore } from "@/store/roomStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Player({ roomId }) {
  const { room, role } = useRoomStore();
  const isHost = role === "host";

  // Helper: Extract the 11-character YouTube ID from any YouTube URL
  const extractVideoId = (url) => {
    if (!url) return "";
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : "";
  };

  // FIX 1: Initialize state directly using a function to avoid synchronous setState inside useEffect
  const [currentVideoId, setCurrentVideoId] = useState(() => 
    room?.current_video_url ? extractVideoId(room.current_video_url) : ""
  );
  const [videoUrl, setVideoUrl] = useState(room?.current_video_url || "");
  
  const playerRef = useRef(null);
  const isIncomingEvent = useRef(false); // Gatekeeper to prevent infinite loops

  // FIX 2: Declared onPlayerStateChange ABOVE the useEffect hooks so it is fully accessible
  const onPlayerStateChange = (event) => {
    if (isIncomingEvent.current || !isHost) return;

    const channel = supabase.channel(`video_sync_${roomId}`);
    const currentTime = playerRef.current.getCurrentTime();

    if (event.data === window.YT.PlayerState.PLAYING) {
      channel.send({
        type: "broadcast",
        event: "media_state",
        payload: { action: "play", time: currentTime },
      });
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      channel.send({
        type: "broadcast",
        event: "media_state",
        payload: { action: "pause", time: currentTime },
      });
    }
  };

  // Load YouTube Iframe API
  useEffect(() => {
    if (!currentVideoId) return;

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      playerRef.current = new window.YT.Player(`yt-player-${roomId}`, {
        videoId: currentVideoId,
        playerVars: {
          autoplay: 0,
          controls: isHost ? 1 : 0, // Hide controls for participants
          disablekb: isHost ? 0 : 1, // Disable keyboard shortcuts for participants
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onStateChange: onPlayerStateChange,
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [currentVideoId, roomId, isHost]);

  // Setup Realtime Syncing
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`video_sync_${roomId}`)
      .on("broadcast", { event: "media_state" }, ({ payload }) => {
        if (isHost) return;

        const player = playerRef.current;
        if (!player || !player.getPlayerState) return;

        const { action, time } = payload;
        isIncomingEvent.current = true;

        if (action === "play") {
          player.seekTo(time, true);
          player.playVideo();
        } else if (action === "pause") {
          player.pauseVideo();
          player.seekTo(time, true);
        } else if (action === "seek") {
          player.seekTo(time, true);
        }

        setTimeout(() => { isIncomingEvent.current = false; }, 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, isHost]);

  // Change Video URL (Host Only)
  const handleUpdateVideo = async (e) => {
    e.preventDefault();
    const targetId = extractVideoId(videoUrl);
    if (!targetId) return alert("Invalid YouTube URL");

    const { error } = await supabase
      .from("rooms")
      .update({ current_video_url: videoUrl })
      .eq("id", roomId);

    if (error) {
      alert("Failed to update video.");
    } else {
      setCurrentVideoId(targetId);
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col w-full h-full space-y-4">
      {isHost && (
        <form onSubmit={handleUpdateVideo} className="flex gap-2 shrink-0">
          <Input
            placeholder="Paste YouTube Video URL..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="flex-1 bg-background"
          />
          <Button type="submit">Change Video</Button>
        </form>
      )}

      {/* Video Container */}
      <div className="flex-1 relative w-full bg-black rounded-xl overflow-hidden min-h-75">
        {currentVideoId ? (
          <>
            <div id={`yt-player-${roomId}`} className="absolute inset-0 w-full h-full" />
            {!isHost && (
              <div className="absolute inset-0 z-50 bg-transparent w-full h-full cursor-not-allowed" />
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            No video loaded.
          </div>
        )}
      </div>
    </div>
  );
}