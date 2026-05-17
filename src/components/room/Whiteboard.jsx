"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const COLORS = ["#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#eab308"];

export default function Whiteboard({ roomId }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentPos = useRef({ x: 0, y: 0 });
  const [color, setColor] = useState(COLORS[0]);

  // FIX 1: Standard function syntax allows hoisting so useEffect can safely use it anywhere
  function drawLine(x0, y0, x1, y1, strokeColor, emit) {
    if (!canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = strokeColor;
    context.lineWidth = 4;
    context.lineCap = "round";
    context.stroke();
    context.closePath();

    if (!emit) return;

    // Broadcast the line coordinates to the room
    supabase.channel(`board_sync_${roomId}`).send({
      type: "broadcast",
      event: "draw",
      payload: { x0, y0, x1, y1, color: strokeColor },
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      context.fillStyle = "#1e293b"; 
      context.fillRect(0, 0, canvas.width, canvas.height);
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Setup Realtime Subscription
    const channel = supabase
      .channel(`board_sync_${roomId}`)
      .on("broadcast", { event: "draw" }, ({ payload }) => {
        drawLine(
          payload.x0, payload.y0, 
          payload.x1, payload.y1, 
          payload.color,
          false
        );
      })
      .on("broadcast", { event: "clear" }, () => {
        context.fillStyle = "#1e293b";
        context.fillRect(0, 0, canvas.width, canvas.height);
      })
      .subscribe();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      supabase.removeChannel(channel);
    };
    // FIX 2: Added drawLine to dependencies safely now that its structural behavior is static
  }, [roomId, drawLine]);

  // Mouse Event Handlers
  const onMouseDown = (e) => {
    if (!canvasRef.current) return;
    isDrawing.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    currentPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const onMouseMove = (e) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    drawLine(currentPos.current.x, currentPos.current.y, x, y, color, true);
    currentPos.current = { x, y };
  };

  const onMouseUp = () => {
    isDrawing.current = false;
  };

  const handleClear = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.fillStyle = "#1e293b";
    context.fillRect(0, 0, canvas.width, canvas.height);

    supabase.channel(`board_sync_${roomId}`).send({
      type: "broadcast",
      event: "clear",
    });
  };

  return (
    <div className="flex flex-col w-full h-full bg-secondary/20 rounded-xl border border-border overflow-hidden">
      {/* Toolbelt */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card">
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${
                color === c ? "border-primary scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              title="Pick color"
            />
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleClear}>
          Clear Board
        </Button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative cursor-crosshair min-h-[300px]">
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseOut={onMouseUp}
          className="absolute inset-0 block w-full h-full"
        />
      </div>
    </div>
  );
}