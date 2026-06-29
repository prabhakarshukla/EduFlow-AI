"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { captureEvent } from "@/lib/posthog/helpers";
import { EVENTS } from "@/lib/posthog/events";

export default function StudyRoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data } = await supabase
        .from("room_members")
        .select("room_id, study_rooms(id, name, is_active, created_at)")
        .eq("user_id", user.user.id)
        .order("joined_at", { ascending: false });
      
      if (data) {
        setRooms(data.map((r: any) => r.study_rooms).filter(Boolean));
      }
      setLoading(false);
    };
    fetchRooms();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setIsCreating(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data, error } = await supabase
      .from("study_rooms")
      .insert({ name: newRoomName, created_by: user.user.id })
      .select()
      .single();

    if (data) {
      captureEvent(EVENTS.STUDY_ROOM_CREATED);
      router.push(`/dashboard/study-rooms/${data.id}`);
    }
    setIsCreating(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    
    // Check if room exists
    const { data, error } = await supabase
      .from("study_rooms")
      .select("id")
      .eq("id", joinCode)
      .single();
      
    if (data) {
      // Add member if not already
      await supabase.from("room_members").upsert({
        room_id: data.id,
        user_id: user.user.id
      }, { onConflict: "room_id, user_id" });
      captureEvent(EVENTS.STUDY_ROOM_JOINED);
      router.push(`/dashboard/study-rooms/${data.id}`);
    } else {
      alert("Room not found");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-[var(--ui-text)]">Study Rooms</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl" style={{ background: "var(--ui-surface)", border: "1px solid var(--ui-border)" }}>
          <h2 className="text-lg font-semibold mb-4 text-[var(--ui-text)]">Create Room</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <input 
              type="text" 
              placeholder="Room Name" 
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg outline-none"
              style={{ background: "var(--ui-bg)", border: "1px solid var(--ui-border)", color: "var(--ui-text)" }}
            />
            <button 
              disabled={isCreating || !newRoomName.trim()}
              className="w-full py-2 rounded-lg font-medium transition-all duration-150"
              style={{ background: "linear-gradient(135deg,#6EE7D8,#14B8A6)", color: "#0d2420", opacity: isCreating || !newRoomName.trim() ? 0.5 : 1 }}
            >
              {isCreating ? "Creating..." : "Create Room"}
            </button>
          </form>
        </div>

        <div className="p-6 rounded-xl" style={{ background: "var(--ui-surface)", border: "1px solid var(--ui-border)" }}>
          <h2 className="text-lg font-semibold mb-4 text-[var(--ui-text)]">Join Room</h2>
          <form onSubmit={handleJoin} className="space-y-4">
            <input 
              type="text" 
              placeholder="Room ID" 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full px-4 py-2 rounded-lg outline-none"
              style={{ background: "var(--ui-bg)", border: "1px solid var(--ui-border)", color: "var(--ui-text)" }}
            />
            <button 
              disabled={!joinCode.trim()}
              className="w-full py-2 rounded-lg font-medium transition-all duration-150"
              style={{ background: "var(--ui-bg)", border: "1px solid #14b8a6", color: "#14b8a6", opacity: !joinCode.trim() ? 0.5 : 1 }}
            >
              Join Room
            </button>
          </form>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 text-[var(--ui-text)]">Your Recent Rooms</h2>
        {loading ? (
          <p className="text-[var(--ui-muted)]">Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <p className="text-[var(--ui-muted)]">No recent rooms found.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {rooms.map(room => (
              <div key={room.id} className="p-4 rounded-xl flex items-center justify-between transition-all duration-150" style={{ background: "var(--ui-surface)", border: "1px solid var(--ui-border)" }}>
                <div>
                  <h3 className="font-medium text-[var(--ui-text)]">{room.name}</h3>
                  <p className="text-xs text-[var(--ui-muted)] select-all truncate max-w-[200px]">ID: {room.id}</p>
                </div>
                <button 
                  onClick={() => router.push(`/dashboard/study-rooms/${room.id}`)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150"
                  style={{ background: "rgba(20,184,166,0.1)", color: "#14b8a6" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(20,184,166,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(20,184,166,0.1)";
                  }}
                >
                  Enter
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
