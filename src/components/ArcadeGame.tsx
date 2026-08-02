import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, Play, RotateCcw } from "lucide-react";

const W = 640;
const H = 360;
const R = 18;
const BALL_R = 9;
const TARGET = 5;

type Mode = "cpu" | "local";

interface Vec { x: number; y: number }

interface GameState {
  a: Vec;
  b: Vec;
  ball: Vec;
  bv: Vec;
  scoreA: number;
  scoreB: number;
  done: boolean;
}

function initial(): GameState {
  return {
    a: { x: 90, y: H / 2 },
    b: { x: W - 90, y: H / 2 },
    ball: { x: W / 2, y: H / 2 },
    bv: { x: 3.2, y: 1.6 },
    scoreA: 0,
    scoreB: 0,
    done: false,
  };
}

/** Simple 2D head-to-head puck arena. P1: WASD, P2: arrows (or CPU). */
export function ArcadeGame({
  onFinish,
  labelA = "Ty",
  labelB = "Soupeř",
}: {
  onFinish?: (scoreA: number, scoreB: number) => void;
  labelA?: string;
  labelB?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const state = useRef<GameState>(initial());
  const raf = useRef<number | null>(null);
  const [mode, setMode] = useState<Mode>("cpu");
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState({ a: 0, b: 0 });
  const [result, setResult] = useState<null | { a: number; b: number }>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const reset = useCallback(() => {
    state.current = initial();
    setScore({ a: 0, b: 0 });
    setResult(null);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keys.current[k] = true;
        if (running) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const speed = 4.4;

    const step = () => {
      const s = state.current;
      if (!s.done) {
        // player A (WASD)
        if (keys.current["w"]) s.a.y -= speed;
        if (keys.current["s"]) s.a.y += speed;
        if (keys.current["a"]) s.a.x -= speed;
        if (keys.current["d"]) s.a.x += speed;

        if (mode === "local") {
          if (keys.current["arrowup"]) s.b.y -= speed;
          if (keys.current["arrowdown"]) s.b.y += speed;
          if (keys.current["arrowleft"]) s.b.x -= speed;
          if (keys.current["arrowright"]) s.b.x += speed;
        } else {
          const ty = s.ball.y;
          const tx = Math.max(W / 2 + 30, Math.min(W - R, s.ball.x + 40));
          s.b.y += Math.sign(ty - s.b.y) * Math.min(3.3, Math.abs(ty - s.b.y));
          s.b.x += Math.sign(tx - s.b.x) * Math.min(2.6, Math.abs(tx - s.b.x));
        }

        s.a.x = Math.max(R, Math.min(W / 2 - R, s.a.x));
        s.b.x = Math.max(W / 2 + R, Math.min(W - R, s.b.x));
        s.a.y = Math.max(R, Math.min(H - R, s.a.y));
        s.b.y = Math.max(R, Math.min(H - R, s.b.y));

        // ball
        s.ball.x += s.bv.x;
        s.ball.y += s.bv.y;
        if (s.ball.y < BALL_R || s.ball.y > H - BALL_R) {
          s.bv.y *= -1;
          s.ball.y = Math.max(BALL_R, Math.min(H - BALL_R, s.ball.y));
        }

        for (const p of [s.a, s.b]) {
          const dx = s.ball.x - p.x;
          const dy = s.ball.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < R + BALL_R && d > 0) {
            const nx = dx / d;
            const ny = dy / d;
            const sp = Math.min(9, Math.hypot(s.bv.x, s.bv.y) * 1.08 + 0.5);
            s.bv.x = nx * sp;
            s.bv.y = ny * sp;
            s.ball.x = p.x + nx * (R + BALL_R + 1);
            s.ball.y = p.y + ny * (R + BALL_R + 1);
          }
        }

        const goalTop = H / 2 - 55;
        const goalBottom = H / 2 + 55;
        const inGoal = s.ball.y > goalTop && s.ball.y < goalBottom;
        if (s.ball.x < BALL_R) {
          if (inGoal) { s.scoreB += 1; setScore({ a: s.scoreA, b: s.scoreB }); resetBall(s, 1); }
          else { s.bv.x *= -1; s.ball.x = BALL_R; }
        } else if (s.ball.x > W - BALL_R) {
          if (inGoal) { s.scoreA += 1; setScore({ a: s.scoreA, b: s.scoreB }); resetBall(s, -1); }
          else { s.bv.x *= -1; s.ball.x = W - BALL_R; }
        }

        if (s.scoreA >= TARGET || s.scoreB >= TARGET) {
          s.done = true;
          setRunning(false);
          setResult({ a: s.scoreA, b: s.scoreB });
          finishRef.current?.(s.scoreA, s.scoreB);
        }
      }

      draw(ctx, state.current, labelA, labelB);
      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [running, mode, labelA, labelB]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && !running) draw(ctx, state.current, labelA, labelB);
  }, [running, labelA, labelB]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/70 p-3 backdrop-blur sm:p-4">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/90">
          <Gamepad2 className="h-4 w-4" /> Puck Arena
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setMode("cpu"); reset(); setRunning(false); }}
            className={`rounded-md border px-2.5 py-1 text-[11px] transition ${mode === "cpu" ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/40"}`}
          >
            vs CPU
          </button>
          <button
            onClick={() => { setMode("local"); reset(); setRunning(false); }}
            className={`rounded-md border px-2.5 py-1 text-[11px] transition ${mode === "local" ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/40"}`}
          >
            1v1 (2 hráči)
          </button>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-3 items-center gap-2">
        <span className="truncate text-xs text-muted-foreground sm:text-sm">{labelA}</span>
        <span className="led-digit text-center text-2xl sm:text-3xl">{score.a} : {score.b}</span>
        <span className="truncate text-right text-xs text-muted-foreground sm:text-sm">{labelB}</span>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-xl border border-primary/25">
        <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full touch-none" />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm">
            {result && (
              <p className="text-center font-display text-2xl tracking-widest text-primary neon-text">
                {result.a > result.b ? "VÍTĚZSTVÍ!" : "PORAŽEN"} {result.a}:{result.b}
              </p>
            )}
            <button
              onClick={() => { if (result || state.current.done) reset(); setRunning(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_28px_-6px_var(--color-primary)] transition hover:scale-105"
            >
              {result ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {result ? "Hrát znovu" : "Start"}
            </button>
            <p className="px-4 text-center text-[11px] text-muted-foreground">
              WASD ovládá levý puk{mode === "local" ? " · šipky pravý puk" : " · CPU hraje pravý puk"} · první na {TARGET} branek vyhrává
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function resetBall(s: GameState, dir: number) {
  s.ball.x = W / 2;
  s.ball.y = H / 2;
  s.bv.x = 3.2 * dir;
  s.bv.y = (Math.random() - 0.5) * 3;
}

function draw(ctx: CanvasRenderingContext2D, s: GameState, labelA: string, labelB: string) {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0d0f1a");
  g.addColorStop(1, "#151a2e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,214,102,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 46, 0, Math.PI * 2);
  ctx.stroke();

  // goals
  ctx.strokeStyle = "rgba(120,255,190,0.55)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(2, H / 2 - 55);
  ctx.lineTo(2, H / 2 + 55);
  ctx.moveTo(W - 2, H / 2 - 55);
  ctx.lineTo(W - 2, H / 2 + 55);
  ctx.stroke();

  const puck = (p: Vec, color: string) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  puck(s.a, "#ffd166");
  puck(s.b, "#5ee2a0");

  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.font = "600 12px ui-sans-serif, system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(labelA, 12, 20);
  const tw = ctx.measureText(labelB).width;
  ctx.fillText(labelB, W - tw - 12, 20);
}
