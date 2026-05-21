/**
 * Web Audio API synthesizer for Retro Pop Dig Dug.
 * Synthesizes retro sound effects and an 8-bit chiptune version of Miley-inspired pop-art hits.
 */

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private musicInterval: any = null;
  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private noteIndex: number = 0;
  private tempo: number = 135; // Beats per minute

  // A simple representation of "Flowers" / "Wrecking Ball" inspired chiptune melody
  // Notes are formatted as [note_string, duration_in_beats, is_rest]
  // -1 represent rests, numbers represent frequencies
  private melody: Array<{ note: number; duration: number }> = [
    // Chorus melody: "I can buy myself flowers..." (in A minor / C major keys)
    { note: 329.63, duration: 1 }, // E4 (I)
    { note: 293.66, duration: 1 }, // D4 (can)
    { note: 261.63, duration: 1 }, // C4 (buy)
    { note: 246.94, duration: 1 }, // B3 (my)
    { note: 220.00, duration: 2 }, // A3 (self)
    { note: 0, duration: 2 },      // Rest

    { note: 220.00, duration: 1 }, // A3 (flowers)
    { note: 246.94, duration: 1 }, // B3
    { note: 261.63, duration: 1 }, // C4 (write)
    { note: 293.66, duration: 1 }, // D4 (my)
    { note: 246.94, duration: 2 }, // B3 (name)
    { note: 0, duration: 2 },      // Rest

    { note: 246.94, duration: 1 }, // B3 (in)
    { note: 261.63, duration: 1 }, // C4 (the)
    { note: 293.66, duration: 1 }, // D4 (sand)
    { note: 329.63, duration: 1 }, // E4 (talk)
    { note: 261.63, duration: 2 }, // C4 (to)
    { note: 0, duration: 2 },      // Rest

    { note: 261.63, duration: 1 }, // C4 (my)
    { note: 293.66, duration: 1 }, // D4 (self)
    { note: 329.63, duration: 1 }, // E4 (for)
    { note: 349.23, duration: 1 }, // F4 (hours)
    { note: 329.63, duration: 2 }, // E4 (yeah)
    { note: 0, duration: 2 },      // Rest

    // Bridge / Wrecking pop arpeggio climb
    { note: 440.00, duration: 1 }, // A4 (I)
    { note: 392.00, duration: 1 }, // G4 (came)
    { note: 349.23, duration: 1 }, // F4 (in)
    { note: 329.63, duration: 1 }, // E4 (like)
    { note: 293.66, duration: 2 }, // D4 (a)
    { note: 392.00, duration: 2 }, // G4 (wreck-)
    { note: 440.00, duration: 4 }, // A4 (-ing ball!)
    { note: 0, duration: 2 },
  ];

  // Simple bass accompaniment to add energy
  private bassline: number[] = [
    220.00, 220.00, 196.00, 196.00, 174.61, 174.61, 196.00, 196.00,
    220.00, 220.00, 261.63, 261.63, 293.66, 293.66, 329.63, 196.00
  ];

  constructor() {
    // Autoplay requires standard interaction, context is lazily constructed
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
    return this.isMuted;
  }

  public getMuteState(): boolean {
    return this.isMuted;
  }

  public startMusic() {
    if (this.isMuted) return;
    this.initContext();
    if (this.isMusicPlaying) return;

    this.isMusicPlaying = true;
    this.noteIndex = 0;

    const beatDuration = 60 / this.tempo; // time in seconds per quarter beat

    const playNextStep = () => {
      if (!this.isMusicPlaying || !this.ctx || this.isMuted) return;

      const currentItem = this.melody[this.noteIndex];
      const durationSeconds = currentItem.duration * beatDuration;

      // Primary synth melody
      if (currentItem.note > 0) {
        this.playTone(currentItem.note, "square", durationSeconds * 0.8, 0.08);

        // Add a cute sub-octave echo to simulate classic GameBoy dual channels
        setTimeout(() => {
          if (this.isMusicPlaying && !this.isMuted) {
            this.playTone(currentItem.note * 1.5, "triangle", durationSeconds * 0.4, 0.02);
          }
        }, (durationSeconds * 1000) / 4);
      }

      // Simple arcade bass walk rhythm
      const bassIndex = Math.floor(this.noteIndex / 2) % this.bassline.length;
      if (this.noteIndex % 2 === 0 && this.bassline[bassIndex]) {
        this.playTone(this.bassline[bassIndex] / 2, "sawtooth", durationSeconds * 1.5, 0.05);
      }

      // Retro chiptune hi-hat tick
      if (this.noteIndex % 2 === 1) {
        this.playNoise(durationSeconds * 0.1, 0.02);
      }

      this.noteIndex = (this.noteIndex + 1) % this.melody.length;

      // Schedule next trigger exactly at duration
      this.musicInterval = setTimeout(playNextStep, durationSeconds * 1000);
    };

    playNextStep();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  }

  /**
   * Play any target note with dynamic synth type, length, and volumes
   */
  private playTone(freq: number, type: OscillatorType, duration: number, volume: number) {
    if (!this.ctx || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      // Soft release envelope to prevent audible clicks
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Sound error", e);
    }
  }

  /**
   * Play simple synth white noise for drums / paparazzi photoflashes
   */
  private playNoise(duration: number, volume: number) {
    if (!this.ctx || !this.ctx.destination || this.isMuted) return;

    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      // Lowpass filter to muffle noise for retro feel
      const filterNode = this.ctx.createBiquadFilter();
      filterNode.type = "lowpass";
      filterNode.frequency.setValueAtTime(1000, this.ctx.currentTime);

      noiseNode.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      noiseNode.start();
    } catch (e) {
      // safe fallback
    }
  }

  /**
   * SOUND EFFECTS:
   */

  // 1. Digging (soft chewing retro crunch)
  public playDig() {
    this.initContext();
    this.playTone(85 + Math.random() * 40, "triangle", 0.08, 0.15);
  }

  // 2. Pump inflating paparazzi/foam finger (upward pitch retro slide)
  public playPump() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch (e) {}
  }

  // 3. Popping enemies with glitter explosion (big crash/pop sound)
  public playPop() {
    this.initContext();
    this.playNoise(0.3, 0.25);
    // glitter sparkling chime on top
    setTimeout(() => {
      this.playTone(880, "sine", 0.1, 0.1);
      this.playTone(1320, "sine", 0.15, 0.08);
      this.playTone(1760, "sine", 0.2, 0.05);
    }, 40);
  }

  // 4. Miley flowers or gold records collection (Happy gold arpeggio!)
  public playCollect() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      // Beautiful chord arpeggio C-E-G-C
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = freq;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + index * 0.06);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.06 + 0.25);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start(now + index * 0.06);
        osc.stop(now + index * 0.06 + 0.3);
      });
    } catch (e) {}
  }

  // 5. Disco ball falling/creaking
  public playDiscoWobble() {
    this.initContext();
    // vibrato/tremolo sound
    this.playTone(220 + Math.sin(Date.now() / 10) * 20, "sawtooth", 0.15, 0.08);
  }

  // 6. Disco ball crushing blocks & enemies (Heavy retro rumble)
  public playDiscoCrush() {
    this.initContext();
    this.playNoise(0.4, 0.3);
    this.playTone(60, "triangle", 0.5, 0.3);
  }

  // 7. Player death sliding whistling sound (Sad miley slide)
  public playDie() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.8);

      gainNode.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.8);
    } catch (e) {}
  }

  // 8. Level cleared fanfares
  public playLevelUp() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 523.25, 659.25];
      const tempoOffset = 0.12;
      const now = this.ctx.currentTime;

      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        // Alternate sounds for energetic brass retro vibe
        osc.type = index % 2 === 0 ? "triangle" : "square";
        osc.frequency.value = freq;

        gainNode.gain.setValueAtTime(0.08, now + index * tempoOffset);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + index * tempoOffset + 0.2);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start(now + index * tempoOffset);
        osc.stop(now + index * tempoOffset + 0.25);
      });
    } catch (e) {}
  }

  // 9. Paparazzi flash camera shutter
  public playShutter() {
    this.initContext();
    this.playNoise(0.05, 0.2);
    setTimeout(() => {
      this.playTone(1800, "triangle", 0.04, 0.08);
    }, 10);
  }
}

export const gameAudio = new RetroAudioEngine();
