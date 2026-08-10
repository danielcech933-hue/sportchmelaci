/** Animated stadium backdrop: drifting neon aurora + light beams. */
export function StadiumBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,oklch(0.24_0.05_265),transparent_70%)]" />
      <div
        className="aurora-blob absolute -left-1/4 top-[-10%] h-[70vh] w-[70vw] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-primary) 40%, transparent), transparent 70%)" }}
      />
      <div
        className="aurora-blob absolute -right-1/4 top-1/3 h-[60vh] w-[60vw] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 38%, transparent), transparent 70%)", animationDelay: "-6s" }}
      />
      <div
        className="aurora-blob absolute bottom-[-15%] left-1/4 h-[55vh] w-[55vw] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, oklch(0.6 0.2 255 / 0.45), transparent 70%)", animationDelay: "-11s" }}
      />
      <div className="spotlight-beam absolute -top-1/2 left-1/4 h-[200vh] w-[18vw] bg-gradient-to-b from-primary/12 to-transparent blur-2xl" />
      <div
        className="spotlight-beam absolute -top-1/2 right-1/4 h-[200vh] w-[14vw] bg-gradient-to-b from-accent/12 to-transparent blur-2xl"
        style={{ animationDelay: "-7s" }}
      />
      <div className="absolute inset-0 grid-bg opacity-[0.06]" />
    </div>
  );
}
