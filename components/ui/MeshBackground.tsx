export default function MeshBackground() {
  return (
    <div className="mesh-bg" aria-hidden>
      <div className="mesh-orb w-[500px] h-[500px] bg-violet-600/30 -top-32 -left-32 animate-float-slow" />
      <div className="mesh-orb w-[400px] h-[400px] bg-fuchsia-600/25 top-1/3 -right-32 animate-float-slow" style={{ animationDelay: '-3s' }} />
      <div className="mesh-orb w-[350px] h-[350px] bg-cyan-500/20 bottom-0 left-1/4 animate-float-slow" style={{ animationDelay: '-5s' }} />
      <div className="mesh-orb w-[300px] h-[300px] bg-amber-500/15 top-1/2 left-1/2 animate-pulse-glow" />
    </div>
  );
}
