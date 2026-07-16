"use client";
import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#a589fc",
  "#f7b801",
  "#20a97c",
  "#ef5350",
  "#42a5f5",
  "#ff8a65",
];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRotation: number;
  color: string;
}

/**
 * Dependency-free celebratory confetti: emits pieces from both bottom corners
 * for `duration` ms, then lets them fall out and unmounts the canvas.
 */
export default function ConfettiBurst({
  duration = 2500,
}: {
  duration?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const pieces: Piece[] = [];
    const spawn = (originX: number, direction: number) => {
      const angle = -Math.PI / 2 + direction * (0.3 + Math.random() * 0.4);
      const speed = 11 + Math.random() * 9;
      pieces.push({
        x: originX,
        y: canvas.height + 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        vRotation: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    };

    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (now - startedAt < duration && pieces.length < 400) {
        for (let i = 0; i < 4; i++) {
          spawn(0, 1);
          spawn(canvas.width, -1);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.vy += 0.25; // gravity
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRotation;
        if (p.y > canvas.height + 30 && p.vy > 0) {
          pieces.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (now - startedAt >= duration && pieces.length === 0) {
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [duration]);

  if (done) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
