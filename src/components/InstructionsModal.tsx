/**
 * Sleek, neon-pop Instructions overlay modal.
 */
import { X, Sparkles, AlertCircle, Camera, CheckSquare } from "lucide-react";

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InstructionsModal({ isOpen, onClose }: InstructionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm animate-fade-in font-sans">
      <div 
        id="instructions-dialog"
        className="relative w-full max-w-2xl bg-black border-4 border-neon-cyan shadow-[8px_8px_0_#00FFFF] text-white overflow-hidden"
      >
        {/* Banner */}
        <div className="bg-black p-6 flex items-center justify-between border-b-4 border-neon-cyan">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-neon-yellow animate-bounce" />
            <h2 className="font-anton text-2xl tracking-wider text-white uppercase leading-none">
              WRECKING DUG RULES!
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 border-2 border-neutral-800 hover:border-neon-pink hover:text-neon-pink transition-all text-white cursor-pointer"
            aria-label="Close rules"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto font-mono">
          <p className="text-neutral-300 leading-relaxed text-xs sm:text-sm">
            Welcome to <span className="text-neon-pink font-bold uppercase">Wrecking Dug</span>, a pixel-glam 2D arcade adventure. Help pop-rebel Miley dig deep candy tunnels, dodge photoflashes, and drop massive disco balls on target critics!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="p-4 bg-neutral-950 border-2 border-neutral-800 space-y-3">
              <h3 className="font-anton text-neon-cyan text-sm uppercase tracking-wider flex items-center gap-1.5 border-b-2 border-neutral-800 pb-2">
                <span>🎮</span> Controls
              </h3>
              <ul className="space-y-3 text-xs">
                <li className="flex items-center justify-between">
                  <span className="text-neutral-400 font-medium font-sans">Move & Dig:</span>
                  <div className="flex gap-1.5 font-mono">
                    <kbd className="px-2 py-1 bg-black border border-neutral-700 text-[10px] text-neon-yellow font-extrabold font-sans">▲▼◀▶</kbd>
                    <span className="text-neutral-400 font-sans">or</span>
                    <kbd className="px-2 py-1 bg-black border border-neutral-700 text-[10px] text-neon-yellow font-extrabold font-sans">WASD</kbd>
                  </div>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-neutral-400 font-medium font-sans">Glitter Pump:</span>
                  <div className="font-mono">
                    <kbd className="px-3 py-1 bg-black border border-neutral-700 text-[10px] text-neon-pink font-extrabold font-sans uppercase">Spacebar</kbd>
                  </div>
                </li>
              </ul>
              <p className="text-[10px] text-neutral-500 font-sans leading-normal">
                Note: Digging happens automatically as you tunnel into Pink Candy Dirt and Purple Glitter-Dirt.
              </p>
            </div>

            {/* Mechanics */}
            <div className="p-4 bg-neutral-950 border-2 border-neutral-800 space-y-3">
              <h3 className="font-anton text-neon-pink text-sm uppercase tracking-wider flex items-center gap-1.5 border-b-2 border-neutral-800 pb-2">
                <span>🎈</span> How to Defeat Critics
              </h3>
              <ul className="space-y-2 text-xs text-neutral-300 list-disc list-inside leading-relaxed font-sans">
                <li>
                  Shoot your <strong className="text-neon-pink font-mono uppercase text-xs">Glitter-pump</strong> anchor with <span className="text-neon-yellow font-mono font-bold">SPACEBAR</span>.
                </li>
                <li>
                  Maintain connection and <strong className="text-neon-cyan">TAP Spacebar repeatedly</strong> to inflate enemies with bubblegum until they <strong className="text-neon-pink font-mono uppercase text-sm">POP!</strong>
                </li>
                <li>
                  If you stop pumping, they slowly deflate and will start chasing you again!
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-anton text-neon-yellow text-sm uppercase tracking-wider pb-1 border-b-2 border-neutral-800">
              🌟 Retro Pop Score Multipliers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
              {/* Item 1 */}
              <div className="flex items-center gap-3 p-3 bg-neutral-950 border border-neutral-800">
                <div className="w-8 h-8 rounded-full bg-neon-pink flex items-center justify-center text-lg">🌸</div>
                <div>
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wide">Flowers</div>
                  <div className="text-xs font-mono text-neon-pink font-extrabold">+200 PTS</div>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-center gap-3 p-3 bg-neutral-950 border border-neutral-800">
                <div className="w-8 h-8 rounded-full bg-neon-yellow flex items-center justify-center text-lg text-black">💿</div>
                <div>
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wide">Gold Records</div>
                  <div className="text-xs font-mono text-neon-yellow font-extrabold">+500 PTS</div>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-center gap-3 p-3 bg-neutral-950 border border-neutral-800">
                <div className="w-8 h-8 rounded-full bg-neon-cyan flex items-center justify-center text-lg text-black">🪩</div>
                <div>
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wide">Disco Drop</div>
                  <div className="text-xs font-mono text-neon-cyan font-extrabold">+1000 PTS</div>
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="p-4 bg-black border-2 border-neon-pink flex gap-3 text-xs text-neon-pink select-none font-sans">
            <AlertCircle className="w-5 h-5 shrink-0 text-neon-pink" />
            <div className="leading-relaxed">
              <strong className="font-bold font-mono uppercase tracking-widest block mb-0.5 text-white animate-pulse">⚠️ Beware of Cascading Crushes!</strong>
              Dug out the block directly underneath big glittering Disco Balls to bring them down. They fall on enemies, but can also crush Miley! Run out of the column immediately before it drops.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-neutral-950 p-4 flex justify-end gap-3 border-t-4 border-neutral-900">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 bg-neon-pink text-black font-anton tracking-widest text-sm border-2 border-white shadow-[4px_4px_0_#00FFFF] hover:shadow-[2px_2px_0_#00FFFF] hover:translate-x-1 hover:translate-y-1 transition-all text-center uppercase font-bold cursor-pointer hover:bg-neon-yellow"
          >
            LET'S SHAKE IT UP!
          </button>
        </div>
      </div>
    </div>
  );
}
