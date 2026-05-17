"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRoomStore } from "@/store/roomStore";

export default function ParticipantList({ roomId }) {
  const { user } = useAuth();
  const { role } = useRoomStore();
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!roomId || !user) return;

    // 1. Initialize a specific presence channel
    const presenceChannel = supabase.channel(`presence_${roomId}`, {
      config: {
        presence: {
          key: user.id, // Uniquely identifies this user's connection
        },
      },
    });

    // 2. Listen for sync events (when users join or leave)
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        
        // Flatten the state object into a simple array of users
        const users = [];
        for (const id in state) {
          // Supabase allows multiple connections per user (e.g., phone and laptop)
          // We just take the first connection's data to represent the user
          users.push(state[id][0]); 
        }
        
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        // 3. When successfully connected, broadcast our identity to the room
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            id: user.id,
            email: user.email,
            role: role || "participant",
            online_at: new Date().toISOString(),
          });
        }
      });

    // Cleanup: leave the channel when component unmounts
    return () => {
      presenceChannel.untrack();
      supabase.removeChannel(presenceChannel);
    };
  }, [roomId, user, role]);

  return (
    <div className="flex flex-col border-b border-border bg-card">
      <div className="p-4 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Participants</h3>
        <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full font-bold">
          {onlineUsers.length} Online
        </span>
      </div>
      
      <div className="max-h-32 overflow-y-auto px-4 pb-4 space-y-2">
        {onlineUsers.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {/* Glowing Green Dot */}
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </div>
              
              <span className="truncate max-w-37.5 text-muted-foreground">
                {p.email?.split('@')[0]}
                {p.id === user?.id && " (You)"}
              </span>
            </div>
            
            {p.role === "host" && (
              <span className="text-[10px] uppercase tracking-wider text-primary border border-primary/30 px-1 rounded">
                Host
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}