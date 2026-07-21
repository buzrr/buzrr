"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight "bubble burst" mini-game shown while a player waits for the host
 * to start the quiz. Purely for passing time — no scoring is persisted.
 *
 * Bubbles drift up from the bottom; tap/click to pop them. Popping shatters the
 * soap film into scattering droplets plus an expanding shockwave ring. Colours
 * come from the app's purple palette so it blends with the rest of the UI.
 *
 * Everything renders on a single <canvas> — there are no per-bubble DOM nodes.
 * Bubbles, droplets and rings are removed the instant they die or leave the
 * canvas bounds, so nothing accumulates off-screen.
 */

// App purple palette (see globals.css --color-lprimary / --color-dprimary).
const BUBBLE_COLORS = [
  "#7d49f8", // lprimary
  "#a589fc", // dprimary
  "#c4b5fd",
  "#9d7bfd",
  "#b8a4fc",
];

interface Bubble {
  x: number; // centre x in px
  y: number; // centre y in px
  r: number; // radius in px
  speed: number; // px per second, upward
  drift: number; // horizontal wobble amplitude
  phase: number; // wobble phase
  color: string;
}

/** A soap droplet flung out when a bubble bursts. */
interface Droplet {
  x: number;
  y: number;
  vx: number; // px/s
  vy: number; // px/s
  r: number;
  life: number; // remaining seconds
  maxLife: number;
  color: string;
}

/** The expanding shockwave outline left by a burst. */
interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

const GRAVITY = 520; // px/s² pulling droplets down
const MAX_BUBBLES = 18;

const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const dropletsRef = useRef<Droplet[]>([]);
  const ringsRef = useRef<Ring[]>([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);
  const lastSpawnRef = useRef(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);

  const spawnBubble = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    const r = 16 + Math.random() * 24;
    bubblesRef.current.push({
      x: r + Math.random() * (w - r * 2),
      y: h + r,
      r,
      speed: 30 + Math.random() * 45,
      drift: 8 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
      color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
    });
  }, []);

  /** Turn a bubble into droplets + a shockwave ring, then discard the bubble. */
  const burst = useCallback(
    (cx: number, cy: number, r: number, color: string) => {
      const count = Math.round(8 + r / 5); // bigger bubbles shatter into more
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 90 + Math.random() * 140;
        dropletsRef.current.push({
          x: cx + Math.cos(a) * r * 0.7,
          y: cy + Math.sin(a) * r * 0.7,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 40, // slight upward bias before gravity
          r: 1.5 + Math.random() * (r * 0.14),
          life: 0.5 + Math.random() * 0.35,
          maxLife: 0.85,
          color,
        });
      }
      ringsRef.current.push({
        x: cx,
        y: cy,
        r: r * 0.6,
        maxR: r * 1.9,
        life: 0.32,
        maxLife: 0.32,
        color,
      });
    },
    [],
  );

  // Main animation loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.max(1, window.devicePixelRatio || 1);
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = sizeRef.current;

      // Spawn on an interval, capped so the screen never gets crowded.
      if (
        now - lastSpawnRef.current > 650 &&
        bubblesRef.current.length < MAX_BUBBLES
      ) {
        lastSpawnRef.current = now;
        spawnBubble();
      }

      // --- Update bubbles (rise + wobble, cull once past the top). ---
      const bubbles: Bubble[] = [];
      for (const b of bubblesRef.current) {
        b.y -= b.speed * dt;
        b.phase += dt * 2;
        if (b.y + b.r > -20) bubbles.push(b);
      }
      bubblesRef.current = bubbles;

      // --- Update droplets (ballistic + gravity, cull when dead/off-canvas). ---
      const droplets: Droplet[] = [];
      for (const d of dropletsRef.current) {
        d.life -= dt;
        d.vy += GRAVITY * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        const onScreen = d.x > -20 && d.x < w + 20 && d.y > -20 && d.y < h + 20;
        if (d.life > 0 && onScreen) droplets.push(d);
      }
      dropletsRef.current = droplets;

      // --- Update rings (expand + fade). ---
      const rings: Ring[] = [];
      for (const rg of ringsRef.current) {
        rg.life -= dt;
        rg.r += ((rg.maxR - rg.r) / rg.maxLife) * dt;
        if (rg.life > 0) rings.push(rg);
      }
      ringsRef.current = rings;

      // --- Draw. ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Rings first (behind droplets).
      for (const rg of rings) {
        const t = rg.life / rg.maxLife; // 1 → 0
        ctx.globalAlpha = t * 0.5;
        ctx.lineWidth = Math.max(1, 3 * t);
        ctx.strokeStyle = rg.color;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bubbles.
      for (const b of bubblesRef.current) {
        const wobbleX = b.x + Math.sin(b.phase) * b.drift;
        ctx.globalAlpha = 0.85;
        const grad = ctx.createRadialGradient(
          wobbleX - b.r * 0.3,
          b.y - b.r * 0.3,
          b.r * 0.1,
          wobbleX,
          b.y,
          b.r,
        );
        grad.addColorStop(0, "rgba(255,255,255,0.55)");
        grad.addColorStop(0.35, b.color);
        grad.addColorStop(1, b.color);

        ctx.beginPath();
        ctx.arc(wobbleX, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Glossy highlight.
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(
          wobbleX - b.r * 0.32,
          b.y - b.r * 0.32,
          b.r * 0.18,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
      }

      // Droplets.
      for (const d of droplets) {
        ctx.globalAlpha = Math.min(1, d.life / d.maxLife) * 0.9;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [spawnBubble, burst]);

  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      // Topmost (most recently spawned) bubble under the pointer wins.
      for (let i = bubblesRef.current.length - 1; i >= 0; i--) {
        const b = bubblesRef.current[i];
        const wobbleX = b.x + Math.sin(b.phase) * b.drift;
        const dx = px - wobbleX;
        const dy = py - b.y;
        if (dx * dx + dy * dy <= b.r * b.r) {
          burst(wobbleX, b.y, b.r, b.color);
          bubblesRef.current.splice(i, 1);
          scoreRef.current += 1;
          setScore(scoreRef.current);
          break;
        }
      }
    },
    [burst],
  );

  return (
    <div
      ref={wrapRef}
      onPointerDown={handlePointer}
      className="relative h-full w-full overflow-hidden rounded-xl bg-off-white dark:bg-off-dark select-none touch-none cursor-pointer"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/70 dark:bg-dark/70 px-3 py-1 text-sm font-bold text-lprimary dark:text-dprimary backdrop-blur">
        <span aria-hidden>🫧</span>
        {score}
      </div>

      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-dark/50 dark:text-white/40">
        Pop the bubbles while you wait…
      </p>
    </div>
  );
};

export default Game;
