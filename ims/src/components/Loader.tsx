"use client";

export default function Loader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1b2a]">
      <h1 className="text-2xl font-bold tracking-[0.35em] text-white md:text-3xl">
        JAI ROOP TEXTILES
      </h1>

      <p className="mt-2 text-xs font-medium tracking-[0.3em] text-[#c9a84c]">
        IMS TRACKING SYSTEM V7
      </p>

      <div className="mt-10 h-1 w-56 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#e2c97e]"
          style={{
            transformOrigin: "left",
            animation: "ims-loader-bar 2s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes ims-loader-bar {
          0%   { transform: scaleX(0); }
          50%  { transform: scaleX(0.7); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
