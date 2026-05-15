"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase/client";
import { useRoomStore } from "@/store/roomStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Chat from "@/components/room/Chat"; // Import the new Chat

export default function RoomPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const roomId = params.id;

  const { user } = useAuth();
  const router = useRouter();
  const { room, role, isLoading, setRoomData, clearRoom } = useRoomStore();
  const [error, setError] = useState("");

  // (Keep the exact same useEffect for initializeRoom here...)
  useEffect(() => {
    if (!user || !roomId) return;
    const initializeRoom = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle();
        if (!roomData) throw new Error("Room not found");
        let { data: memberData } = await supabase.from('room_members').select('role').eq('room_id', roomId).eq('user_id', user.id).maybeSingle();
        if (!memberData) {
          const { data: newMember, error: joinError } = await supabase.from('room_members').insert([{ room_id: roomId, user_id: user.id, role: 'participant' }]).select().single();
          if (joinError) throw new Error("Could not join room");
          memberData = newMember;
        }
        setRoomData(roomData, memberData.role);
      } catch (err) {
        setError(err.message);
      }
    };
    initializeRoom();
    return () => clearRoom();
  }, [roomId, user, setRoomData, clearRoom]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <h1 className="text-2xl font-bold text-red-500">Oops!</h1>
        <p>{error}</p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Loading room...</div>;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 border-b h-16 shrink-0">
        <div>
          <h1 className="text-xl font-bold">{room?.name}</h1>
          <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full uppercase tracking-wider">
            {role}
          </span>
        </div>
        <div className="flex gap-2">
          {/* We will add the "Toggle Whiteboard" button here in Phase 7 */}
          <Button variant="outline" onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert("Invite link copied!");
          }}>
            Share Invite Link
          </Button>
          <Button variant="destructive" onClick={() => router.push('/dashboard')}>Leave</Button>
        </div>
      </header>

      {/* MAIN LAYOUT: Video takes left space, Chat takes right sidebar */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Video Stream & Future Whiteboard */}
        <div className="flex-1 flex flex-col p-4">
          <div className="w-full h-full bg-secondary/30 rounded-xl border flex items-center justify-center text-muted-foreground">
            [ Phase 6: Video Player ]
          </div>
        </div>

        {/* Right Side: Chat Sidebar (Fixed Width) */}
        <div className="w-80 shrink-0">
          <Chat roomId={roomId} />
        </div>
      </div>
    </div>
  );
}