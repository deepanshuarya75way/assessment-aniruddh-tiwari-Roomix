"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase/client";
import { useRoomStore } from "@/store/roomStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Chat from "@/components/room/Chat";
import Player from "@/components/room/player";
import Whiteboard from "@/components/room/Whiteboard";
import ParticipantList from "@/components/room/ParticipantList";
import { toast } from "sonner";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { GripVertical } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoomPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const roomId = params.id;

  const { user } = useAuth();
  const router = useRouter();
  const { room, role, isLoading, setRoomData, clearRoom } = useRoomStore();
  const [error, setError] = useState("");
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Responsive listener to change resize direction on mobile
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    handleResize(); // Check on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // ERROR STATE
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <h1 className="text-2xl font-bold text-destructive">Oops!</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  // STARTUP-QUALITY LOADING SKELETON
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background overflow-hidden p-4 space-y-4">
        <div className="flex justify-between h-12 items-center">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-24" /></div>
        </div>
        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
          <Skeleton className="flex-1 rounded-xl" />
          <Skeleton className="w-full lg:w-80 h-[40vh] lg:h-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden transition-colors duration-300">
      {/* HEADER - Mobile optimized */}
      <header className="flex flex-wrap items-center justify-between p-4 border-b border-border h-auto min-h-16 shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold truncate max-w-[150px] sm:max-w-xs">{room?.name}</h1>
          <span className="text-[10px] sm:text-xs px-2 py-1 bg-primary/20 text-primary rounded-full uppercase tracking-wider font-semibold">
            {role}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={isWhiteboardOpen ? "default" : "secondary"} 
            size="sm"
            onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
            className="hidden sm:flex transition-all duration-300"
          >
            {isWhiteboardOpen ? "Close Whiteboard" : "Open Whiteboard"}
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Invite link copied to clipboard!");
          }}>
            Share Link
          </Button>
          <Button variant="destructive" size="sm" onClick={() => router.push('/dashboard')}>Leave</Button>
        </div>
      </header>

      {/* MOBILE BOARD TOGGLE (Shows only on small screens) */}
      <div className="sm:hidden p-2 border-b border-border bg-card">
        <Button 
          variant={isWhiteboardOpen ? "default" : "secondary"} 
          size="sm"
          className="w-full"
          onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
        >
          {isWhiteboardOpen ? "Close Whiteboard" : "Open Whiteboard"}
        </Button>
      </div>

      {/* MAIN CONTENT AREA - Resizable Panels */}
      <PanelGroup 
        direction={isDesktop ? "horizontal" : "vertical"} 
        className="flex-1 overflow-hidden"
      >
        {/* LEFT PANEL: Video & Whiteboard */}
        <Panel defaultSize={75} minSize={40} className="flex flex-col transition-all">
          <div className={`flex-1 flex p-2 sm:p-4 gap-4 overflow-hidden ${isWhiteboardOpen ? "flex-col lg:flex-row" : "flex-col"}`}>
            
            {/* Video Player */}
            <div className="flex-1 w-full h-full min-h-[300px] bg-secondary/10 rounded-xl p-2 border border-border flex items-center justify-center transition-all duration-300 shadow-sm">
              <Player roomId={roomId} />
            </div>

            {/* Whiteboard */}
            {isWhiteboardOpen && (
              <div className="flex-1 w-full h-full min-h-[400px] transition-all duration-300 animate-in fade-in zoom-in-95">
                <Whiteboard roomId={roomId} />
              </div>
            )}
            
          </div>
        </Panel>

        {/* RESIZE DRAG HANDLE */}
        <PanelResizeHandle className="relative flex items-center justify-center bg-border/50 hover:bg-primary/50 transition-colors w-full h-2 lg:w-2 lg:h-full cursor-row-resize lg:cursor-col-resize group">
          <div className="absolute z-10 flex items-center justify-center w-6 h-6 rounded-md bg-card border border-border text-muted-foreground group-hover:text-primary transition-colors shadow-sm">
            <GripVertical className="w-4 h-4 rotate-90 lg:rotate-0" />
          </div>
        </PanelResizeHandle>

        {/* RIGHT PANEL: Sidebar (Participants & Chat) */}
        <Panel defaultSize={25} minSize={20} maxSize={50} className="flex flex-col bg-card transition-all">
          <div className="flex flex-col h-full">
            <ParticipantList roomId={roomId} />
            <div className="flex-1 overflow-hidden">
              <Chat roomId={roomId} />
            </div>
          </div>
        </Panel>

      </PanelGroup>
    </div>
  );
}