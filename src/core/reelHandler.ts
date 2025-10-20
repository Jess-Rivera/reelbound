import {
  Grid,
  IconId,
  ReelView,
  IconMetaTable,
  CELL_SIZE,
  SPIN_SPEED,
  MIN_SPEED,
  ManualSpinSession,
  ManualReelState,
  DECEL_DISTANCE,
} from '../types/index';

const FRAME_DURATION_MS = 1000 / 60;
const FRAMES_PER_MS = 1 / FRAME_DURATION_MS; // ~0.06 at 60 FPS
const STOP_EPSILON = 0.5;

export class ReelHandler implements ReelView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private icons: Record<IconId, HTMLImageElement> = {} as any;

  private cell = CELL_SIZE;
  private width = 0;
  private height = 0;

  private animationFrameId: number | null = null;
  private lastFrameTime: number | null = null;

  private manualSession: ManualSpinSession | null = null;
  private onReelSettled: ((column: number) => void) | null = null;

  constructor(canvasSelector: string, cellSize = CELL_SIZE) {
    const el = document.querySelector(canvasSelector);
    if (!(el instanceof HTMLCanvasElement)) throw new Error('Canvas not found');
    this.canvas = el;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not available');
    this.ctx = ctx;
    this.cell = cellSize;
    this.setupDPR();
  }

  getCellSize(): number {
    return this.cell;
  }

  async loadIcons(meta: IconMetaTable): Promise<void> {
    const tasks = Object.entries(meta).flatMap(([id, info]) => {
      const src = info.spriteUrl;
      if (!src) return [];
      return [
        new Promise<void>((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => {
            this.icons[id as IconId] = img;
            resolve();
          };
          img.onerror = (ev) => {
            console.warn(`Failed to load sprite for ${id} from ${src}`, ev);
            resolve();
          };
        }),
      ];
    });

    await Promise.all(tasks);
  }

  render(grid: Grid<IconId>): void {
    this.height = grid.length;
    this.width = this.height ? grid[0].length : 0;
    this.setupCanvas();

    this.cancelAnimation();

    this.ctx.fillStyle = '#0d111a';
    this.ctx.fillRect(0, 0, this.width * this.cell, this.height * this.cell);

    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        this.drawIcon(grid[r][c], c * this.cell, r * this.cell);
      }
    }
  }

  beginManualAnimation(
    session: ManualSpinSession,
    onSettled: (column: number) => void
  ): void {
    this.manualSession = session;
    this.onReelSettled = onSettled;
    this.width = session.reels.length;
    if (!this.height) {
      // fall back to a 3-row view; caller should have rendered once already, but guard anyway
      this.height = 3;
    }
    this.setupCanvas();

    this.cancelAnimation();
    this.lastFrameTime = null;
    this.animationFrameId = requestAnimationFrame(this.manualLoop);
  }

  markReelStopping(
    session: ManualSpinSession,
    column: number | null = null
  ): void {
    // Keep reference updated in case caller mutated a cloned session object.
    if (this.manualSession !== session) {
      this.manualSession = session;
    }
    if (column !== null && this.manualSession) {
      const reel = this.manualSession.reels[column];
      if (reel && reel.state === 'stopping') {
        reel.stopRequestedAt = performance.now();
      }
    }
    if (this.animationFrameId === null) {
      this.lastFrameTime = null;
      this.animationFrameId = requestAnimationFrame(this.manualLoop);
    }
  }

  endManualAnimation(): void {
    this.cancelAnimation();
    this.manualSession = null;
    this.onReelSettled = null;
    this.lastFrameTime = null;
  }

  private manualLoop = (timestamp: number) => {
    if (!this.manualSession) {
      this.animationFrameId = null;
      return;
    }

    if (this.lastFrameTime === null) {
      this.lastFrameTime = timestamp;
    }
    const deltaMs = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    const deltaFrames = deltaMs * FRAMES_PER_MS;

    const session = this.manualSession;
    let anyActive = false;

    this.ctx.fillStyle = '#0d111a';
    this.ctx.fillRect(0, 0, this.width * this.cell, this.height * this.cell);

    session.reels.forEach((reel, col) => {
      switch (reel.state) {
        case 'spinning':
          this.advanceSpinningReel(reel, deltaFrames);
          this.drawLoopingStrip(reel, col);
          anyActive = true;
          break;
        case 'stopping': {
          const stillMoving = this.advanceStoppingReel(reel, deltaFrames);
          this.drawLoopingStrip(reel, col);
          if (!stillMoving) this.handleReelSettled(col);
          anyActive = anyActive || stillMoving;
          break;
        }
        default:
          this.drawStoppedStrip(reel, col);
      }
    });

    if (anyActive) {
      this.animationFrameId = requestAnimationFrame(this.manualLoop);
    } else {
      this.animationFrameId = null;
      this.lastFrameTime = null;
    }
  };

  private advanceSpinningReel(reel: ManualReelState, deltaFrames: number): void {
    const stripHeightPx = reel.strip.length * this.cell;
    
    // Increase offset to scroll icons downward
    reel.offsetPx += reel.velocity * deltaFrames;

    // When we've scrolled past a full cell
    while (reel.offsetPx >= this.cell) {
      reel.offsetPx -= this.cell;
      // Position advances FORWARD as icons scroll down
      reel.position = (reel.position - 1) % reel.strip.length;
    }
    
    // Preview is the next icon in the strip
    const nextIndex = (reel.position + 1) % reel.strip.length;
    reel.previewIcon = reel.strip[nextIndex];
  }

  private advanceStoppingReel(
    reel: ManualReelState,
    deltaFrames: number
  ): boolean {
    const targetMin = reel.minSpeed ?? MIN_SPEED;
    const decelDistance = reel.decelDistance ?? DECEL_DISTANCE;
    const symbolsToStop = Math.max(1, decelDistance / this.cell);

    const decelPerFrame =
      (reel.velocity - targetMin) / symbolsToStop || reel.velocity;

    reel.velocity = Math.max(targetMin, reel.velocity - decelPerFrame * deltaFrames);
    this.advanceSpinningReel(reel, deltaFrames);

    const aligned =
      reel.velocity <= targetMin + 0.01 && Math.abs(reel.offsetPx) <= STOP_EPSILON;

    if (aligned) {
      reel.offsetPx = 0;
      reel.state = 'stopped';
      return false;
    }

    return true;
  }

  private handleReelSettled(column: number): void {
  if (!this.manualSession) return;
  const reel = this.manualSession.reels[column];
  const strip = reel.strip;
  
  // What the player SEES at the top row is the truth
  const finalIndex = ((reel.position % strip.length) + strip.length) % strip.length;

  reel.finalIndex = finalIndex;
  reel.finalIcon = strip[finalIndex];
  reel.position = finalIndex;
  reel.velocity = 0;
  reel.offsetPx = 0;

  if (this.onReelSettled) {
    this.onReelSettled(column);  // Tells SlotMachine what actually stopped
  }
}

  private drawLoopingStrip(reel: ManualReelState, column: number): void {
    const x = column * this.cell;
    const stripHeightPx = reel.strip.length * this.cell;
    const totalHeight = this.height * this.cell;

    // Draw enough passes to cover the visible area plus buffer
    for (let pass = -1; pass <= 1; pass++) {
      const baseY = pass * stripHeightPx + reel.offsetPx;  // Back to subtract
      for (let i = 0; i < reel.strip.length; i++) {
        const stripIndex = (reel.position + i) % reel.strip.length;  // ⚠️ Use position + i
        const y = baseY + i * this.cell;
        if (y + this.cell < 0 || y > totalHeight) continue;
        this.drawIcon(reel.strip[stripIndex], x, y);
      }
    }
  }

  private drawStoppedStrip(reel: ManualReelState, column: number): void {
    const x = column * this.cell;
    for (let row = 0; row < this.height; row++) {
      const idx = (reel.position + row) % reel.strip.length;
      this.drawIcon(reel.strip[idx], x, row * this.cell);
    }
  }

  private drawIcon(id: IconId, x: number, y: number): void {
    const img = this.icons[id];
    if (img) {
      this.ctx.drawImage(img, x, y, this.cell, this.cell);
      return;
    }

    // fallback for missing art
    this.ctx.fillStyle = '#3b4253';
    this.ctx.fillRect(x, y, this.cell, this.cell);
    this.ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 1, y + 1, this.cell - 2, this.cell - 2);
  }

  private cancelAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastFrameTime = null;
  }

  private setupCanvas(): void {
    const cssW = this.width * this.cell;
    const cssH = this.height * this.cell;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.max(1, Math.floor(cssW * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  private setupDPR(): void {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }
}
