// Enhanced ReelHandler.ts with smooth reel animation
import { Grid, IconId, ReelView, IconMetaTable } from '../types/index';

interface ReelState {
  currentIcons: IconId[];  // strip of icons currently visible
  offset: number;          // vertical pixel offset
  targetOffset: number;    // where we want to stop
  velocity: number;        // current speed
  isSpinning: boolean;
  finalIcon: IconId;       // what icon should land in view
}

export class ReelHandler implements ReelView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private icons: Record<IconId, HTMLImageElement> = {} as any;
  private cell = 96;
  
  // Animation state per column
  private reelStates: ReelState[] = [];
  private animationFrameId: number | null = null;
  private width = 0;
  private height = 0;

  // Physics constants
  private readonly SPIN_SPEED = 25;        // pixels per frame when spinning (slower)
  private readonly DECEL_DISTANCE = 480;   // start slowing down this many pixels before target
  private readonly MIN_SPEED = 2;          // minimum speed before snap
  private readonly BOUNCE_AMOUNT = 12;     // pixels to overshoot then bounce back

  constructor(canvasSelector: string, cellSize = 96) {
    const el = document.querySelector(canvasSelector);
    if (!(el instanceof HTMLCanvasElement)) throw new Error("Canvas not found");
    this.canvas = el;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not available");
    this.ctx = ctx;
    this.cell = cellSize;
    this.setupDPR();
  }

  private setupDPR() {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  async loadIcons(meta: IconMetaTable): Promise<void> {
    const tasks = Object.entries(meta).flatMap(([id, info]) => {
      const src = info.spriteUrl;
      if (!src) return [];
      return [
        new Promise<void>((res) => {
          const img = new Image();
          img.src = src;
          img.onload = () => {
            this.icons[id as IconId] = img;
            res();
          };
          img.onerror = (ev) => {
            console.warn(`Failed to load sprite for ${id} from ${src}`, ev);
            res();
          };
        }),
      ];
    });
    await Promise.all(tasks);
  }

  // Instant render (no animation) - original behavior
  render(grid: Grid<IconId>): void {
    this.height = grid.length;
    this.width = this.height ? grid[0].length : 0;
    this.setupCanvas();

    // Cancel any ongoing animation
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clear background
    this.ctx.fillStyle = "#0d111a";
    this.ctx.fillRect(0, 0, this.width * this.cell, this.height * this.cell);

    // Draw grid
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        this.drawIcon(grid[r][c], c * this.cell, r * this.cell);
      }
    }
  }

  // Animated spin with actual reel strips - returns promise that resolves when animation completes
  async animateWithReels(finalGrid: Grid<IconId>, reelStrips: IconId[][]): Promise<void> {
    this.height = finalGrid.length;
    this.width = this.height ? finalGrid[0].length : 0;
    this.setupCanvas();

    // Initialize or update reel states for each column using actual reel strips
    // If reelStates already exist, preserve their current offset to avoid flicker
    const existingStates = this.reelStates.length > 0;
    
    if (!existingStates) {
      this.reelStates = [];
    }
    
    for (let col = 0; col < this.width; col++) {
      const strip = reelStrips[col] || [];
      
      if (existingStates && this.reelStates[col]) {
        // Update existing state, preserve current offset
        this.reelStates[col].currentIcons = strip;
        this.reelStates[col].velocity = 0;
        this.reelStates[col].isSpinning = false;
        this.reelStates[col].finalIcon = finalGrid[0][col];
      } else {
        // Create new state
        this.reelStates.push({
          currentIcons: strip,
          offset: 0,
          targetOffset: 0,
          velocity: 0,
          isSpinning: false,
          finalIcon: finalGrid[0][col],
        });
      }
    }

    return new Promise((resolve) => {
      this.startSpinAnimation(finalGrid, resolve);
    });
  }

  private startSpinAnimation(finalGrid: Grid<IconId>, onComplete: () => void) {
    const startTime = performance.now();
    const bouncingReels = new Set<number>(); // track which reels are bouncing

    // Timing configuration
    const RAPID_SPIN_DURATION = 2000; // 2 seconds of rapid spinning
    const FIRST_REEL_MIN_DELAY = 300; // min additional delay for first reel
    const FIRST_REEL_MAX_DELAY = 500; // max additional delay for first reel
    const REEL_STAGGER = 500; // base delay between reels (0.5 seconds)
    const JITTER_AMOUNT = 100; // random jitter per reel (±50ms)
    const BOUNCE_DURATION = 150; // 150ms bounce

    // Calculate stop times for each reel
    const stopTimes: number[] = [];
    for (let col = 0; col < this.width; col++) {
      const firstReelDelay = FIRST_REEL_MIN_DELAY + 
        Math.random() * (FIRST_REEL_MAX_DELAY - FIRST_REEL_MIN_DELAY);
      const reelOffset = col * REEL_STAGGER;
      const jitter = (Math.random() - 0.5) * JITTER_AMOUNT;
      
      stopTimes.push(RAPID_SPIN_DURATION + firstReelDelay + reelOffset + jitter);
    }

    const animationLoop = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      
      // Clear canvas
      this.ctx.fillStyle = "#0d111a";
      this.ctx.fillRect(0, 0, this.width * this.cell, this.height * this.cell);

      let stillSpinning = false;

      // Update and draw each column
      for (let col = 0; col < this.width; col++) {
        const reel = this.reelStates[col];
        const spinDuration = stopTimes[col];
        const bounceStart = spinDuration;

        if (elapsed < spinDuration) {
          // Still spinning rapidly
          reel.isSpinning = true;
          
          // Calculate deceleration in the last 400ms before stop
          const timeUntilStop = spinDuration - elapsed;
          if (timeUntilStop < 400) {
            // Decelerate smoothly
            const decelFactor = timeUntilStop / 400;
            reel.velocity = this.SPIN_SPEED * decelFactor * 0.5 + this.MIN_SPEED;
          } else {
            // Full speed
            reel.velocity = this.SPIN_SPEED;
          }

          reel.offset -= reel.velocity; // negative for upward motion

          // Draw the scrolling strip for this column
          this.drawReelColumn(col, reel);
          stillSpinning = true;
        } else if (elapsed < bounceStart + BOUNCE_DURATION) {
          // Bounce phase
          if (!bouncingReels.has(col)) {
            bouncingReels.add(col);
            reel.offset = 0; // reset offset for bounce calculation
          }
          
          const bounceTime = elapsed - bounceStart;
          const bounceProgress = bounceTime / BOUNCE_DURATION;
          
          // Ease-out bounce: overshoot then settle
          const bounceOffset = this.BOUNCE_AMOUNT * Math.sin(bounceProgress * Math.PI);
          
          // Draw final icons with bounce offset
          for (let row = 0; row < this.height; row++) {
            const icon = finalGrid[row][col];
            this.drawIcon(icon, col * this.cell, row * this.cell + bounceOffset);
          }
          stillSpinning = true;
        } else if (reel.isSpinning || bouncingReels.has(col)) {
          // Just finished - snap to final position
          reel.isSpinning = false;
          reel.offset = 0;
          bouncingReels.delete(col);
          
          // Draw final icons
          for (let row = 0; row < this.height; row++) {
            const icon = finalGrid[row][col];
            this.drawIcon(icon, col * this.cell, row * this.cell);
          }
        } else {
          // Already completed - draw static
          for (let row = 0; row < this.height; row++) {
            const icon = finalGrid[row][col];
            this.drawIcon(icon, col * this.cell, row * this.cell);
          }
        }
      }

      if (stillSpinning) {
        this.animationFrameId = requestAnimationFrame(animationLoop);
      } else {
        this.animationFrameId = null;
        onComplete();
      }
    };

    this.animationFrameId = requestAnimationFrame(animationLoop);
  }

  private drawReelColumn(col: number, reel: ReelState) {
    const x = col * this.cell;
    const totalHeight = this.height * this.cell;
    
    // Calculate which icons from the strip are visible
    const stripCellHeight = this.cell;
    const loopedOffset = reel.offset % (reel.currentIcons.length * stripCellHeight);
    
    // Draw multiple copies to create seamless loop
    for (let pass = -1; pass <= 1; pass++) {
      const baseY = pass * reel.currentIcons.length * stripCellHeight - loopedOffset;
      
      for (let i = 0; i < reel.currentIcons.length; i++) {
        const y = baseY + i * stripCellHeight;
        
        // Only draw if visible in viewport
        if (y + stripCellHeight >= 0 && y < totalHeight) {
          this.drawIcon(reel.currentIcons[i], x, y);
        }
      }
    }
  }

  private drawIcon(id: IconId, x: number, y: number) {
    const img = this.icons[id];
    if (img) {
      this.ctx.drawImage(img, x, y, this.cell, this.cell);
    } else {
      // Fallback color
      const color = this.getFallbackColor(id);
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, this.cell, this.cell);
      this.ctx.strokeStyle = "rgba(0,0,0,0.35)";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x + 1, y + 1, this.cell - 2, this.cell - 2);
    }
  }

  private getFallbackColor(id: IconId): string {
    const colors: Partial<Record<IconId, string>> = {
      lemon: "#f5d742",
      grape: "#7d47b5",
      melon: "#6bd16b",
      cherry: "#ff4f5e",
      diamond: "#6dd4ff",
      bar: "#444957",
      seven: "#ff334f",
      bell: "#f7c948",
      star: "#ffe74a",
    };
    return colors[id] ?? "#3b4253";
  }

  private setupCanvas() {
    const cssW = this.width * this.cell;
    const cssH = this.height * this.cell;
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = Math.max(1, Math.floor(cssW * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}