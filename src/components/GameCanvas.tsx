import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { TileType, Player, Enemy, DiscoBall, GameParticle, Direction, Position } from "../types";
import { gameAudio } from "../lib/audio";
import { Sparkles, Zap, Award, Flame, RefreshCw } from "lucide-react";

interface GameCanvasProps {
  level: number;
  onScoreUpdate: (score: number) => void;
  onLivesUpdate: (lives: number) => void;
  onGameOver: () => void;
  onLevelComplete: () => void;
  isPaused: boolean;
}

export interface GameCanvasHandle {
  restartLevel: () => void;
}

// 15x15 Grid setup
const GRID_SIZE = 15;
const VIRTUAL_RESOLUTION = 540; // 540x540 canvas resolution
const CELL_SIZE = VIRTUAL_RESOLUTION / GRID_SIZE; // 36 px

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  ({ level, onScoreUpdate, onLivesUpdate, onGameOver, onLevelComplete, isPaused }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Game state states (internal to canvas loop)
    const [score, setScore] = useState<number>(0);
    const [lives, setLives] = useState<number>(3);
    const [comboCount, setComboCount] = useState<number>(0);
    const [comboTimer, setComboTimer] = useState<number>(0);

    // Core mutable game object refs to prevent closure issues in RequestAnimationFrame loop
    const stateRef = useRef({
      grid: [] as TileType[][],
      player: null as Player | null,
      enemies: [] as Enemy[],
      discoBalls: [] as DiscoBall[],
      particles: [] as GameParticle[],
      rope: {
        active: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        direction: "right" as Direction,
        length: 0,
        maxLength: 4 * CELL_SIZE, // 4 tiles
        targetEnemyId: null as string | null,
      },
      keys: {} as Record<string, boolean>,
      lastUpdate: 0,
      levelCompleteTriggered: false,
      comboScoreMultiplier: 1,
      frameCount: 0,
      paparazziFlashes: [] as Array<{ x: number; y: number; timer: number; radius: number }>,
    });

    // Expose control to parent
    useImperativeHandle(ref, () => ({
      restartLevel() {
        initGameWorld();
      },
    }));

    // Trigger score / lives back to React parent
    const updateScore = (points: number) => {
      setScore((prev) => {
        const bonus = points * stateRef.current.comboScoreMultiplier;
        const newScore = prev + bonus;
        onScoreUpdate(newScore);
        return newScore;
      });
      // Show cute combo bounce
      setComboCount((prev) => prev + 1);
      setComboTimer(200); // frames to stay active
    };

    const updateLives = (newLvl: number) => {
      setLives(newLvl);
      onLivesUpdate(newLvl);
    };

    /**
     * Generate candy-colored grid map
     */
    const generateMap = (lvlNum: number): TileType[][] => {
      const g: TileType[][] = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        const row: TileType[] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
          if (x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1) {
            // Unbreakable chrome border
            row.push(TileType.Border);
          } else if (y <= 2) {
            // First 2 rows are empty sky for spawn / dropping platform
            row.push(TileType.Empty);
          } else {
            // Candy dirt layers
            const isGlitter = (y > 7 && Math.random() < 0.25) || (y > 10);
            row.push(isGlitter ? TileType.GlitterDirt : TileType.Dirt);
          }
        }
        g.push(row);
      }

      // Excavate core initial central tunnel for Miley
      for (let y = 5; y <= 8; y++) {
        g[y][7] = TileType.Empty;
      }
      for (let x = 5; x <= 9; x++) {
        g[6][x] = TileType.Empty;
      }

      // Excavate 3-4 random enemy tunnels depending on level difficulty
      const numTunnels = Math.min(3 + lvlNum, 6);
      for (let t = 0; t < numTunnels; t++) {
        const isHorizontal = Math.random() < 0.5;
        const length = 4 + Math.floor(Math.random() * 5); // 4 to 8 tiles

        if (isHorizontal) {
          const ty = 3 + Math.floor(Math.random() * (GRID_SIZE - 5));
          const txStart = 2 + Math.floor(Math.random() * (GRID_SIZE - length - 3));
          for (let col = txStart; col < txStart + length; col++) {
            if (g[ty] && g[ty][col] !== TileType.Border) {
              g[ty][col] = TileType.Empty;
            }
          }
        } else {
          const tx = 2 + Math.floor(Math.random() * (GRID_SIZE - 4));
          const tyStart = 3 + Math.floor(Math.random() * (GRID_SIZE - length - 3));
          for (let rowIdx = tyStart; rowIdx < tyStart + length; rowIdx++) {
            if (g[rowIdx] && g[rowIdx][tx] !== TileType.Border) {
              g[rowIdx][tx] = TileType.Empty;
            }
          }
        }
      }

      // Spawn random Flowers and Gold Records under the dirt
      for (let y = 3; y < GRID_SIZE - 1; y++) {
        for (let x = 1; x < GRID_SIZE - 1; x++) {
          if (g[y][x] === TileType.Dirt || g[y][x] === TileType.GlitterDirt) {
            const rand = Math.random();
            if (rand < 0.04) {
              g[y][x] = TileType.Flower;
            } else if (rand < 0.07 && rand >= 0.04) {
              g[y][x] = TileType.GoldRecord;
            }
          }
        }
      }

      return g;
    };

    /**
     * Main World Initialization
     */
    const initGameWorld = () => {
      const state = stateRef.current;
      state.levelCompleteTriggered = false;
      state.frameCount = 0;
      state.comboScoreMultiplier = 1;
      state.paparazziFlashes = [];

      // Gen grid
      state.grid = generateMap(level);

      // Reset Player (Miley) centered smoothly in grid 7,6
      state.player = {
        x: 7 * CELL_SIZE,
        y: 6 * CELL_SIZE,
        gridX: 7,
        gridY: 6,
        direction: "down",
        isMoving: false,
        score: score,
        lives: lives,
        bubblegumGunsLeft: 3,
        isInvincible: true,
        invincibilityTimer: 120, // 2 seconds of bling flashing
        isPoopAnimation: false,
        isDead: false,
        deathTimer: 0,
      };

      // Reset rope
      state.rope = {
        active: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        direction: "right",
        length: 0,
        maxLength: 4 * CELL_SIZE,
        targetEnemyId: null,
      };

      // Reset particles
      state.particles = [];

      // Spawn Disco Balls (usually in the dirt, hanging)
      // They are placed in high columns
      state.discoBalls = [];
      const ballCount = 3 + Math.min(level, 2);
      const usedColumns = new Set<number>();
      for (let i = 0; i < ballCount; i++) {
        let gridX = 2 + Math.floor(Math.random() * (GRID_SIZE - 4));
        while (usedColumns.has(gridX) || gridX === 7) {
          gridX = 2 + Math.floor(Math.random() * (GRID_SIZE - 4));
        }
        usedColumns.add(gridX);

        // Place inside a dirt band
        let gridY = 3 + Math.floor(Math.random() * 3);
        // Make sure it is dirt of standard type
        state.grid[gridY][gridX] = TileType.Empty; // make sure the ball sits in vacant slot
        // Make block directly above it look nice
        state.discoBalls.push({
          id: `disco-${i}-${Date.now()}`,
          gridX,
          gridY,
          x: gridX * CELL_SIZE,
          y: gridY * CELL_SIZE,
          state: "stable",
          wobbleTimer: 0,
          fallDistance: 0,
        });
      }

      // Spawn enemies
      state.enemies = [];
      const enemyCount = 3 + Math.min(level * 2, 7);
      let attempts = 0;

      while (state.enemies.length < enemyCount && attempts < 150) {
        attempts++;
        const ex = 1 + Math.floor(Math.random() * (GRID_SIZE - 2));
        const ey = 3 + Math.floor(Math.random() * (GRID_SIZE - 4));

        // Can only spawn inside an Empty tunnel cell
        if (state.grid[ey][ex] === TileType.Empty) {
          // Keep away from initial player spawn grid
          const distToPlayer = Math.abs(ex - 7) + Math.abs(ey - 6);
          if (distToPlayer > 4) {
            const id = `enemy-${state.enemies.length}-${Date.now()}`;
            const isFoamFinger = Math.random() < 0.45;

            state.enemies.push({
              id,
              type: isFoamFinger ? "foam_finger" : "paparazzi",
              x: ex * CELL_SIZE,
              y: ey * CELL_SIZE,
              gridX: ex,
              gridY: ey,
              targetX: ex,
              targetY: ey,
              direction: Math.random() < 0.5 ? "left" : "right",
              status: "roaming",
              ghostProgress: 0,
              inflationLevel: 0,
              inflationWobble: 0,
              deflateTimer: 0,
              speed: 1.0 + level * 0.15 + (isFoamFinger ? 0.35 : 0),
              ghostTimer: 180 + Math.random() * 240, // frames to decide to ghost
              isStunned: false,
              stunTimer: 0,
            });
          }
        }
      }

      // Visual fireworks or sparklers welcoming the player
      spawnExplosion(7 * CELL_SIZE, 6 * CELL_SIZE, "note", 15);
      onLivesUpdate(lives);
    };

    /**
     * Particle Spawner Utility
     */
    const spawnExplosion = (
      px: number,
      py: number,
      type: "sparkle" | "glitter" | "dirt" | "shatter" | "fire" | "gold" | "note",
      count: number = 8
    ) => {
      const colors = {
        sparkle: ["#ec4899", "#f43f5e", "#ff007f", "#fff", "#f472b6"],
        glitter: ["#a855f7", "#c084fc", "#e879f9", "#22d3ee", "#38bdf8"],
        dirt: ["#db2777", "#be185d", "#ec4899", "#fbcfe8"],
        shatter: ["#fff", "#e2e8f0", "#94a3b8", "#cbd5e1", "#ff007f", "#ffff00"],
        fire: ["#ef4444", "#f97316", "#facc15", "#f87171"],
        gold: ["#fbbf24", "#f59e0b", "#fef08a", "#fff", "#d97706"],
        note: ["#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#fbbf24"],
      };

      const selectColors = colors[type];

      for (let i = 0; i < count; i++) {
        const vel = 1.2 + Math.random() * 3.5;
        const angle = Math.random() * Math.PI * 2;
        stateRef.current.particles.push({
          id: `part-${Date.now()}-${Math.random()}`,
          x: px + CELL_SIZE / 2 + (Math.random() * 12 - 6),
          y: py + CELL_SIZE / 2 + (Math.random() * 12 - 6),
          vx: Math.cos(angle) * vel,
          vy: Math.sin(angle) * vel - (type === "fire" || type === "note" ? 1.0 : 0.5), // fly up slightly
          color: selectColors[Math.floor(Math.random() * selectColors.length)],
          size: type === "shatter" ? 2 + Math.random() * 5 : 2 + Math.random() * 3,
          maxLife: 30 + Math.random() * 35,
          life: 0,
          type,
          alpha: 1.0,
        });
      }
    };

    /**
     * Shooting bubblegum/glitter pump rope mechanics
     */
    const fireRope = () => {
      const state = stateRef.current;
      if (!state.player || state.player.isDead || isPaused) return;

      // Cannot shoot if already wrestling an enemy or another rope is expanding
      if (state.rope.active) return;

      // Start rope slightly off client tile center
      state.rope.active = true;
      state.rope.startX = state.player.x;
      state.rope.startY = state.player.y;
      state.rope.endX = state.player.x;
      state.rope.endY = state.player.y;
      state.rope.direction = state.player.direction;
      state.rope.length = 0;
      state.rope.targetEnemyId = null;

      gameAudio.playPump();
    };

    // Keep pumping active target
    const pumpActiveTarget = () => {
      const state = stateRef.current;
      const targetId = state.rope.targetEnemyId;
      if (!targetId) return;

      const enemy = state.enemies.find((e) => e.id === targetId);
      if (!enemy) {
        state.rope.active = false;
        state.rope.targetEnemyId = null;
        return;
      }

      // Add cool glitter sparkles at the pump connection
      spawnExplosion(enemy.x, enemy.y, "sparkle", 4);

      // Increase scale levels
      enemy.status = "inflating";
      enemy.deflateTimer = 120; // reset cooldown to 2 seconds
      enemy.inflationLevel = (enemy.inflationLevel || 0) + 1;
      gameAudio.playPump();

      // Check if POPPED!
      if (enemy.inflationLevel >= 4) {
        enemy.status = "popped";
        gameAudio.playPop();

        // Big bubblegum glitter blast
        spawnExplosion(enemy.x, enemy.y, "glitter", 28);
        spawnExplosion(enemy.x, enemy.y, "note", 10);

        // Detach lasso instantly
        state.rope.active = false;
        state.rope.targetEnemyId = null;

        // Reward score!
        const bonusValue = enemy.type === "foam_finger" ? 400 : 250;
        updateScore(bonusValue);

        // Filter popped enemies inside update loop later
      }
    };

    /**
     * KEYBOARD HANDLER
     */
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const state = stateRef.current;
        const key = e.key.toLowerCase();

        // Prevent layout scrolling for game arrow keys or Spacebar
        if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "spacebar"].includes(e.key.toLowerCase())) {
          e.preventDefault();
        }

        state.keys[key] = true;
        state.keys[e.key] = true; // Store dual case

        // Firing rope / Pump
        if (e.key === " " || key === "spacebar") {
          if (state.rope.active && state.rope.targetEnemyId) {
            pumpActiveTarget();
          } else {
            fireRope();
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        const state = stateRef.current;
        const key = e.key.toLowerCase();
        state.keys[key] = false;
        state.keys[e.key] = false;
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, [level, score, lives, isPaused]);

    /**
     * START & BOOT GAMESTATE
     */
    useEffect(() => {
      initGameWorld();
      setLives(3);
      setScore(0);
    }, [level]);

    /**
     * Dynamic combo timer decrease
     */
    useEffect(() => {
      if (isPaused) return;
      const t = setInterval(() => {
        setComboTimer((prev) => {
          if (prev <= 1) {
            setComboCount(0);
            stateRef.current.comboScoreMultiplier = 1;
            return 0;
          }
          return prev - 1;
        });
      }, 30);
      return () => clearInterval(t);
    }, [isPaused]);

    // Keep stateRef gameScore multiplier in sync
    useEffect(() => {
      if (comboCount > 5) {
        stateRef.current.comboScoreMultiplier = 3;
      } else if (comboCount > 2) {
        stateRef.current.comboScoreMultiplier = 2;
      } else {
        stateRef.current.comboScoreMultiplier = 1;
      }
    }, [comboCount]);

    /**
     * MAIN PHYSICS GAME UPDATE & DRAW CYCLE
     */
    useEffect(() => {
      let animFrameId: number;

      // Core simulation frame rate target: 60 FPS
      const loop = () => {
        animFrameId = requestAnimationFrame(loop);

        const canvas = canvasRef.current;
        if (!canvas || isPaused) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        stateRef.current.frameCount++;

        // 1. UPDATE STATES
        updatePhysics();

        // 2. RENDER BOARD
        drawBoard(ctx);
      };

      const updatePhysics = () => {
        const state = stateRef.current;
        if (!state.player) return;

        // --- A. PLAYER INPUT & LOCOMOTION ---
        if (state.player.isDead) {
          state.player.deathTimer--;
          if (state.player.deathTimer <= 0) {
            // Respawn or Game Over
            if (state.player.lives > 1) {
              const prevScore = state.player.score;
              const prevLives = state.player.lives - 1;
              updateLives(prevLives);
              initGameWorld();
              // Retain score
              if (state.player) {
                state.player.score = prevScore;
              }
            } else {
              // Complete Game Over
              onGameOver();
            }
          }
          return;
        }

        // Handle invincible timer
        if (state.player.isInvincible) {
          state.player.invincibilityTimer--;
          if (state.player.invincibilityTimer <= 0) {
            state.player.isInvincible = false;
          }
        }

        // Stop movement if currently lassoed/pumping to give high tension pulling feel
        const isCurrentlyShootingOrPumping = state.rope.active;

        let dx = 0;
        let dy = 0;
        let targetDir: Direction | null = null;

        if (!isCurrentlyShootingOrPumping) {
          if (state.keys["arrowup"] || state.keys["w"]) {
            dy = -2.2; // Smooth coordinate movement
            targetDir = "up";
          } else if (state.keys["arrowdown"] || state.keys["s"]) {
            dy = 2.2;
            targetDir = "down";
          } else if (state.keys["arrowleft"] || state.keys["a"]) {
            dx = -2.2;
            targetDir = "left";
          } else if (state.keys["arrowright"] || state.keys["d"]) {
            dx = 2.2;
            targetDir = "right";
          }
        }

        if (targetDir) {
          state.player.direction = targetDir;
          state.player.isMoving = true;

          // Attempt boundary checks inside grid coordinates
          const nextX = state.player.x + dx;
          const nextY = state.player.y + dy;

          // Resolve sub-position grid alignments
          const currentGridX = Math.round(state.player.x / CELL_SIZE);
          const currentGridY = Math.round(state.player.y / CELL_SIZE);

          // Get grid bounds coordinates
          const leftTargetCol = Math.floor(nextX / CELL_SIZE);
          const rightTargetCol = Math.ceil((nextX + 1) / CELL_SIZE);
          const topTargetRow = Math.floor(nextY / CELL_SIZE);
          const bottomTargetRow = Math.ceil((nextY + 1) / CELL_SIZE);

          let allowed = true;

          // Ensure Miley does NOT walk into Border chrome walls
          if (
            leftTargetCol < 0 ||
            rightTargetCol >= GRID_SIZE ||
            topTargetRow < 0 ||
            bottomTargetRow >= GRID_SIZE
          ) {
            allowed = false;
          } else {
            // Check top, bottom, left, right for chrome blockers
            for (let r = Math.floor(nextY / CELL_SIZE); r <= Math.floor((nextY + CELL_SIZE - 2) / CELL_SIZE); r++) {
              for (let c = Math.floor(nextX / CELL_SIZE); c <= Math.floor((nextX + CELL_SIZE - 2) / CELL_SIZE); c++) {
                if (state.grid[r] && state.grid[r][c] === TileType.Border) {
                  allowed = false;
                }
              }
            }
          }

          if (allowed) {
            state.player.x = Math.max(0, Math.min(nextX, VIRTUAL_RESOLUTION - CELL_SIZE));
            state.player.y = Math.max(0, Math.min(nextY, VIRTUAL_RESOLUTION - CELL_SIZE));

            // Align current grid indices
            state.player.gridX = Math.round(state.player.x / CELL_SIZE);
            state.player.gridY = Math.round(state.player.y / CELL_SIZE);

            // DIG PHYSICS: Check if player dug into Dirt, Hard Glitter dirt, or flowers
            const cellX = state.player.gridX;
            const cellY = state.player.gridY;

            if (state.grid[cellY] && state.grid[cellY][cellX] !== TileType.Empty) {
              const tileVal = state.grid[cellY][cellX];

              if (tileVal === TileType.Dirt) {
                // Dig sound and score!
                gameAudio.playDig();
                state.grid[cellY][cellX] = TileType.Empty;
                updateScore(15);
                spawnExplosion(cellX * CELL_SIZE, cellY * CELL_SIZE, "dirt", 6);
              } else if (tileVal === TileType.GlitterDirt) {
                gameAudio.playDig();
                stateRef.current.particles.push({
                  id: `glit-${Date.now()}`,
                  x: cellX * CELL_SIZE + CELL_SIZE / 2,
                  y: cellY * CELL_SIZE + CELL_SIZE / 2,
                  vx: 0,
                  vy: -1.5,
                  color: "#ffff00",
                  size: 5,
                  maxLife: 30,
                  life: 0,
                  type: "note",
                  alpha: 1,
                });
                state.grid[cellY][cellX] = TileType.Empty;
                updateScore(35); // Extra for hard lavender candy dirt
                spawnExplosion(cellX * CELL_SIZE, cellY * CELL_SIZE, "glitter", 10);
              } else if (tileVal === TileType.Flower) {
                // Bought myself FLOWERS! Miley voice chime.
                gameAudio.playCollect();
                state.grid[cellY][cellX] = TileType.Empty;
                updateScore(200);
                spawnExplosion(cellX * CELL_SIZE, cellY * CELL_SIZE, "note", 12);
              } else if (tileVal === TileType.GoldRecord) {
                // Gold record!
                gameAudio.playCollect();
                state.grid[cellY][cellX] = TileType.Empty;
                updateScore(500);
                spawnExplosion(cellX * CELL_SIZE, cellY * CELL_SIZE, "gold", 15);
              }
            }
          }
        } else {
          state.player.isMoving = false;
        }

        // --- B. GLITTER ROPE/LASSO SIMULATION ---
        if (state.rope.active) {
          // If already anchored, lock lasso to enemy coordinates
          if (state.rope.targetEnemyId) {
            const attachedEnemy = state.enemies.find((e) => e.id === state.rope.targetEnemyId);
            if (!attachedEnemy || attachedEnemy.status === "popped" || attachedEnemy.status === "crushed") {
              // detach
              state.rope.active = false;
              state.rope.targetEnemyId = null;
            } else {
              // Lock target position
              state.rope.endX = attachedEnemy.x;
              state.rope.endY = attachedEnemy.y;
            }
          } else {
            // Extend rope outwards forward
            const step = 8;
            state.rope.length += step;

            if (state.rope.direction === "right") {
              state.rope.endX = state.rope.startX + state.rope.length;
            } else if (state.rope.direction === "left") {
              state.rope.endX = state.rope.startX - state.rope.length;
            } else if (state.rope.direction === "up") {
              state.rope.endY = state.rope.startY - state.rope.length;
            } else if (state.rope.direction === "down") {
              state.rope.endY = state.rope.startY + state.rope.length;
            }

            // Check if lasso struck solid candy blocks / walls - breaks immediately
            const ropeGridX = Math.floor((state.rope.endX + CELL_SIZE / 2) / CELL_SIZE);
            const ropeGridY = Math.floor((state.rope.endY + CELL_SIZE / 2) / CELL_SIZE);

            if (
              ropeGridY < 0 || ropeGridY >= GRID_SIZE ||
              ropeGridX < 0 || ropeGridX >= GRID_SIZE ||
              [TileType.Dirt, TileType.GlitterDirt, TileType.Border].includes(state.grid[ropeGridY][ropeGridX])
            ) {
              // Rope hits blocks, retracts
              state.rope.active = false;
            } else {
              // Look for enemy colliding with rope tip
              const target = state.enemies.find((enemy) => {
                if (enemy.status === "popped" || enemy.status === "crushed") return false;
                const dist = Math.hypot(enemy.x - state.rope.endX, enemy.y - state.rope.endY);
                return dist < CELL_SIZE * 0.9;
              });

              if (target) {
                state.rope.targetEnemyId = target.id;
                target.status = "stuck";
                target.inflationLevel = 1; // start inflation
                target.deflateTimer = 90; // cooldown
                gameAudio.playPump();
              }

              // Max length reached without hitting target? Retract lasso
              if (state.rope.length >= state.rope.maxLength) {
                state.rope.active = false;
              }
            }
          }
        }

        // --- C. DISCO BALLS GRAVITY ---
        state.discoBalls.forEach((ball) => {
          const underY = ball.gridY + 1;
          const leftCol = ball.gridX;

          // Check if block directly under is totally empty
          const isCavityEmpty =
            underY < GRID_SIZE &&
            [TileType.Empty].includes(state.grid[underY][leftCol]);

          // Are there other disco balls directly under?
          const ballDirectlyBelow = state.discoBalls.find(
            (other) => other.id !== ball.id && other.gridX === leftCol && other.gridY === underY
          );

          if (ball.state === "stable") {
            if (isCavityEmpty && !ballDirectlyBelow) {
              ball.state = "wobbling";
              ball.wobbleTimer = 45; // 0.75 second wobbles
            }
          } else if (ball.state === "wobbling") {
            ball.wobbleTimer--;
            if (state.frameCount % 5 === 0) {
              gameAudio.playDiscoWobble();
            }
            if (ball.wobbleTimer <= 0) {
              ball.state = "falling";
              ball.fallDistance = 0;
            }
          } else if (ball.state === "falling") {
            // Apply high gravity sliding speed
            const fallAmount = 4.5;
            ball.y += fallAmount;
            ball.gridY = Math.floor(ball.y / CELL_SIZE);

            // Spawn lovely disco shiny trails!
            if (state.frameCount % 3 === 0) {
              state.particles.push({
                id: `disc-shn-${Date.now()}`,
                x: ball.x + CELL_SIZE / 2,
                y: ball.y + CELL_SIZE / 2,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                color: ["#fff", "#a855f7", "#22d3ee"][Math.floor(Math.random() * 3)],
                size: 3,
                maxLife: 20,
                life: 0,
                type: "glitter",
                alpha: 1,
              });
            }

            // Check if hit block or border beneath
            const checkGridIndex = Math.ceil((ball.y + CELL_SIZE - 2) / CELL_SIZE);
            const belowTileType =
              checkGridIndex < GRID_SIZE ? state.grid[checkGridIndex][ball.gridX] : TileType.Border;

            const nextBallDirectlyBelow = state.discoBalls.find(
              (other) =>
                other.id !== ball.id &&
                other.gridX === ball.gridX &&
                other.y <= ball.y + CELL_SIZE &&
                other.y >= ball.y
            );

            // CRUSH DETECTOR: Enemies / player under the falling disco ball
            // If Miley is crushed
            if (!state.player.isDead && !state.player.isInvincible) {
              const pDist = Math.hypot(state.player.x - ball.x, state.player.y - ball.y);
              if (pDist < CELL_SIZE * 0.85) {
                triggerPlayerDeath();
              }
            }

            // If an enemy is crushed
            state.enemies.forEach((enemy) => {
              if (enemy.status !== "popped" && enemy.status !== "crushed") {
                const distEnemy = Math.hypot(enemy.x - ball.x, enemy.y - ball.y);
                if (distEnemy < CELL_SIZE * 0.85) {
                  enemy.status = "crushed";
                  spawnExplosion(enemy.x, enemy.y, "shatter", 15);
                  gameAudio.playDiscoCrush();
                  // Scoring points * distance fallen! Massive jackpot
                  const crushBonus = 1000 * Math.max(1, Math.min(ball.gridY - 3, 5));
                  updateScore(crushBonus);
                }
              }
            });

            // If hits solid ground or another resting ball, it breaks into shimmering shattered splinters!
            if (belowTileType !== TileType.Empty || nextBallDirectlyBelow) {
              ball.state = "shattering";
              gameAudio.playDiscoCrush();
              spawnExplosion(ball.x, ball.y, "shatter", 25);
              spawnExplosion(ball.x, ball.y, "glitter", 15);
              ball.state = "broken";
            }
          }
        });

        // Clean broken disco balls from array
        state.discoBalls = state.discoBalls.filter((b) => b.state !== "broken");

        // --- D. PAPARAZZI & FOAM FINGERS ENEMY AI ---
        state.enemies.forEach((enemy) => {
          if (enemy.isStunned) {
            enemy.stunTimer--;
            if (enemy.stunTimer <= 0) {
              enemy.isStunned = false;
            }
            return;
          }

          // Handle Paparazzi custom flash camera zone
          if (enemy.type === "paparazzi" && enemy.status === "roaming" && state.frameCount % 240 === 0 && Math.random() < 0.45) {
            // Initiate camera flash! Paparazzi stops and clicks camera shutter
            gameAudio.playShutter();
            state.paparazziFlashes.push({
              x: enemy.x,
              y: enemy.y,
              timer: 30, // 30 frames animation
              radius: CELL_SIZE * 2.2,
            });
            enemy.isStunned = true;
            enemy.stunTimer = 45; // rests for flash cooldown
          }

          // Handle foam finger custom charging speed
          if (enemy.type === "foam_finger" && state.frameCount % 180 === 0 && Math.random() < 0.3) {
            // Super speed dash chase!
            enemy.speed *= 2.0;
            // particles fire
            spawnExplosion(enemy.x, enemy.y, "fire", 5);
            setTimeout(() => {
              enemy.speed /= 2.0;
            }, 1000);
          }

          // Inflation Deflation cooling
          if (["stuck", "inflating"].includes(enemy.status)) {
            enemy.deflateTimer--;
            if (enemy.deflateTimer <= 0) {
              enemy.inflationLevel--;
              if (enemy.inflationLevel <= 0) {
                enemy.inflationLevel = 0;
                enemy.status = "roaming";
              } else {
                enemy.deflateTimer = 45; // deflate progressively
              }
            }
            return;
          }

          if (enemy.status === "popped" || enemy.status === "crushed") {
            return;
          }

          // Paparazzi & Hands slowly decide to Ghost through solid blocks to catch player (like classic Dig Dug)
          if (enemy.status === "roaming") {
            enemy.ghostTimer--;
            if (enemy.ghostTimer <= 0) {
              enemy.status = "ghosting";
              enemy.ghostProgress = 0;
              // Visual warning cloud
              spawnExplosion(enemy.x, enemy.y, "glitter", 5);
            }
          }

          if (enemy.status === "ghosting") {
            // Glide directly towards player's current coordinate, ignoring block types!
            const target = state.player;
            const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
            const ghostSpeed = 0.8; // crawls slower while in block-ghost form

            enemy.x += Math.cos(angle) * ghostSpeed;
            enemy.y += Math.sin(angle) * ghostSpeed;

            // Align direction
            if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
              enemy.direction = Math.cos(angle) > 0 ? "right" : "left";
            } else {
              enemy.direction = Math.sin(angle) > 0 ? "down" : "up";
            }

            enemy.gridX = Math.round(enemy.x / CELL_SIZE);
            enemy.gridY = Math.round(enemy.y / CELL_SIZE);

            // Re-materialize when landing completely inside an empty dug-out cell!
            if (
              state.grid[enemy.gridY] &&
              state.grid[enemy.gridY][enemy.gridX] === TileType.Empty
            ) {
              const distanceToCenter = Math.hypot(
                enemy.x - enemy.gridX * CELL_SIZE,
                enemy.y - enemy.gridY * CELL_SIZE
              );
              // close enough to lock-in
              if (distanceToCenter < 10) {
                enemy.x = enemy.gridX * CELL_SIZE;
                enemy.y = enemy.gridY * CELL_SIZE;
                enemy.targetX = enemy.gridX;
                enemy.targetY = enemy.gridY;
                enemy.status = "roaming";
                enemy.ghostTimer = 220 + Math.random() * 260; // reset
                spawnExplosion(enemy.x, enemy.y, "glitter", 5);
              }
            }
            return;
          }

          // --- STANDARD ROAMING GRID CHASE LOGIC ---
          // Smooth slide from cell coordinates to target coordinates
          const distToTarget = Math.hypot(enemy.x - enemy.targetX * CELL_SIZE, enemy.y - enemy.targetY * CELL_SIZE);
          if (distToTarget <= enemy.speed) {
            // Snap to grid
            enemy.x = enemy.targetX * CELL_SIZE;
            enemy.y = enemy.targetY * CELL_SIZE;
            enemy.gridX = enemy.targetX;
            enemy.gridY = enemy.targetY;

            // Decide new target grid cell
            // Chases Miley based on greedy grid heuristic paths, or turns randomly
            const targetMiley = state.player;

            // Gather valid neighbor cells
            const dirs: Array<{ d: Direction; dx: number; dy: number }> = [
              { d: "up", dx: 0, dy: -1 },
              { d: "down", dx: 0, dy: 1 },
              { d: "left", dx: -1, dy: 0 },
              { d: "right", dx: 1, dy: 0 },
            ];

            const validDirs = dirs.filter((item) => {
              const nx = enemy.gridX + item.dx;
              const ny = enemy.gridY + item.dy;
              if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return false;
              // Roaming enemies can ONLY walk in Empty excavated tunnels (can't dig!)
              return state.grid[ny][nx] === TileType.Empty;
            });

            if (validDirs.length > 0) {
              // Standard greed heuristic: 60% chance to steer closer to Miley, 40% random wander
              const followMiley = Math.random() < 0.7;
              let selectedDir = validDirs[Math.floor(Math.random() * validDirs.length)];

              if (followMiley) {
                let bestDist = Infinity;
                validDirs.forEach((candidate) => {
                  const evalX = enemy.gridX + candidate.dx;
                  const evalY = enemy.gridY + candidate.dy;
                  const distance = Math.hypot(targetMiley.gridX - evalX, targetMiley.gridY - evalY);
                  if (distance < bestDist) {
                    bestDist = distance;
                    selectedDir = candidate;
                  }
                });
              }

              enemy.targetX = enemy.gridX + selectedDir.dx;
              enemy.targetY = enemy.gridY + selectedDir.dy;
              enemy.direction = selectedDir.d;
            } else {
              // Stuck in an enclosed grid cell? Toggle back to ghost mode immediately!
              enemy.status = "ghosting";
              enemy.ghostProgress = 0;
            }
          } else {
            // Visual slide interpolation
            const theta = Math.atan2(enemy.targetY * CELL_SIZE - enemy.y, enemy.targetX * CELL_SIZE - enemy.x);
            enemy.x += Math.cos(theta) * enemy.speed;
            enemy.y += Math.sin(theta) * enemy.speed;
          }
        });

        // Clean flat popped enemies & spawn explosion award
        const aliveEnemies = state.enemies.filter((e) => e.status !== "popped" && e.status !== "crushed");
        if (state.enemies.length !== aliveEnemies.length) {
          state.enemies = aliveEnemies;
        }

        // --- E. FLASH ZONE FLASH OVERLAYS AND COLLISION ---
        state.paparazziFlashes.forEach((flash) => {
          flash.timer--;
          // Inspect if player inside strobe camera light stun zone
          if (!state.player.isDead && !state.player.isInvincible) {
            const rangeDist = Math.hypot(state.player.x - flash.x, state.player.y - flash.y);
            if (rangeDist < flash.radius) {
              // Shutter strobe caught her!
              spawnExplosion(state.player.x, state.player.y, "shatter", 10);
              triggerPlayerDeath();
            }
          }
        });
        state.paparazziFlashes = state.paparazziFlashes.filter((f) => f.timer > 0);

        // --- F. PLAYER CONTACT DEATH CHECKS ---
        if (!state.player.isDead && !state.player.isInvincible) {
          state.enemies.forEach((enemy) => {
            if (enemy.status !== "popped" && enemy.status !== "crushed" && enemy.status !== "ghosting") {
              const dToEnemy = Math.hypot(state.player!.x - enemy.x, state.player!.y - enemy.y);
              if (dToEnemy < CELL_SIZE * 0.7) {
                triggerPlayerDeath();
              }
            }
          });
        }

        // --- G. LEVEL COMPLETE TRIGGER CHECK ---
        if (state.enemies.length === 0 && !state.levelCompleteTriggered) {
          state.levelCompleteTriggered = true;
          gameAudio.playLevelUp();
          // Stagger complete 1.5 seconds later
          setTimeout(() => {
            onLevelComplete();
          }, 1500);
        }

        // --- H. PARTICLES SIMULATION ---
        state.particles.forEach((p) => {
          p.life++;
          p.x += p.vx;
          p.y += p.vy;

          // Cute gravity pull for spark/debris
          if (["dirt", "shatter", "gold"].includes(p.type)) {
            p.vy += 0.08;
          }

          p.alpha = Math.max(0, 1.0 - p.life / p.maxLife);
        });
        state.particles = state.particles.filter((p) => p.life < p.maxLife);
      };

      const triggerPlayerDeath = () => {
        const state = stateRef.current;
        if (!state.player || state.player.isDead) return;

        state.player.isDead = true;
        state.player.deathTimer = 100; // 100 frames crash spin animation
        state.rope.active = false;
        state.rope.targetEnemyId = null;

        gameAudio.playDie();
        spawnExplosion(state.player.x, state.player.y, "fire", 20);
      };

      /**
       * CANVAS RENDERING
       */
      const drawBoard = (ctx: CanvasRenderingContext2D) => {
        const state = stateRef.current;
        ctx.fillStyle = "#0c0a09"; // rich obsidian base background
        ctx.fillRect(0, 0, VIRTUAL_RESOLUTION, VIRTUAL_RESOLUTION);

        // A. Draw Map Blocks
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const tile = state.grid[y][x];
            const px = x * CELL_SIZE;
            const py = y * CELL_SIZE;

            if (tile === TileType.Border) {
              // Sleek neon pink-purple metallic border
              ctx.fillStyle = "#ff007f";
              ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
              // metallic bolt
              ctx.fillStyle = "#ff71ce";
              ctx.fillRect(px + 4, py + 4, CELL_SIZE - 8, CELL_SIZE - 8);
              ctx.fillStyle = "#fff";
              ctx.fillRect(px + 10, py + 10, 6, 6);
            } else if (tile === TileType.Dirt) {
              // Neon Soft Pink Candy Dig-Dug dirt block
              ctx.fillStyle = y % 2 === 0 ? "#be185d" : "#db2777";
              ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
              // dot grid visual pattern inside dirt
              ctx.fillStyle = "#fbcfe8";
              ctx.fillRect(px + CELL_SIZE / 2, py + CELL_SIZE / 2, 2, 2);
            } else if (tile === TileType.GlitterDirt) {
              // Lavender Purple sparkly Glitter dirt
              ctx.fillStyle = y % 2 === 0 ? "#701a75" : "#86198f";
              ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
              // glitz flakes
              ctx.fillStyle = "#f5d0fe";
              ctx.fillRect(px + 8, py + 10, 3, 3);
              ctx.fillRect(px + 24, py + 20, 2, 2);
            } else if (tile === TileType.Flower) {
              // Cute Red flowers to buy ourselves
              ctx.fillStyle = "#86198f"; // background mud
              ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

              // 🌸 Flower body
              ctx.font = "20px system-ui";
              ctx.fillText("🌸", px + 6, py + 26);
            } else if (tile === TileType.GoldRecord) {
              ctx.fillStyle = "#be185d"; // background candy dirt
              ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

              // 💿 Record vinyl
              ctx.font = "20px system-ui";
              ctx.fillText("💿", px + 6, py + 26);
            }
          }
        }

        // B. Paparazzi White Flashing Rings
        state.paparazziFlashes.forEach((flash) => {
          ctx.save();
          const pulse = Math.sin(state.frameCount / 2) * 5;
          ctx.strokeStyle = "rgba(255, 255, 255, " + (flash.timer / 30) + ")";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(flash.x + CELL_SIZE / 2, flash.y + CELL_SIZE / 2, flash.radius + pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Flash core
          ctx.fillStyle = "rgba(255, 255, 255, " + (flash.timer / 40) + ")";
          ctx.beginPath();
          ctx.arc(flash.x + CELL_SIZE / 2, flash.y + CELL_SIZE / 2, flash.radius * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // C. Draw falling Wobbly Disco Balls!
        state.discoBalls.forEach((ball) => {
          ctx.save();
          let rx = ball.x + CELL_SIZE / 2;
          let ry = ball.y + CELL_SIZE / 2;

          if (ball.state === "wobbling") {
            // Shake shake shake!
            const shake = Math.sin(ball.wobbleTimer * 0.8) * 4;
            rx += shake;
          }

          // Glitter mirror ball color gradients
          const cyclingColor = `hsl(${(state.frameCount * 5) % 360}, 100%, 75%)`;
          const gradient = ctx.createRadialGradient(rx, ry, 2, rx, ry, CELL_SIZE / 2);
          gradient.addColorStop(0, "#ffffff");
          gradient.addColorStop(0.3, cyclingColor);
          gradient.addColorStop(1, "#1e1b4b");

          // Draw hanging silver string
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(rx, ball.y - 10);
          ctx.lineTo(rx, ry);
          ctx.stroke();

          // Draw sphere
          ctx.fillStyle = gradient;
          ctx.shadowColor = cyclingColor;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(rx, ry, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
          ctx.fill();

          // Draw Mirror-ball mesh pixel overlays
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 1;
          for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            ctx.arc(rx + i * 2, ry, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.restore();
        });

        // D. Draw Laser Pump rope / Electric Pink Lasso
        if (state.rope.active) {
          ctx.save();
          const rX = state.rope.startX + CELL_SIZE / 2;
          const rY = state.rope.startY + CELL_SIZE / 2;
          const eX = state.rope.endX + CELL_SIZE / 2;
          const eY = state.rope.endY + CELL_SIZE / 2;

          // Electric pink laser light with wave wiggle
          ctx.strokeStyle = "#ff007f";
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          ctx.shadowColor = "#ff71ce";
          ctx.shadowBlur = 10;

          ctx.beginPath();
          ctx.moveTo(rX, rY);

          // Render a retro neon zigzag/wiggle rope
          const steps = 10;
          for (let i = 1; i <= steps; i++) {
            const ratio = i / steps;
            const px = rX + (eX - rX) * ratio;
            const py = rY + (eY - rY) * ratio;
            const wiggle = Math.sin(state.frameCount * 0.4 + i) * 3;

            if (state.rope.direction === "left" || state.rope.direction === "right") {
              ctx.lineTo(px, py + wiggle);
            } else {
              ctx.lineTo(px + wiggle, py);
            }
          }
          ctx.stroke();

          // Glowing neon tips
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(eX, eY, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // E. Draw Paparazzi and Foam Finger enemies
        state.enemies.forEach((enemy) => {
          ctx.save();

          const ex = enemy.x + CELL_SIZE / 2;
          const ey = enemy.y + CELL_SIZE / 2;
          let scale = 1.0;

          // Inflate scale if bubblegum pump is attached
          if (["stuck", "inflating"].includes(enemy.status)) {
            scale = 1.0 + (enemy.inflationLevel || 0) * 0.35;
            // Wobble
            const wiggle = Math.sin(state.frameCount * 0.8) * 3;
            ctx.translate(wiggle, 0);
          }

          ctx.translate(ex, ey);
          ctx.scale(scale, scale);

          const flipMultiplier = enemy.direction === "left" ? -1 : 1;
          ctx.scale(flipMultiplier, 1);

          if (enemy.status === "ghosting") {
            ctx.globalAlpha = 0.55; // faded transparent ghost
          }

          if (enemy.type === "paparazzi") {
            // PAPARAZZI CAMERA-BOTS DRAWING
            // Camera Body
            ctx.fillStyle = enemy.isStunned ? "#4c1d95" : "#1c1917";
            ctx.fillRect(-14, -10, 28, 20);

            // Shutter lens
            ctx.fillStyle = "#475569";
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();

            // Glint lens glass
            ctx.fillStyle = "#22d3ee";
            ctx.beginPath();
            ctx.arc(2, -2, 3, 0, Math.PI * 2);
            ctx.fill();

            // Orange warning blink LED
            ctx.fillStyle = state.frameCount % 20 < 10 ? "#ef4444" : "#1e293b";
            ctx.beginPath();
            ctx.arc(-10, -7, 2, 0, Math.PI * 2);
            ctx.fill();

            // Shutter Flash cube on top
            ctx.fillStyle = "#cbd5e1";
            ctx.fillRect(-6, -14, 12, 4);
            ctx.fillStyle = "#ea580c"; // neon power knob
            ctx.fillRect(8, -12, 3, 3);
          } else {
            // 👆 GIANT BOUNCING FLAMING FOAM FINGER DRAWING
            // Hand palm base
            ctx.fillStyle = "#ec4899"; // signature Miley pink foam hand
            ctx.beginPath();
            ctx.roundRect(-10, -5, 20, 16, 4);
            ctx.fill();

            // Folded knuckles (circles)
            ctx.fillStyle = "#db2777";
            ctx.beginPath();
            ctx.arc(-4, 2, 3, 0, Math.PI * 2);
            ctx.arc(0, 2, 3, 0, Math.PI * 2);
            ctx.arc(4, 2, 3, 0, Math.PI * 2);
            ctx.fill();

            // Pointing neon Index foam finger pointing tall UP
            ctx.fillStyle = "#f472b6";
            ctx.beginPath();
            ctx.roundRect(-8, -16, 6, 14, 3);
            ctx.fill();

            // Glowing white Number "#1" star branding
            ctx.fillStyle = "#fff";
            ctx.font = "bold 9px monospace";
            ctx.fillText("1", 2, 8);

            // Give tiny cute cartoon googly eyes
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(-2, -1, 3, 0, Math.PI * 2);
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(-2, -1, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        });

        // F. Draw Miley Player (Wrecking Ball Diva)
        if (state.player) {
          ctx.save();

          const px = state.player.x + CELL_SIZE / 2;
          const py = state.player.y + CELL_SIZE / 2;

          ctx.translate(px, py);

          // If dead, draw spinning/crashing visuals
          if (state.player.isDead) {
            ctx.rotate((state.player.deathTimer * Math.PI) / 8);
            ctx.scale(state.player.deathTimer / 100, state.player.deathTimer / 100);

            // Draw spiral wreck ball
            ctx.fillStyle = "#64748b";
            ctx.beginPath();
            ctx.arc(0, 0, CELL_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = "24px system-ui";
            ctx.fillText("⭐", -12, 8);
            ctx.restore();
            return;
          }

          // Bling-Invincible flash effect (silver/pink flashes)
          if (state.player.isInvincible && state.frameCount % 8 < 4) {
            ctx.shadowColor = "#facc15";
            ctx.shadowBlur = 20;
          }

          // Acknowledge direction face
          const flipMileyX = state.player.direction === "left" ? -1 : 1;
          ctx.scale(flipMileyX, 1);

          // 1. Draw WRECKING BALL base (Miley sits on a gorgeous glossy chrome sphere with pink neon chassis!)
          const cycleChrome = `hsl(${(state.frameCount * 2) % 360}, 10%, 65%)`;
          const ballGradient = ctx.createRadialGradient(-3, 8, 1, 0, 8, 14);
          ballGradient.addColorStop(0, "#ffffff");
          ballGradient.addColorStop(0.4, cycleChrome);
          ballGradient.addColorStop(1, "#1c1917");

          ctx.fillStyle = ballGradient;
          ctx.beginPath();
          ctx.arc(0, 8, 10, 0, Math.PI * 2);
          ctx.fill();

          // Chrome highlights
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.beginPath();
          ctx.arc(-4, 5, 2, 0, Math.PI * 2);
          ctx.fill();

          // 2. Miley sitting on ball: Cute pop crop‑top and star‑eyes
          // Miley Crop Top Pink
          ctx.fillStyle = "#f43f5e";
          ctx.fillRect(-6, -4, 12, 8);

          // Head (Cute tan circle)
          ctx.fillStyle = "#ffedd5";
          ctx.beginPath();
          ctx.arc(0, -9, 7, 0, Math.PI * 2);
          ctx.fill();

          // Double high-bun pop space buns hair (golden yellow)
          ctx.fillStyle = "#facc15";
          ctx.beginPath();
          ctx.arc(-7, -15, 4, 0, Math.PI * 2); // left bun
          ctx.arc(7, -15, 4, 0, Math.PI * 2);  // right bun
          ctx.fill();

          // Star sunglasses (Giant hot silver stars!)
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#ff007f";
          ctx.lineWidth = 1;

          // Cute star frames
          drawStar(ctx, -3, -10, 4, 8, 5);
          drawStar(ctx, 3, -10, 4, 8, 5);

          // Smiley lipstick (red curve)
          ctx.strokeStyle = "#be185d";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, -7, 3, 0, Math.PI);
          ctx.stroke();

          // 3. Microphone drilling spear (Miley holds a shiny golden microphone pointing forward)
          ctx.save();
          ctx.rotate(Math.PI / 4 + Math.sin(state.frameCount * 0.5) * 0.1); // sway drilling arm
          ctx.fillStyle = "#fbbf24"; // golden handle
          ctx.fillRect(4, -4, 10, 3);
          ctx.fillStyle = "#e2e8f0"; // silver pop mic mesh
          ctx.beginPath();
          ctx.arc(14, -2.5, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          ctx.restore();
        };

        // G. Render Particle sparkles / fireworks
        state.particles.forEach((p) => {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;

          // Glowing flares
          if (p.type === "sparkle" || p.type === "glitter") {
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
          }

          if (p.type === "note") {
            // Draw tiny retro music notes!
            ctx.font = `${8 + p.size}px monospace`;
            ctx.fillText("🎵", p.x, p.y);
          } else {
            // Standard sparks circles
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        });
      };

      // Star-drawing canvas helper
      const drawStar = (
        c: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        innerRadius: number,
        outerRadius: number,
        spikes: number
      ) => {
        let rot = (Math.PI / 2) * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        c.beginPath();
        c.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          c.lineTo(x, y);
          rot += step;

          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          c.lineTo(x, y);
          rot += step;
        }
        c.lineTo(cx, cy - outerRadius);
        c.closePath();
        c.fill();
        c.stroke();
      };

      loop();

      return () => {
        cancelAnimationFrame(animFrameId);
      };
    }, [level, isPaused]);

    return (
      <div 
        id="glam-game-viewport"
        className="relative w-full aspect-square max-w-[540px] border-4 border-pink-500 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(236,72,153,0.3)] bg-stone-950/90 mx-auto"
      >
        {/* Combo Tracker HUD Overlay */}
        {comboCount > 1 && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-pink-500 text-white font-mono font-bold uppercase tracking-wider rounded-lg shadow-md border-2 border-pink-300 animate-bounce">
            <Flame className="w-4 h-4 text-yellow-300 animate-pulse fill-yellow-300" />
            <span className="text-xs">
              {comboCount}x COMBO (X{stateRef.current.comboScoreMultiplier} Mult!)
            </span>
          </div>
        )}

        {/* Dynamic Canvas element */}
        <canvas
          ref={canvasRef}
          width={VIRTUAL_RESOLUTION}
          height={VIRTUAL_RESOLUTION}
          style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
          className="mx-auto block"
        />

        {/* Screen Ready Bling Indicator */}
        {stateRef.current.levelCompleteTriggered && (
          <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-6 animate-fade-in text-center">
            <h3 className="font-mono text-4xl text-yellow-300 font-extrabold tracking-widest uppercase drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
              ✨ SLAYED! ✨
            </h3>
            <p className="text-pink-300 font-bold tracking-wide text-xs md:text-sm uppercase font-mono">
              LEVEL {level} BEATEN · BOUGHT MYSELF FLOWERS!
            </p>
          </div>
        )}
      </div>
    );
  }
);
