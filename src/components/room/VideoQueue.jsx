"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRoomStore } from "@/store/roomStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, PlayCircle } from "lucide-react";

export default function VideoQueue({ roomId }) {
  const { role } = useRoomStore();
  const isHost = role === "host";
  const [queue, setQueue] = useState([]);
  const [url, setUrl] = useState("");
  
  // Track queue in a ref so our Auto-Play listener always has the freshest data
  const queueRef = useRef([]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const extractVideoId = (link) => {
    if (!link) return "";
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = link.match(regExp);
    return match && match[2].length === 11 ? match[2] : "";
  };

  // 1. Broadcast & Listeners
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`queue_sync_${roomId}`)
      .on("broadcast", { event: "update_queue" }, ({ payload }) => { setQueue(payload.queue); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const broadcastQueue = (newQueue) => {
    setQueue(newQueue);
    supabase.channel(`queue_sync_${roomId}`).send({
      type: "broadcast", event: "update_queue", payload: { queue: newQueue },
    });
  };

  // 2. Add to Queue
  const handleAddVideo = (e) => {
    e.preventDefault();
    const vidId = extractVideoId(url);
    if (!vidId) return alert("Invalid YouTube URL");
    const newItem = { id: vidId + Date.now(), videoId: vidId, url: url };
    broadcastQueue([...queue, newItem]);
    setUrl("");
  };

  // 3. Remove from Queue
  const handleRemove = (idToRemove, currentQueue) => {
    if (!isHost) return;
    const targetQueue = currentQueue || queue;
    const newQueue = targetQueue.filter(item => item.id !== idToRemove);
    broadcastQueue(newQueue);
  };

  // 4. Smooth Play Next (No Reload!)
  const handlePlayNext = async (vidUrl, idToRemove, currentQueue) => {
    if (!isHost) return;
    
    // Update database
    const { error } = await supabase.from("rooms").update({ current_video_url: vidUrl }).eq("id", roomId);
    
    if (!error) {
      handleRemove(idToRemove, currentQueue);
      
      // Tell HOST player to swap video immediately
      window.dispatchEvent(new CustomEvent("force_video_change", { detail: { url: vidUrl } }));
      
      // Tell PARTICIPANT players to swap video immediately
      supabase.channel(`video_sync_${roomId}`).send({
        type: "broadcast", event: "change_video", payload: { url: vidUrl },
      });
    }
  };

  // 5. The Auto-Play Listener
  useEffect(() => {
    if (!isHost) return;
    
    const handleVideoEnded = () => {
      const currentQ = queueRef.current;
      // If there is a video waiting in the queue, Auto-Play it!
      if (currentQ.length > 0) {
        const nextVideo = currentQ[0];
        handlePlayNext(nextVideo.url, nextVideo.id, currentQ);
      }
    };

    window.addEventListener("host_video_ended", handleVideoEnded);
    return () => window.removeEventListener("host_video_ended", handleVideoEnded);
  }, [isHost, handlePlayNext]);

  return (
    <div className="flex flex-col h-full border-t border-border bg-card">
      <div className="p-3 border-b border-border bg-secondary/20">
        <h3 className="font-semibold text-sm mb-2">Video Queue ({queue.length})</h3>
        <form onSubmit={handleAddVideo} className="flex gap-2">
          <Input
            placeholder="Paste YouTube Link..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-8 text-xs"
          />
          <Button type="submit" size="sm" className="h-8">Add</Button>
        </form>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-48">
        {queue.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground mt-4">Queue is empty</p>
        ) : (
          queue.map((item) => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 border border-border">
              <image src={`https://img.youtube.com/vi/${item.videoId}/default.jpg`} alt="Thumbnail" className="w-10 h-8 object-cover rounded" />
              <span className="flex-1 text-xs truncate text-muted-foreground">{item.url}</span>
              {isHost && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500 hover:text-green-400" onClick={() => handlePlayNext(item.url, item.id, queue)}>
                    <PlayCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-red-400" onClick={() => handleRemove(item.id, queue)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}