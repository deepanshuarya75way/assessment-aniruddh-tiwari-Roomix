"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRoomStore } from "@/store/roomStore";

export default function HeaderAvatars({ roomId }) {
  const { user } = useAuth();
  const { role } = useRoomStore();
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!roomId || !user?.id) return;

    const presenceChannel = supabase.channel(`presence_${roomId}`, {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const users = [];
        for (const id in state) {
          users.push(state[id][0]); 
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            id: user.id,
            email: user.email,
            role: role || "participant",
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      presenceChannel.untrack();
      supabase.removeChannel(presenceChannel);
    };
  }, [roomId, user?.id, user?.email, role]);

  // Max avatars to show before adding a "+X" circle
  const maxDisplay = 4;
  const displayedUsers = onlineUsers.slice(0, maxDisplay);
  const remaining = onlineUsers.length - maxDisplay;

  return (
    <div className="flex items-center justify-center">
      <div className="flex -space-x-3 overflow-hidden p-1">
        {displayedUsers.map((p, i) => (
          <div 
            key={p.id} 
            title={p.email}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground border-2 border-background text-xs font-bold shadow-sm relative group"
            style={{ zIndex: 10 - i }}
          >
            {/* Show first letter of email */}
            {p.email?.charAt(0).toUpperCase()}
            
            {/* Green active dot */}
            <span className="absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background"></span>
          </div>
        ))}
        
        {remaining > 0 && (
          <div 
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground border-2 border-background text-xs font-bold shadow-sm"
            style={{ zIndex: 0 }}
          >
            +{remaining}
          </div>
        )}
      </div>
    </div>
  );
}