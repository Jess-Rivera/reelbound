// src/ui/ReelInspector.ts
import { IconId, IconMetaTable } from '../types/index';

/**
 * Visual inspector for displaying reel strips in a scrollable view.
 * Shows the entire reel strip composition for each column.
 */
export class ReelInspector {
  private container: HTMLElement;
  private icons: Record<IconId, HTMLImageElement> = {} as any;
  private readonly cellSize = 48; // Smaller cells for preview
  private locked = false;
  private order: number[] = [];
  private lastStrips: IconId[][] = [];
  private lastPositions?: number[];
  private dragStartIndex: number | null = null;
  private readonly onOrderChange?: (order: number[]) => void;
  
  constructor(
    containerSelector: string,
    opts: { onOrderChange?: (order: number[]) => void } = {}
  ) {
    const el = document.querySelector(containerSelector);
    if (!(el instanceof HTMLElement)) {
      throw new Error(`ReelInspector: Container not found: ${containerSelector}`);
    }
    this.container = el;
    this.onOrderChange = opts.onOrderChange;
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
          img.onerror = () => {
            console.warn(`Failed to load sprite for ${id}`);
            res();
          };
        }),
      ];
    });
    await Promise.all(tasks);
  }

  /**
   * Render the reel strips as vertical columns.
   * @param reelStrips - Array of icon strips, one per column
   * @param currentPositions - Optional array showing current position in each reel
   */
  render(reelStrips: IconId[][], currentPositions?: number[]): void {
    this.lastStrips = reelStrips;
    this.lastPositions = currentPositions;
    if (this.order.length !== reelStrips.length) {
      this.order = reelStrips.map((_,idx) => idx);
    }
    
    this.container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '16px';
    wrapper.style.padding = '16px';
    wrapper.style.overflowX = 'auto';
    
    this.order.forEach((stripIndex, displayIndex) => {
      const strip = reelStrips[stripIndex];
      const reelColumn = this.createReelColumn(strip, stripIndex, displayIndex, currentPositions?.[stripIndex]);
      wrapper.appendChild(reelColumn);
    });
    
    this.container.appendChild(wrapper);
  }

  private createReelColumn(
    strip: IconId[], 
    stripIndex: number,
    displayIndex: number, 
    currentPos?: number
  ): HTMLElement {
    const column = document.createElement('div');
    column.classList.add('reel-inspector-column');
    column.dataset.stripIndex = String(stripIndex);
    column.dataset.displayIndex = String(displayIndex);
    column.draggable = !this.locked;
    if (!this.locked) {
      column.classList.add('draggable');
    }
    column.addEventListener('dragstart', (ev) => this.handleDragStart(ev, displayIndex));
    column.addEventListener('dragover', (ev) => this.handleDragOver(ev));
    column.addEventListener('drop', (ev) => this.handleDrop(ev, displayIndex));
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.alignItems = 'center';
    column.style.gap = '4px';
    
    // Header
    const header = document.createElement('div');
    header.classList.add('reel-inspector-header');

    const title = document.createElement('span');
    title.classList.add('reel-inspector-title');
    title.textContent = `Reel ${displayIndex + 1}`;

    const dragHandle = document.createElement('span');
    dragHandle.classList.add('drag-handle');
    dragHandle.textContent = '⋮⋮';
    dragHandle.draggable = false;
    dragHandle.setAttribute('aria-hidden', 'true');
    dragHandle.style.userSelect = 'none';
    dragHandle.style.cursor = this.locked ? 'default' : 'grab';
    dragHandle.title = this.locked ? 'Reel order locked' : 'Drag to rearrange';

    header.appendChild(title);
    header.appendChild(dragHandle);
    column.appendChild(header);
    
    // Reel container with scroll
    const reelContainer = document.createElement('div');
    reelContainer.classList.add('reel-inspector-body');
    if (!this.locked) {
      reelContainer.classList.add('draggable');
    }
    reelContainer.style.maxHeight = '400px';
    reelContainer.style.overflowY = 'auto';
    reelContainer.style.border = '2px solid #444';
    reelContainer.style.borderRadius = '4px';
    reelContainer.style.backgroundColor = '#1a1f2e';
    
    // Icon cells
    strip.forEach((iconId, index) => {
      const cell = document.createElement('div');
      cell.style.width = `${this.cellSize}px`;
      cell.style.height = `${this.cellSize}px`;
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
      cell.style.borderBottom = '1px solid #333';
      cell.style.position = 'relative';
      
      // Highlight current position
      if (currentPos !== undefined && index === currentPos) {
        cell.style.backgroundColor = '#4a5568';
        cell.style.boxShadow = 'inset 0 0 0 2px #60a5fa';
      }
      
      // Position label
      const label = document.createElement('span');
      label.textContent = index.toString();
      label.style.position = 'absolute';
      label.style.top = '2px';
      label.style.left = '4px';
      label.style.fontSize = '10px';
      label.style.color = '#666';
      label.style.fontWeight = 'bold';
      cell.appendChild(label);
      
      // Icon image or fallback
      const img = this.icons[iconId];
      if (img) {
        const iconImg = document.createElement('img');
        iconImg.src = img.src;
        iconImg.style.width = '40px';
        iconImg.style.height = '40px';
        iconImg.style.imageRendering = 'pixelated';
        cell.appendChild(iconImg);
      } else {
        const fallback = document.createElement('div');
        fallback.textContent = iconId;
        fallback.style.fontSize = '10px';
        fallback.style.color = '#8da2cb';
        fallback.style.textAlign = 'center';
        fallback.style.wordBreak = 'break-all';
        fallback.style.padding = '4px';
        cell.appendChild(fallback);
      }
      
      reelContainer.appendChild(cell);
    });
    
    column.appendChild(reelContainer);
    
    // Stats summary
    const stats = this.calculateStats(strip);
    const statsEl = document.createElement('div');
    statsEl.style.fontSize = '11px';
    statsEl.style.color = '#8da2cb';
    statsEl.style.marginTop = '8px';
    statsEl.style.textAlign = 'center';
    statsEl.innerHTML = `
      <div>Length: ${strip.length}</div>
      <div style="margin-top: 4px;">${stats}</div>
    `;
    column.appendChild(statsEl);
    
    return column;
  }

  private handleDragStart(ev: DragEvent, displayIndex: number) {
    if (this.locked) {
      ev.preventDefault();
      return;
    }
    this.dragStartIndex = displayIndex;
    ev.dataTransfer?.setData('text/plain', displayIndex.toString());
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }

  private handleDragOver (ev: DragEvent) {
    if (!this.locked) {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    }
  }

  private handleDrop (ev: DragEvent, targetIndex: number) {
    if (this.locked) return;
    ev.preventDefault();

    const srcText = ev.dataTransfer?.getData('text/plain');
    let sourceIndex = this.dragStartIndex;
    if (sourceIndex == null && srcText != null) {
      sourceIndex = Number(srcText);
    }
    this.dragStartIndex = null;

    if (sourceIndex == null || Number.isNaN(sourceIndex)) return;
    if (sourceIndex === targetIndex) return;

    const newOrder = [...this.order];
    const [moved] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, moved);

    this.order = newOrder;
    this.onOrderChange?.([...this.order]);

    if(this.lastStrips.length) {
      this.render(this.lastStrips, this.lastPositions);
    }
  }

  private calculateStats(strip: IconId[]): string {
    const counts: Record<string, number> = {};
    strip.forEach(icon => {
      counts[icon] = (counts[icon] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3) // Top 3
      .map(([icon, count]) => `${icon}: ${count}`)
      .join('<br>');
  }

  /**
   * Update to highlight current positions without full re-render
   */
  updatePositions(positions: number[]): void {
    // This is a simplified version - you could enhance it to just update highlights
    // For now, we'd need to store the strips and re-render
    // In a production app, you'd cache the DOM elements and just update classes
  }

  setLocked(state: boolean): void {
    this.locked = state;
    this.dragStartIndex = null;
    this.render(this.lastStrips, this.lastPositions);
  }
  
  resetOrder(): void {
    this.order = this.lastStrips.map((_, idx) => idx);
  }

}
