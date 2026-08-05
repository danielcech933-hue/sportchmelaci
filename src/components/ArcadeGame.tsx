import { useCallback, useEffect, useRef, useState } from "react";

interface ArcadeGameProps {
  onFinish: (scoreA: number, scoreB: number) => void;
  labelA: string;
  labelB: string;
}

const W = 640;
const H = 360;
const PAD_W = 12;
const PAD_H = 78;
const TARGET = 3;

/** 2D Puck Arena — WASD/šipky, první na 3 branky vyhrává. */
export function ArcadeGame({ onFinish, labelA, labelB }: ArcadeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [finished, setFinished] = useState(false);

  const state = useRef({
    ball: { x: W / 2, y: H / 2, vx: 4.2, vy: 2.4 },
    pa: H / 2 - PAD_H / 2,
    pb: H / 2 - PAD_H / 2,
    keys: new Set<string>(),
    score: [0, 0] as [number, number],
    over: false,
  });

  const reset = useCallback((dir: number) => {
    const s = state.current;
    s.ball = { x: W / 2, y: H / 2, vx: 4.2 * dir, vy: (Math.random() * 3 - 1.5) || 2 };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      state.current.keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "w", "s"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => state.current.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      const s = state.current;
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      if (!ctx) return;

      // input
      const speed = 6.5;
      if (s.keys.has("w") || s.keys.has("arrowup")) s.pa -= speed;
      if (s.keys.has("s") || s.keys.has("arrowdown")) s.pa += speed;
      s.pa = Math.max(0, Math.min(H - PAD_H, s.pa));

      // simple CPU
      const target = s.ball.y - PAD_H / 2;
      s.pb += Math.max(-5, Math.min(5, (target - s.pb) * 0.12));
      s.pb = Math.max(0, Math.min(H - PAD_H, s.pb));

      // ball
      const b = s.ball;
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < 6 || b.y > H - 6) b.vy *= -1;

      if (b.x < 22 + PAD_W && b.y > s.pa && b.y < s.pa + PAD_H && b.vx < 0) {
        b.vx = Math.abs(b.vx) * 1.04;
        b.vy += (b.y - (s.pa + PAD_H / 2)) * 0.06;
      }
      if (b.x > W - 22 - PAD_W && b.y > s.pb && b.y < s.pb + PAD_H && b.vx > 0) {
        b.vx = -Math.abs(b.vx) * 1.04;
        b.vy += (b.y - (s.pb + PAD_H / 2)) * 0.06;
      }

      if (b.x < 0) {
        s.score[1] += 1;
        setScore([s.score[0], s.score[1]]);
        reset(1);
      } else if (b.x > W) {
        s.score[0] += 1;
        setScore([s.score[0], s.score[1]]);
        reset(-1);
      }

      // draw
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#04140c";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(120,255,190,0.25)";
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#3ef2a1";
      ctx.fillStyle = "#3ef2a1";
      ctx.fillRect(22, s.pa, PAD_W, PAD_H);
      ctx.fillStyle = "#ffd166";
      ctx.shadowColor = "#ffd166";
      ctx.fillRect(W - 22 - PAD_W, s.pb, PAD_W, PAD_H);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (!s.over && (s.score[0] >= TARGET || s.score[1] >= TARGET)) {
        s.over = true;
        setFinished(true);
        setRunning(false);
        onFinish(s.score[0], s.score[1]);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, onFinish, reset]);

  function start() {
    const s = state.current;
    s.score = [0, 0];
    s.over = false;
    s.pa = H / 2 - PAD_H / 2;
    s.pb = H / 2 - PAD_H / 2;
    reset(1);
    setScore([0, 0]);
    setFinished(false);
    setRunning(true);
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-background/60 p-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-[0.2em] text-primary/80">{labelA}</span>
        <span className="font-display text-lg tracking-widest text-primary">
          {score[0]} : {score[1]}
        </span>
        <span className="font-mono uppercase tracking-[0.2em] text-muted-foreground">{labelB}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-xl border border-primary/20"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Ovládání: W / S nebo ↑ / ↓ · první na {TARGET} branky</p>
        <button
          onClick={start}
          disabled={running}
          className="rounded-full border border-primary/50 bg-primary/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary disabled:opacity-50"
        >
          {running ? "Hraje se…" : finished ? "Hrát znovu" : "Start"}
        </button>
      </div>
    </div>
  );
}

export default ArcadeGame;
