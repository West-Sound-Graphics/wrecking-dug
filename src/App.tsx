import React, { useState, useEffect, useRef, FormEvent } from "react";
import { GameCanvas, GameCanvasHandle } from "./components/GameCanvas";
import InstructionsModal from "./components/InstructionsModal";
import { gameAudio } from "./lib/audio";
import { LeaderboardEntry } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Gamepad, 
  Trophy, 
  Play, 
  Info, 
  RotateCcw, 
  Calendar, 
  User, 
  Trash2,
  Tv
} from "lucide-react";

export default function App() {
  const [gameState, setGameState] = useState<"welcome" | "playing" | "game_over">("welcome");
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(12500); // Default seed
  const [lives, setLives] = useState<number>(3);
  const [level, setLevel] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentPlayerName, setCurrentPlayerName] = useState<string>("BANGERZ");
  const [isNewHighScorePending, setIsNewHighScorePending] = useState<boolean>(false);

  const canvasRef = useRef<GameCanvasHandle | null>(null);

  // 1. Initialize Leaderboards and High Scores
  useEffect(() => {
    const savedLeaderboard = localStorage.getItem("wrecking_dug_leaderboard_v1");
    if (savedLeaderboard) {
      const parsed = JSON.parse(savedLeaderboard) as LeaderboardEntry[];
      setLeaderboard(parsed);
      if (parsed.length > 0) {
        setHighScore(parsed[0].score);
      }
    } else {
      // Seed Miley Cyrus themed leaderboard
      const defaultData: LeaderboardEntry[] = [
        { name: "Miley C.", score: 18500, date: "2026-05-21", levelReached: 5 },
        { name: "Hannah M.", score: 12500, date: "2026-05-20", levelReached: 4 },
        { name: "Smiler92", score: 8200, date: "2026-05-19", levelReached: 3 },
        { name: "Flowers", score: 4500, date: "2026-05-18", levelReached: 2 },
        { name: "WreckingB", score: 1800, date: "2026-05-17", levelReached: 1 },
      ];
      localStorage.setItem("wrecking_dug_leaderboard_v1", JSON.stringify(defaultData));
      setLeaderboard(defaultData);
      setHighScore(18500);
    }

    // Auto open rules on very first load
    const firstLoad = !localStorage.getItem("wrecking_dug_loaded");
    if (firstLoad) {
      setIsRulesOpen(true);
      localStorage.setItem("wrecking_dug_loaded", "true");
    }
  }, []);

  const clearLeaderboard = () => {
    const defaultData: LeaderboardEntry[] = [
      { name: "Miley C.", score: 18500, date: "2026-05-21", levelReached: 5 },
    ];
    localStorage.setItem("wrecking_dug_leaderboard_v1", JSON.stringify(defaultData));
    setLeaderboard(defaultData);
    setHighScore(18500);
  };

  /**
   * Play state transition managers
   */
  const handleStartPlay = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setIsNewHighScorePending(false);
    setGameState("playing");

    // Initiate back synth loops
    setTimeout(() => {
      gameAudio.startMusic();
    }, 150);
  };

  const handleGameOver = () => {
    setGameState("game_over");
    gameAudio.stopMusic();

    // Check if score warrants a leaderboard placement
    const canRegister = leaderboard.length < 5 || score > leaderboard[leaderboard.length - 1].score;
    if (canRegister && score > 0) {
      setIsNewHighScorePending(true);
    }
  };

  const handleNextLevel = () => {
    setLevel((prev) => prev + 1);
    // Extra live as milestone pop level rewards!
    setLives((prev) => Math.min(prev + 1, 5));
  };

  const toggleSound = () => {
    const muted = gameAudio.toggleMute();
    setIsMuted(muted);
  };

  const handleRegisterHighScore = (e: FormEvent) => {
    e.preventDefault();
    if (!currentPlayerName.trim()) return;

    const newEntry: LeaderboardEntry = {
      name: currentPlayerName.substring(0, 10).toUpperCase(),
      score: score,
      date: new Date().toISOString().split("T")[0],
      levelReached: level,
    };

    const updated = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Keep top 10

    localStorage.setItem("wrecking_dug_leaderboard_v1", JSON.stringify(updated));
    setLeaderboard(updated);
    if (updated.length > 0) {
      setHighScore(updated[0].score);
    }
    setIsNewHighScorePending(false);
  };

  return (
    <div className="min-h-screen bg-[#080708] text-white flex flex-col justify-between selection:bg-neon-pink selection:text-black relative overflow-x-hidden antialiased font-sans">
      {/* Background Geometric Grid Overlay with subtle neon line art */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#00FFFF_1px,transparent_1px),linear-gradient(to_bottom,#00FFFF_1px,transparent_1px)] bg-[size:30px_30px]" 
        style={{ maskImage: "radial-gradient(ellipse at center, black, transparent)" }}
      />
      <div className="absolute top-10 right-10 w-80 h-80 bg-neon-pink/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-neon-cyan/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Navigation Bar */}
      <header className="border-b-[6px] border-neon-pink bg-black py-5 sticky top-0 z-40 shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl animate-bounce">🪩</span>
            <div>
              <h1 className="font-anton text-3xl sm:text-4xl tracking-[0.12em] text-white hover:text-neon-cyan transition-colors duration-200 uppercase leading-none select-none">
                WRECKING DUG
              </h1>
              <p className="font-mono text-[9px] text-neon-pink font-bold uppercase tracking-[0.25em] mt-1 hidden sm:block">
                ★ GLITTER-DUG POP ARCADE ADVENTURE ★
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              id="rules-nav-btn"
              onClick={() => setIsRulesOpen(true)}
              className="px-4 py-2 bg-black border-2 border-neon-cyan hover:bg-neon-cyan hover:text-black text-neon-cyan font-mono font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Info className="w-4 h-4" />
              <span>RULES</span>
            </button>

            <button
              id="mute-sound-btn"
              onClick={toggleSound}
              className={`p-2 border-2 transition-all cursor-pointer ${
                isMuted
                  ? "bg-black border-red-500 text-red-500 hover:bg-red-500 hover:text-black"
                  : "bg-black border-neon-pink hover:bg-neon-pink hover:text-black text-neon-pink"
              }`}
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Elements */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <AnimatePresence mode="wait">
              {/* STATE A: WELCOME START SCREEN */}
          {gameState === "welcome" && (
            <motion.div
              key="welcome-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch font-sans"
            >
              {/* Left Column: Visual branding & button */}
              <div className="md:col-span-7 flex flex-col justify-center space-y-6 text-center md:text-left self-center border-4 border-black bg-black p-6 md:p-8 relative min-h-[440px] shadow-[8px_8px_0_rgba(0,255,255,0.15)] select-none">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-pink via-neon-yellow to-neon-cyan" />
                
                <div className="inline-flex self-center md:self-start items-center gap-1.5 px-3 py-1 bg-neon-pink/10 border-2 border-neon-pink text-neon-pink font-mono text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ARCADE CHROME EDITION</span>
                </div>

                <h1 className="font-anton text-5xl sm:text-7xl font-normal tracking-wide leading-none text-white uppercase">
                  IT'S OUR GRID <br />
                  <span className="text-neon-cyan drop-shadow-[0_4px_0_#FF007F] block">
                    WE CAN DIG IT!
                  </span>
                </h1>

                <p className="font-mono text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-lg">
                  Grab your golden microphone drill, ride high on your chrome wrecking ball, and tunnel deep through high-fashion soils. Shatter paparazzi glass, smash foam hands, burst bubblegum nodes, and dodge massive glitter disco crushes!
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-2">
                  <button
                    id="play-game-btn"
                    onClick={handleStartPlay}
                    className="px-8 py-4 bg-neon-pink text-black font-anton tracking-widest text-lg border-4 border-white shadow-[6px_6px_0_#00FFFF] hover:shadow-[2px_2px_0_#00FFFF] hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-black text-black" />
                    <span>PLAY GAME</span>
                  </button>

                  <button
                    id="play-rules-btn"
                    onClick={() => setIsRulesOpen(true)}
                    className="px-6 py-4 bg-black border-4 border-neon-yellow text-neon-yellow font-anton tracking-widest text-base hover:bg-neon-yellow hover:text-black transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Info className="w-5 h-5" />
                    <span>VIEW RULES</span>
                  </button>
                </div>

                {/* Cyber Console Cheats */}
                <div className="p-4 bg-zinc-950 border-2 border-neutral-800 space-y-2 text-xs text-neutral-400 max-w-lg font-mono">
                  <div className="flex items-center gap-1.5 text-neon-cyan font-bold border-b-2 border-neutral-800 pb-1.5 uppercase tracking-wide">
                    <Gamepad className="w-4 h-4" />
                    <span>COSMIC ARCADE SPECS:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-neon-pink font-bold">👉 DIG:</span>
                    <span>Use <kbd className="bg-neutral-900 border border-neutral-700 px-1 py-0.5 text-neon-yellow font-extrabold rounded">WASD</kbd> or <kbd className="bg-neutral-900 border border-neutral-700 px-1 py-0.5 text-neon-yellow font-extrabold rounded">Arrow Keys</kbd></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-neon-pink font-bold">👉 PUMP:</span>
                    <span>Press <kbd className="bg-neutral-900 border border-neutral-700 px-1 py-0.5 text-neon-pink font-extrabold rounded">SPACEBAR</kbd> repeatedly to burst targets</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Leaderboard High Scores */}
              <div className="md:col-span-5 flex flex-col justify-between border-4 border-neon-pink bg-black p-6 relative shadow-[8px_8px_0_#FF007F] select-none min-h-[440px]">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-3">
                    <h3 className="font-anton text-lg text-white tracking-widest flex items-center gap-2 uppercase">
                      <Trophy className="w-5 h-5 text-neon-yellow fill-neon-yellow" />
                      <span>HALL OF BANGERS</span>
                    </h3>
                    <button
                      onClick={clearLeaderboard}
                      className="p-1.5 text-neutral-500 hover:text-red-500 hover:border-red-500 hover:bg-neutral-900 border border-transparent transition-all cursor-pointer"
                      title="Reset high scores"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {leaderboard.length === 0 ? (
                      <div className="text-neutral-500 italic text-xs py-8 text-center font-mono uppercase tracking-wider">
                        No high scores registered!
                      </div>
                    ) : (
                      leaderboard.slice(0, 5).map((entry, index) => (
                        <div
                          key={`leader-${index}`}
                          className={`flex items-center justify-between p-3 border-2 text-xs font-mono transition-colors ${
                            index === 0
                              ? "bg-neutral-900 border-neon-yellow text-neon-yellow font-black shadow-[3px_3px_0_#FFFF00]"
                              : "bg-neutral-950/70 border-neutral-800 text-neutral-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-black border ${
                              index === 0 
                                ? "bg-neon-yellow text-black border-black" 
                                : "bg-neutral-800 text-neutral-400 border-neutral-700"
                            }`}>
                              {index + 1}
                            </span>
                            <span className="tracking-wider">{entry.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] text-neutral-500 font-bold">L{entry.levelReached}</span>
                            <span className="font-bold text-white tracking-wide">{entry.score.toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-neutral-950 border-2 border-neutral-800 text-center">
                  <p className="text-[9px] text-neutral-500 uppercase font-bold tracking-[0.2em] mb-1">
                    PERSONAL RETRO RECORD
                  </p>
                  <p className="text-2xl font-anton text-neon-cyan tracking-widest leading-none">
                    {highScore.toLocaleString()} PTS
                  </p>
                </div>
              </div>

            </motion.div>
          )}

          {/* STATE B: ACTIVE GAMING HUD AND CANVAS LAYOUT */}
          {gameState === "playing" && (
            <motion.div
              key="playing-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col md:flex-row gap-6 items-stretch justify-center xl:gap-8 font-mono"
            >
              {/* Left sidebar widgets (Scores and Stats) */}
              <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-5 justify-between md:justify-start">
                
                {/* Visual HUD Card 1: Scores */}
                <div className="flex-1 bg-black border-4 border-neon-cyan p-4 shadow-[4px_4px_0_#00FFFF] select-none">
                  <div className="text-[10px] uppercase font-bold text-neon-cyan tracking-[0.15em] mb-1 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-neon-cyan" />
                    <span>SCORE</span>
                  </div>
                  <div className="text-3xl font-anton text-neon-pink tracking-wider leading-none">
                    {score.toLocaleString()}
                  </div>

                  <div className="mt-4 pt-4 border-t-2 border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                    <span>HI-SCORE:</span>
                    <span className="font-bold text-neon-yellow">{Math.max(highScore, score).toLocaleString()}</span>
                  </div>
                </div>

                {/* Visual HUD Card 2: Status & Levels */}
                <div className="flex-1 bg-black border-4 border-neon-cyan p-4 shadow-[4px_4px_0_#00FFFF] select-none flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-neon-cyan tracking-[0.15em]">
                        LEVEL
                      </div>
                      <div className="text-3xl font-anton text-neon-yellow leading-none mt-1">
                        {level}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-neon-cyan tracking-[0.15em]">
                        LIVES
                      </div>
                      
                      {/* Space buns icons for lives */}
                      <div className="flex gap-1 justify-end mt-2" id="lives-list">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={`bun-${i}`}
                            className={`text-sm transition-all duration-300 ${
                              i < lives ? "scale-100 opacity-100 filter-none animate-pulse text-neon-pink" : "scale-75 opacity-10 filter grayscale"
                            }`}
                          >
                            ⭐
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Progressive Candy Progress Meter */}
                  <div className="mt-4 pt-3 border-t-2 border-neutral-800">
                    <div className="flex justify-between text-[9px] text-neutral-400 font-bold uppercase mb-1.5">
                      <span>ENERGY</span>
                      <span className="text-neon-pink">FAST SPEED</span>
                    </div>
                    <div className="w-full bg-neutral-950 border-2 border-neutral-800 h-3 rounded-none overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-neon-pink to-neon-cyan h-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, level * 15 + 25)}%` }}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* GAME VIEWPORT */}
              <div className="flex-grow flex items-center justify-center border-[6px] border-neon-pink bg-black p-1 shadow-[10px_10px_0_#FF007F] select-none">
                <GameCanvas
                  ref={canvasRef}
                  level={level}
                  onScoreUpdate={setScore}
                  onLivesUpdate={setLives}
                  onGameOver={handleGameOver}
                  onLevelComplete={handleNextLevel}
                  isPaused={isRulesOpen}
                />
              </div>

              {/* Right sidebar widgets (Reminders & Buttons) */}
              <div className="w-full md:w-56 shrink-0 flex flex-col gap-4 justify-between">
                <div className="bg-black border-4 border-neon-yellow p-4 space-y-3 shadow-[4px_4px_0_#FFFF00] select-none">
                  <h4 className="text-[10px] text-neon-yellow font-bold uppercase tracking-[0.15em] border-b-2 border-neutral-800 pb-1.5 flex items-center gap-1.5">
                    <Tv className="w-4 h-4 text-neon-yellow" />
                    <span>RETRO ARCADE SPECS:</span>
                  </h4>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Higher levels spawn smarter <strong className="text-neon-pink">paparazzi cameras</strong> and faster-charging <strong className="text-neon-cyan">foam fingers</strong>!
                  </p>
                  
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] border-b border-neutral-800/50 pb-1">
                      <span className="text-neutral-400">🌸 Flowers:</span>
                      <span className="font-bold text-neon-pink">+200 PTS</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] border-b border-neutral-800/50 pb-1">
                      <span className="text-neutral-400">💿 Gold Records:</span>
                      <span className="font-bold text-neon-yellow">+500 PTS</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">🪩 Disco Crushes:</span>
                      <span className="font-bold text-neon-cyan">+1000 PTS</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    id="restart-level-btn"
                    onClick={() => canvasRef.current?.restartLevel()}
                    className="flex-1 py-3 bg-black border-2 border-neon-yellow hover:bg-neon-yellow hover:text-black font-mono font-bold tracking-wider text-xs uppercase text-neon-yellow flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-neon-yellow hover:text-black" />
                    <span>RESTART</span>
                  </button>
                  <button
                    id="quit-current-btn"
                    onClick={() => {
                      setGameState("welcome");
                      gameAudio.stopMusic();
                    }}
                    className="flex-1 py-3 bg-black border-2 border-red-500 hover:bg-red-500 hover:text-black font-mono font-bold tracking-wider text-xs uppercase text-red-500 flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>QUIT GAME</span>
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {/* STATE C: GAME OVER SCREEN */}
          {gameState === "game_over" && (
            <motion.div
              key="gameover-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-xl bg-black border-4 border-neon-pink p-6 md:p-8 text-center space-y-6 shadow-[8px_8px_0_#FF007F] font-mono select-none"
            >
              <div className="space-y-2">
                <span className="text-5xl tracking-widest inline-block animate-pulse">💔 🪩 💔</span>
                <h2 className="text-5xl md:text-6xl font-anton text-white tracking-widest uppercase drop-shadow-[0_4px_0_#00FFFF]">
                  GAME OVER
                </h2>
                <p className="text-neon-pink text-xs uppercase font-bold tracking-[0.2em] mt-2">
                  YOU WENT OUT LIKE A WRECKING BALL!
                </p>
              </div>

              {/* Score breakdown banner */}
              <div className="p-4 bg-neutral-950 border-2 border-neutral-800 grid grid-cols-2 gap-4">
                <div className="text-center border-r-2 border-neutral-800">
                  <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    Level Reached
                  </div>
                  <div className="text-4xl font-anton text-neon-cyan mt-1">
                    {level}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    Final Score
                  </div>
                  <div className="text-3xl font-anton text-neon-yellow mt-1">
                    {score.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* High Score Submission Panel */}
              {isNewHighScorePending ? (
                <div className="p-4 bg-neon-pink/5 border-2 border-neon-pink space-y-3 shadow-[4px_4px_0_rgba(255,0,127,0.15)]">
                  <div className="text-xs text-neon-pink font-extrabold uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-neon-yellow animate-spin" />
                    <span>A NEW RETRO RECORD!</span>
                  </div>
                  
                  <form onSubmit={handleRegisterHighScore} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={10}
                      value={currentPlayerName}
                      onChange={(e) => setCurrentPlayerName(e.target.value)}
                      placeholder="ENTER NAME (MAX 10)"
                      className="flex-grow bg-neutral-950 border-2 border-neutral-800 focus:border-neon-pink rounded-none px-4 py-2.5 text-center text-sm uppercase text-white font-bold tracking-widest focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-neon-pink text-black text-xs font-anton tracking-wider uppercase rounded-none active:scale-95 transition-all text-center font-bold cursor-pointer hover:bg-white"
                    >
                      SUBMIT
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-4 bg-neutral-950 border border-neutral-800 text-xs space-y-2 text-neutral-400 max-w-sm mx-auto">
                  <h4 className="text-neon-yellow font-bold flex items-center justify-center gap-1 uppercase tracking-wider">
                    <Trophy className="w-3.5 h-3.5 text-neon-yellow fill-neon-yellow" />
                    <span>YOUR HIGH SCORE HAS BEEN REGISTERED!</span>
                  </h4>
                  <p className="leading-relaxed">
                    Play another round and top your personal record. Keep buying yourself flowers!
                  </p>
                </div>
              )}

              {/* Leaderboards listing */}
              <div className="space-y-2 text-left bg-neutral-950 p-4 border border-neutral-900 max-w-md mx-auto">
                <div className="text-[10px] text-neutral-500 font-bold uppercase text-center tracking-[0.2em] border-b border-neutral-800 pb-1.5">
                  CURRENT HALL OF BANGERS
                </div>
                {leaderboard.slice(0, 3).map((entry, index) => (
                  <div key={`go-lead-${index}`} className="flex justify-between items-center text-xs font-mono px-1 py-1 text-neutral-300">
                    <span className="font-bold">#{index + 1} {entry.name}</span>
                    <span className="text-neon-pink font-bold">{entry.score.toLocaleString()} PTS</span>
                  </div>
                ))}
              </div>

              {/* Reset Re-play trigger buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2 justify-center">
                <button
                  id="replay-game-btn"
                  onClick={handleStartPlay}
                  className="w-full sm:w-auto flex-grow px-8 py-4 bg-neon-pink text-black font-anton tracking-widest text-lg border-4 border-white shadow-[4px_4px_0_#00FFFF] hover:shadow-[2px_2px_0_#00FFFF] hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer hover:bg-neon-yellow"
                >
                  REPLAY GAME
                </button>
                <button
                  id="go-back-btn"
                  onClick={() => setGameState("welcome")}
                  className="w-full sm:w-auto px-6 py-4 bg-black border-4 border-neon-cyan text-neon-cyan font-anton tracking-widest text-base hover:bg-neon-cyan hover:text-black transition-all duration-150 cursor-pointer"
                >
                  LEAVE STAGE
                </button>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Rules dialog modal */}
      <InstructionsModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      {/* Footer System Credits */}
      <footer className="p-4 border-t-2 border-zinc-800 bg-zinc-950/40 text-center text-[10px] text-zinc-500 uppercase tracking-widest font-mono select-none">
        WRECKING DUG © 2026 · POWERED BY GLITTER & Retro POP
      </footer>
    </div>
  );
}
