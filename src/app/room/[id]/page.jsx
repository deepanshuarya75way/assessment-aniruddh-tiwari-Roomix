"use client";

import { useEffect, useState, use, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase/client";
import { useRoomStore } from "@/store/roomStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Chat from "@/components/room/Chat";
import Player from "@/components/room/player";
import Whiteboard from "@/components/room/Whiteboard";
import VideoQueue from "@/components/room/VideoQueue";
import HeaderAvatars from "@/components/room/HeaderAvatars";
import ScreenShare from "@/components/room/ScreenShare";
import { ScreenShare as ScreenShareIcon } from "lucide-react"; 
import { toast } from "sonner";
import { 
  GripVertical, 
  X, 
  MonitorPlay, 
  MessageSquare, 
  ListVideo, 
  MoreVertical, 
  Link, 
  LogOut, 
  PenTool 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function RoomPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const roomId = params.id;

  const { user } = useAuth();
  const router = useRouter();
  const { room, role, isLoading, setRoomData, clearRoom } = useRoomStore();
  const [error, setError] = useState("");
  
  // Display View Toggles
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Sidebar Interface States
  const [activeTab, setActiveTab] = useState("chat"); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Sidebar Draggable Dimension States
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);

  // Initialize Room Data Engine securely using primitive checking
  useEffect(() => {
    if (!user?.id || !roomId) return;
    
    const initializeRoom = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .maybeSingle();
          
        if (!roomData) throw new Error("Room not found");
        
        let { data: memberData } = await supabase
          .from('room_members')
          .select('role')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (!memberData) {
          const { data: newMember, error: joinError } = await supabase
            .from('room_members')
            .insert([{ room_id: roomId, user_id: user.id, role: 'participant' }])
            .select()
            .single();
            
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
  }, [roomId, user?.id, setRoomData, clearRoom]);

  // Handle Drag-to-Resize Trackers
  const startResizing = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      
      // Boundaries: min 240px width, max 50% of parent screen width
      if (newWidth > 240 && newWidth < containerRect.width * 0.5) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!roomId) return;
    
    const channel = supabase
      .channel(`screen_sync_page_${roomId}`)
      .on("broadcast", { event: "screen_share_started" }, () => {
        if (role !== "host") {
          setIsScreenSharing(true);
          setIsVideoOpen(true);
        }
      })
      .on("broadcast", { event: "screen_share_stopped" }, () => {
        if (role !== "host") {
          setIsScreenSharing(false);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, role]);

  // Error Bounds Render Handler
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <h1 className="text-2xl font-bold text-destructive">Oops!</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  // Suspense Layout Skeleton Loader
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
    <div ref={containerRef} className="flex flex-col h-screen bg-background overflow-hidden transition-colors duration-300">
      
      {/* HYPERBEAM-STYLE COMPACT HEADER */}
      <header className="flex items-center justify-between p-4 border-b border-border h-16 shrink-0 relative z-50 bg-background">
        
        {/* Left - Workspace metadata context */}
        <div className="flex items-center w-1/3">
          <h1 className="text-lg font-bold truncate max-w-[200px] sm:max-w-xs">{room?.name}</h1>
        </div>

        {/* Center - Real-Time Presence Mesh */}
        <div className="flex justify-center w-1/3">
          <HeaderAvatars roomId={roomId} />
        </div>

        {/* Right - View Tools & Consolidated Action Console */}
        <div className="flex items-center justify-end w-1/3 gap-2">
          
          {/* Main Board Action Switcher */}
          <Button 
            variant={isWhiteboardOpen ? "default" : "secondary"} 
            size="icon"
            title={isWhiteboardOpen ? "Close Whiteboard" : "Open Whiteboard"}
            onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
            className="rounded-full h-9 w-9 transition-all"
          >
            <PenTool className="w-4 h-4" />
          </Button>

          {/* 3-Dot Action Console Dropdown */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full h-9 w-9"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <MoreVertical className="w-5 h-5" />
            </Button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-lg z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Invite link copied!");
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary flex items-center gap-3 transition-colors text-foreground"
                  >
                    <Link className="w-4 h-4 text-muted-foreground" /> Share Link
                  </button>
                  
                  <button 
                    onClick={() => setIsVideoOpen(!isVideoOpen)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary flex items-center gap-3 transition-colors text-foreground border-t border-border/40"
                  >
                    <MonitorPlay className="w-4 h-4 text-muted-foreground" /> 
                    {isVideoOpen ? "Hide Video" : "Show Video"}
                  </button>

                  {/* MISSING SCREEN SHARE BUTTON ADDED HERE */}
                  {role === "host" && (
                    <button 
                      onClick={() => {
                        const newState = !isScreenSharing;
                        setIsScreenSharing(newState);
                        if (newState) setIsVideoOpen(true);
                        setIsMenuOpen(false);
                        
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary flex items-center gap-3 transition-colors text-foreground border-t border-border/40"
                    >
                      <ScreenShareIcon className="w-4 h-4 text-primary" /> 
                      {isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                    </button>
                  )}

                  <button 
                    onClick={() => router.push('/dashboard')}
                    className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-3 transition-colors border-t border-border"
                  >
                    <LogOut className="w-4 h-4" /> Leave Room
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE HUD LAYER TOGGLES (Shows on Viewports < 640px) */}
      <div className="sm:hidden p-2 flex gap-2 border-b border-border bg-card relative z-30">
        <Button 
          variant={isVideoOpen ? "default" : "secondary"} 
          size="sm"
          className="flex-1 text-xs h-8"
          onClick={() => setIsVideoOpen(!isVideoOpen)}
        >
          {isVideoOpen ? "Hide Video" : "Show Video"}
        </Button>
        <Button 
          variant={isWhiteboardOpen ? "default" : "secondary"} 
          size="sm"
          className="flex-1 text-xs h-8"
          onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
        >
          {isWhiteboardOpen ? "Close Board" : "Open Board"}
        </Button>
      </div>

      {/* WORKSPACE AREA */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        
        {/* LEFT MULTI-VIEW MEDIA CANVAS */}
        <div className="flex-1 flex flex-col p-2 sm:p-4 gap-4 overflow-y-auto lg:overflow-hidden">
          <div className={`flex-1 flex gap-4 w-full h-full min-h-0 ${isWhiteboardOpen && isVideoOpen ? "flex-col lg:flex-row" : "flex-col"}`}>
            
            {/* Empty Context State fallback when views are hidden */}
            {!isVideoOpen && !isWhiteboardOpen && (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-secondary/5">
                <MonitorPlay className="w-12 h-12 mb-4 opacity-30 animate-pulse" />
                <p className="text-sm">Select a viewport from the options menu to continue.</p>
              </div>
            )}

            {/* Video Sync Pipeline */}
            {isVideoOpen && (
              <div className="flex-1 relative min-h-[300px] lg:h-full bg-secondary/10 rounded-xl p-2 border border-border flex items-center justify-center transition-all duration-300 shadow-sm overflow-hidden">
                {isScreenSharing ? (
                  <ScreenShare 
                    roomId={roomId} 
                    isSharing={isScreenSharing} 
                    onStopSharing={() => setIsScreenSharing(false)} 
                  />
                ) : (
                  <Player roomId={roomId} />
                )}
              </div>
            )}

            {/* Canvas Node Vector Frame */}
            {isWhiteboardOpen && (
              <div className="flex-1 min-h-[400px] lg:h-full transition-all duration-300 animate-in fade-in zoom-in-95">
                <Whiteboard roomId={roomId} />
              </div>
            )}
          </div>
        </div>

        {/* NATIVE DRAG HANDLE RESIZE SPLITTER */}
        <div 
          onMouseDown={startResizing}
          className={`hidden lg:flex select-none w-1.5 hover:w-2 bg-border/40 hover:bg-primary/60 transition-all cursor-col-resize items-center justify-center relative z-20 ${isResizing ? 'bg-primary/80 w-2' : ''}`}
        >
          <div className="absolute z-50 p-0.5 rounded border border-border bg-card text-muted-foreground shadow-sm pointer-events-none">
            <GripVertical className="w-3 h-3" />
          </div>
        </div>

        {/* RIGHT INTERACTIVE HUD SYSTEM (CHAT + PLAYLIST QUEUE) */}
        <div 
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '100%' }}
          className="w-full lg:shrink-0 flex flex-col bg-card border-t lg:border-t-0 lg:border-l border-border h-[45vh] lg:h-full transition-none relative z-20"
        >
          
          {/* ICON-DRIVEN NAVIGATION BAR TABS */}
          <div className="flex p-2 gap-2 border-b border-border bg-secondary/10 shrink-0">
            <Button 
              variant={activeTab === "chat" ? "secondary" : "ghost"} 
              size="sm" 
              title="Open Chat Terminal"
              className={`flex-1 rounded-md transition-all h-9 ${activeTab === "chat" ? "bg-background shadow-sm border border-border/40" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
            
            <Button 
              variant={activeTab === "queue" ? "secondary" : "ghost"} 
              size="sm" 
              title="Open Video Playlist Queue"
              className={`flex-1 rounded-md transition-all h-9 ${activeTab === "queue" ? "bg-background shadow-sm" : ""}`}
              onClick={() => setActiveTab("queue")}
            >
              <ListVideo className="w-4 h-4" />
            </Button>
          </div>

          {/* SYSTEM SIDEBAR VIEW LAYOUT CHANNELS */}
          <div className="flex-1 overflow-hidden flex flex-col bg-background">
            {/* Chat Frame Node */}
            <div className={activeTab === "chat" ? "flex-1 overflow-hidden flex flex-col" : "hidden"}>
              <Chat roomId={roomId} />
            </div>
            
            {/* Queue Frame Node */}
            <div className={activeTab === "queue" ? "flex-1 overflow-hidden flex flex-col" : "hidden"}>
              <VideoQueue roomId={roomId} />
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}