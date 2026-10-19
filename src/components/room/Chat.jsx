
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const classifyMessage = (text) => {
  const normalized = text.toLowerCase();

  const harmfulTerms = [
    "kill you",
    "i will hurt you",
    "i will find you",
    "i will kill",
    "death threat",
  ];

  return harmfulTerms.some((term) => normalized.includes(term))
    ? "review"
    : "visible";
};

export default function Chat({ roomId }) {
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("Harassment");
  const [safetyNotice, setSafetyNotice] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef(null);

  // Fetch chat history and subscribe to new messages
  useEffect(() => {
    if (!roomId) return;

    let active = true;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, profiles(email)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("History fetch error:", error);
        setSafetyNotice("Could not load chat history.");
        return;
      }

      setMessages(
        (data || []).filter(
          (msg) =>
            msg.moderation_status !== "review" ||
            msg.user_id === user?.id
        )
      );
    };

    fetchHistory();

    const channel = supabase
      .channel(`room_chat_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const incoming = payload.new;

          // Do not show held messages to other participants
          if (
            incoming.moderation_status === "review" &&
            incoming.user_id !== user?.id
          ) {
            return;
          }

          const { data: profileData } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", incoming.user_id)
            .maybeSingle();

          if (!active) return;

          const newMsg = {
            ...incoming,
            profiles: {
              email: profileData?.email || "User",
            },
          };

          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe((status) => {
        console.log("Chat realtime status:", status);
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id]);

  // Auto-scroll to latest visible message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send a message
  const handleSend = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !user?.id || sending) return;

    const textToSend = newMessage.trim();
    const safetyStatus = classifyMessage(textToSend);

    setSending(true);
    setNewMessage("");
    setSafetyNotice(
      safetyStatus === "review"
        ? "Your message has been held for safety review."
        : ""
    );

    const { error } = await supabase.from("messages").insert({
      room_id: roomId,
      user_id: user.id,
      content: textToSend,
      moderation_status: safetyStatus,
    });

    setSending(false);

    if (error) {
      console.error("Message failed to send:", error);
      setNewMessage(textToSend);
      setSafetyNotice("Message could not be sent. Please try again.");
      return;
    }

    if (safetyStatus === "review") {
      setSafetyNotice(
        "Your message is held for safety review and is hidden from other participants."
      );
    } else {
      setSafetyNotice("Message sent.");
    }
  };

  // Submit a report
  const handleReport = async (e) => {
    e.preventDefault();

    if (!reportTarget || !user?.id) return;

    const { error } = await supabase.from("message_reports").insert({
      room_id: roomId,
      message_id: reportTarget.id,
      reporter_id: user.id,
      reason: reportReason,
    });

    if (error) {
      console.error("Report submission failed:", error);

      setSafetyNotice(
        error.code === "23505"
          ? "You have already reported this message."
          : "Report failed. Please try again."
      );
      return;
    }

    setSafetyNotice("Report submitted. The host can review it.");
    setReportTarget(null);
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="p-4 border-b border-border font-semibold">
        Room Chat
      </div>

      {safetyNotice && (
        <p
          role="status"
          className="px-4 py-2 text-sm text-amber-700 bg-amber-50"
        >
          {safetyNotice}
        </p>
      )}

      {reportTarget && (
        <form
          onSubmit={handleReport}
          className="m-4 space-y-3 rounded-lg border p-4"
        >
          <p className="font-semibold">Report message</p>

          <p className="text-sm break-words">
            {reportTarget.content}
          </p>

          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="w-full rounded border p-2 bg-background"
          >
            <option value="Harassment">Harassment</option>
            <option value="Hate speech">Hate speech</option>
            <option value="Threats">Threats</option>
            <option value="Spam">Spam</option>
            <option value="Other">Other</option>
          </select>

          <div className="flex gap-2">
            <Button type="submit">Submit report</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportTarget(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Messages */}
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
              <div
                key={msg.id}
                className={`flex flex-col ${
                  isMe ? "items-end" : "items-start"
                }`}
              >
                <span className="text-[10px] text-muted-foreground uppercase mb-1 px-1">
                  {msg.profiles?.email?.split("@")[0] || "User"}
                </span>

                <div
                  className={`px-3 py-2 rounded-lg max-w-[85%] text-sm break-words ${
                    isMe
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {msg.content}

                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => {
                        setReportTarget(msg);
                        setReportReason("Harassment");
                      }}
                      className="ml-2 text-xs text-red-500 hover:underline"
                    >
                      Report
                    </button>
                  )}

                  {isMe && msg.moderation_status === "review" && (
                    <p className="mt-1 text-xs">
                      Held for safety review
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message input */}
      <form
        onSubmit={handleSend}
        className="p-4 border-t border-border flex gap-2"
      >
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
          disabled={sending}
        />

        <Button
          type="submit"
          disabled={!newMessage.trim() || sending}
        >
          {sending ? "Sending..." : "Send"}
        </Button>
      </form>
    </div>
  );
}
