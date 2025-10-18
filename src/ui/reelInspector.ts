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
  
  constructor(containerSelector: string) {
    const el = document.querySelector(containerSelector);
    if (!(el instanceof HTMLElement)) {
      throw new Error(`ReelInspector: Container not found: ${containerSelector}`);
    }
    this.container = el;
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
    this.container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '16px';
    wrapper.style.padding = '16px';
    wrapper.style.overflowX = 'auto';
    
    reelStrips.forEach((strip, colIndex) => {
      const reelColumn = this.createReelColumn(strip, colIndex, currentPositions?.[colIndex]);
      wrapper.appendChild(reelColumn);
    });
    
    this.container.appendChild(wrapper);
  }

  private createReelColumn(strip: IconId[], colIndex: number, currentPos?: number): HTMLElement {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.alignItems = 'center';
    column.style.gap = '4px';
    
    // Header
    const header = document.createElement('div');
    header.textContent = `Reel ${colIndex + 1}`;
    header.style.fontWeight = 'bold';
    header.style.fontSize = '14px';
    header.style.marginBottom = '8px';
    header.style.color = '#fff';
    column.appendChild(header);
    
    // Reel container with scroll
    const reelContainer = document.createElement('div');
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
}