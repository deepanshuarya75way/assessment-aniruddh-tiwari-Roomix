"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Chat({ roomId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef(null);

  // 1. Fetch initial messages & subscribe to new ones
  useEffect(() => {
    if (!roomId) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, profiles(email)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
        
      if (data) setMessages(data);
      if (error) console.error("History fetch error:", error);
    };

    fetchHistory();

    // The Robust Realtime Subscription
    const channel = supabase
      .channel(`room_chat_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`, // Track ONLY this room's messages
        },
        async (payload) => {
          console.log("New real-time payload received:", payload);

          // Fetch the sender's email profile instantly
          const { data: profileData } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", payload.new.user_id)
            .maybeSingle();

          const newMsg = {
            ...payload.new,
            profiles: { email: profileData?.email || "User Joined" }
          };

          // Append to state immediately
          setMessages((prev) => {
            // Prevent duplicate message bugs
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe((status) => {
        console.log(`Supabase Realtime Connection Status for Chat: ${status}`);
      });

    // Clean up subscription channel when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]); 

  // 3. Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const textToSend = newMessage;
    setNewMessage(""); // Clear input immediately for UX

    const { error } = await supabase.from("messages").insert([
      { room_id: roomId, user_id: user.id, content: textToSend }
    ]);

    if (error) console.error("Message failed to send:", error);
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border font-semibold">
        Room Chat
      </div>
      
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground mt-4">
            No messages yet. Say hi!
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === user?.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-muted-foreground uppercase mb-1 px-1">
                  {msg.profiles?.email?.split('@')[0]}
                </span>
                <div className={`px-3 py-2 rounded-lg max-w-[85%] text-sm ${
                  isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}>
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-2">
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={!newMessage.trim()}>Send</Button>
      </form>
    </div>
  );
}