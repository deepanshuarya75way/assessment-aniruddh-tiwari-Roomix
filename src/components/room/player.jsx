"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRoomStore } from "@/store/roomStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Player({ roomId }) {
  const { room, role } = useRoomStore();
  const isHost = role === "host";

  const extractVideoId = (url) => {
    if (!url) return "";
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : "";
  };

  const [currentVideoId, setCurrentVideoId] = useState(() => 
    room?.current_video_url ? extractVideoId(room.current_video_url) : ""
  );
  const [videoUrl, setVideoUrl] = useState(room?.current_video_url || "");
  
  const playerRef = useRef(null);
  const isIncomingEvent = useRef(false);

  const onPlayerStateChange = (event) => {
    if (isIncomingEvent.current || !isHost) return;

    const channel = supabase.channel(`video_sync_${roomId}`);
    const currentTime = playerRef.current.getCurrentTime();

    if (event.data === window.YT.PlayerState.PLAYING) {
      channel.send({ type: "broadcast", event: "media_state", payload: { action: "play", time: currentTime } });
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      channel.send({ type: "broadcast", event: "media_state", payload: { action: "pause", time: currentTime } });
    } else if (event.data === window.YT.PlayerState.ENDED) {
      // Announce locally that the video ended so the Queue can Auto-Play
      window.dispatchEvent(new CustomEvent("host_video_ended"));
    }
  };

  // Load YouTube API
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
          autoplay: 1, // Let's turn autoplay ON so when it skips, it plays instantly
          controls: isHost ? 1 : 0,
          disablekb: isHost ? 0 : 1,
          modestbranding: 1,
          rel: 0,
        },
        events: { onStateChange: onPlayerStateChange },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current && playerRef.current.destroy) playerRef.current.destroy();
    };
  }, [currentVideoId, roomId, isHost]);

  // Setup Realtime Syncing & No-Reload Video Swapping
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`video_sync_${roomId}`)
      .on("broadcast", { event: "media_state" }, ({ payload }) => {
        if (isHost) return;
        const player = playerRef.current;
        if (!player || !player.getPlayerState) return;

        isIncomingEvent.current = true;
        if (payload.action === "play") {
          player.seekTo(payload.time, true);
          player.playVideo();
        } else if (payload.action === "pause") {
          player.pauseVideo();
          player.seekTo(payload.time, true);
        }
        setTimeout(() => { isIncomingEvent.current = false; }, 100);
      })
      // Listen for Host changing the video
      .on("broadcast", { event: "change_video" }, ({ payload }) => {
        setCurrentVideoId(extractVideoId(payload.url));
        setVideoUrl(payload.url);
      })
      .subscribe();

    // Listen for LOCAL video changes (so Host doesn't need to reload page)
    const handleLocalChange = (e) => {
      setCurrentVideoId(extractVideoId(e.detail.url));
      setVideoUrl(e.detail.url);
    };
    window.addEventListener("force_video_change", handleLocalChange);

    return () => { 
      supabase.removeChannel(channel); 
      window.removeEventListener("force_video_change", handleLocalChange);
    };
  }, [roomId, isHost]);

  // Manual Update
  const handleUpdateVideo = async (e) => {
    e.preventDefault();
    const targetId = extractVideoId(videoUrl);
    if (!targetId) return alert("Invalid YouTube URL");

    const { error } = await supabase.from("rooms").update({ current_video_url: videoUrl }).eq("id", roomId);
    if (!error) {
      setCurrentVideoId(targetId);
      // Broadcast to participants to update smoothly
      supabase.channel(`video_sync_${roomId}`).send({
        type: "broadcast", event: "change_video", payload: { url: videoUrl },
      });
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
            className="flex-1 bg-background text-xs"
          />
          <Button type="submit" size="sm">Change Video</Button>
        </form>
      )}

      <div className="flex-1 relative w-full bg-black rounded-xl overflow-hidden min-h-[300px]">
        {currentVideoId ? (
          <>
            <div id={`yt-player-${roomId}`} className="absolute inset-0 w-full h-full pointer-events-auto" />
            {!isHost && <div className="absolute inset-0 z-50 bg-transparent w-full h-full cursor-not-allowed" />}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No video loaded.</div>
        )}
      </div>
    </div>
  );
}