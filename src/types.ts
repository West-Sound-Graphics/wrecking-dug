/**
 * Type declarations for Retro Pop Dig Dug (Miley Cyrus Vibe)
 */

export enum TileType {
  Empty = 0,
  Dirt = 1,      // Standard digging dirt (pink pop candy dirt)
  GlitterDirt = 2, // Harder sparkly lavender/cyan candy block, scores extra points
  Border = 3,    // Solid outer chrome borders (unbreakable)
  GoldRecord = 4,   // Gold record collectible
  Flower = 5,       // Miley flowers we buy ourselves (+points)
}

export interface Position {
  x: number;
  y: number;
}

export type Direction = "up" | "down" | "left" | "right";

export interface Player {
  // Free smooth sub-pixel rendering coordinates
  x: number;
  y: number;
  gridX: number;
  gridY: number;
  direction: Direction;
  isMoving: boolean;
  score: number;
  lives: number;
  bubblegumGunsLeft: number;
  isInvincible: boolean;
  invincibilityTimer: number; // in frames or milliseconds
  isPoopAnimation: boolean;
  isDead: boolean;
  deathTimer: number;
}

export interface Enemy {
  id: string;
  type: "paparazzi" | "foam_finger";
  x: number; // smooth float grid coordinates
  y: number;
  gridX: number;
  gridY: number;
  targetX: number;
  targetY: number;
  direction: Direction;
  status: "roaming" | "ghosting" | "stuck" | "inflating" | "popped" | "crushed";
  ghostProgress: number; // 0 to 1 for fading/moving through blocks
  inflationLevel: number; // 0 (normal) up to 4 (pop!)
  inflationWobble: number; // for visual shake
  deflateTimer: number; // cooldown before shrinking
  speed: number;
  ghostTimer: number; // tracks when it decides to ghost
  shootCooldown?: number; // for foam finger fire/foam wave
  isStunned: boolean;
  stunTimer: number;
}

export interface DiscoBall {
  id: string;
  gridX: number;
  gridY: number;
  x: number; // pixel positions for falling smoothly
  y: number;
  state: "stable" | "wobbling" | "falling" | "shattering" | "broken";
  wobbleTimer: number; // offset
  fallDistance: number; // grids fallen (for crushing score)
}

export interface ShootingRope {
  active: boolean;
  startX: number; // grid / pixel coords
  startY: number;
  endX: number;
  endY: number;
  direction: Direction;
  length: number; // current length extended
  maxLength: number;
  targetEnemyId: string | null;
}

export interface GameParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  maxLife: number;
  life: number;
  type: "sparkle" | "glitter" | "dirt" | "shatter" | "fire" | "gold" | "note";
  alpha: number;
}

export interface GameState {
  score: number;
  highScore: number;
  level: number;
  lives: number;
  status: "welcome" | "ready" | "playing" | "level_completed" | "game_over";
  multiplier: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
  levelReached: number;
}
