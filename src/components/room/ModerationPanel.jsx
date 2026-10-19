
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";

export default function ModerationPanel({ roomId, role }) {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [error, setError] = useState("");

  const canModerate = ["host", "owner", "moderator"].includes(role);

  const loadReports = useCallback(async () => {
    if (!canModerate || !roomId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("message_reports")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;

      const messageIds = [...new Set((data || []).map(r => r.message_id))];
      let messages = [];

      if (messageIds.length) {
        const { data: messageData, error: messageError } = await supabase
          .from("messages")
          .select("*")
          .in("id", messageIds);

        if (messageError) throw messageError;
        messages = messageData || [];
      }

      setReports((data || []).map(report => ({
        ...report,
        message: messages.find(m => String(m.id) === String(report.message_id)),
      })));
    } catch (err) {
      setError(err.message || "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, [canModerate, roomId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const takeAction = async (report, action) => {
    if (!user?.id || !canModerate) return;

    setWorkingId(report.id);
    setError("");

    try {
      if (action === "hide") {
        const { error: updateError } = await supabase
          .from("messages")
          .update({ moderation_status: "hidden" })
          .eq("id", report.message_id)
          .eq("room_id", roomId);

        if (updateError) throw updateError;
      }

      // Record the moderator decision before refreshing the panel.
      const { error: auditError } = await supabase
        .from("moderation_actions")
        .insert({
          room_id: roomId,
          message_id: report.message_id,
          moderator_id: user.id,
          action,
        });

      if (auditError) throw auditError;

      // Dismiss this report from the review queue.
      // This assumes message_reports has a status column.
      const { error: reportError } = await supabase
        .from("message_reports")
        .update({ status: "resolved" })
        .eq("id", report.id)
        .eq("room_id", roomId);

      if (reportError) throw reportError;

      await loadReports();
    } catch (err) {
      setError(err.message || "Action failed. Please try again.");
    } finally {
      setWorkingId(null);
    }
  };

  if (!canModerate) return null;

  return (
    <section className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Safety Center</h2>
        <Button size="sm" variant="outline" onClick={loadReports}>
          Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Review reported messages and choose an action.
      </p>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm">Loading reports...</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reports found.
        </p>
      ) : (
        reports.map(report => (
          <article
            key={report.id}
            className="space-y-3 rounded-lg border border-border p-3"
          >
            <div className="text-xs text-muted-foreground">
              Reason: {report.reason}
            </div>

            <div className="rounded-md bg-secondary/40 p-3 text-sm">
              {report.message?.content ??
                report.message?.message ??
                "Message unavailable or already deleted."}
            </div>

            <p className="text-xs text-muted-foreground">
              Reported: {report.created_at
                ? new Date(report.created_at).toLocaleString()
                : "Time unavailable"}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={workingId === report.id}
                onClick={() => takeAction(report, "hide")}
              >
                Hide message
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={workingId === report.id}
                onClick={() => takeAction(report, "dismiss")}
              >
                Dismiss report
              </Button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
