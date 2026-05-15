"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [myRooms, setMyRooms] = useState([]);

  // Fetch rooms the user is a part of
  useEffect(() => {
    if (!user) return;
    const fetchRooms = async () => {
      const { data, error } = await supabase
        .from('room_members')
        .select(`
          room_id,
          rooms ( id, name, host_id )
        `)
        .eq('user_id', user.id);
      
      if (!error && data) {
        setMyRooms(data.map(d => d.rooms));
      }
    };
    fetchRooms();
  }, [user]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setIsCreating(true);

    try {
      // 1. Create the room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert([{ name: roomName, host_id: user.id }])
        .select()
        .single();

      if (roomError) throw roomError;

      // 2. Add creator as the Host in room_members
      const { error: memberError } = await supabase
        .from('room_members')
        .insert([{ room_id: roomData.id, user_id: user.id, role: 'host' }]);

      if (memberError) throw memberError;

      // 3. Redirect to the new room
      router.push(`/room/${roomData.id}`);
    } catch (error) {
      alert("Error creating room: " + error.message);
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 mt-10">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button onClick={() => supabase.auth.signOut()} variant="outline">Log Out</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create Room Card */}
        <Card>
          <CardHeader>
            <CardTitle>Create a Room</CardTitle>
            <CardDescription>Start a new session and invite friends.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRoom} className="flex gap-2">
              <Input 
                placeholder="E.g., Weekend Movie Night" 
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                disabled={isCreating}
              />
              <Button type="submit" disabled={isCreating || !roomName}>
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Rooms List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Rooms</CardTitle>
            <CardDescription>Rooms you have joined previously.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {myRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rooms yet.</p>
            ) : (
              myRooms.map((room) => (
                <div key={room.id} className="flex justify-between items-center p-3 bg-secondary/50 rounded-md">
                  <span className="font-medium truncate">{room.name}</span>
                  <Button size="sm" onClick={() => router.push(`/room/${room.id}`)}>Join</Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}