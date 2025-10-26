import { 
    Grid,
    IconId,
    SpinState
} from '../contracts/MainTypes'

export interface UIBindings {
    renderGrid(grid: Grid<IconId>): void;
    setSpinState(state: SpinState): void;
    setNextStop(label: string): void;
    setElapsed(ms: number): void;
    appendLog(message: string): void;
    clearLog(): void;
    onSpin(handler: () => void): () => void;
    onTriggerStop(handler: () => void): () => void;
    onKeyCommand(handler: (key: 'spin' | 'stop') => void): () => void;
}

function requireElement<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) {
        throw new Error('[UIBindings] Missing element: ${selector}');
    }
    return el;
}

export function createUIBindings(): UIBindings {
    const gridEl = requireElement<HTMLDivElement>('#grid');
    const spinStateEl = requireElement<HTMLOutputElement>('#spin-state');
    const nextStopEl = requireElement<HTMLOutputElement>('#next-stop');
    const elapsedEl = requireElement<HTMLOutputElement>('#elapsed');
    const logEl = requireElement<HTMLPreElement>('#debug-log');
    const clearLogBtn = requireElement<HTMLButtonElement>('#console-clear');
    const spinBtn = requireElement<HTMLButtonElement>('#btn-spin');
    const stopBtn = requireElement<HTMLButtonElement>('#btn-stop');

    function renderGrid(grid: Grid<IconId>): void {
    const columns = grid[0]?.length ?? 0;
    const totalCells = grid.length * columns;
    // ensure DOM matches machine dimensions
    if (gridEl.children.length !== totalCells) {
        gridEl.innerHTML = '';
        grid.forEach(row => row.forEach(icon => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.textContent = icon;
        gridEl.appendChild(cell);
        }));
    } else {
        let idx = 0;
        grid.forEach(row => row.forEach(icon => {
        (gridEl.children[idx++] as HTMLDivElement).textContent = icon;
        }));
    }
    if (columns > 0) {
        gridEl.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    }
    }

    function setSpinState(state: SpinState): void {
    spinStateEl.value = state;
    }

    function setNextStop(label: string): void {
    nextStopEl.value = label;
    }

    function setElapsed(ms: number): void {
    elapsedEl.value = `${(ms / 1000).toFixed(3)} s`;
    }

    function appendLog(message: string): void {
    const now = performance.now();
    const stamp = `[ ${now.toFixed(3).padStart(8, ' ')} ] `;
    logEl.textContent += `\n${stamp}${message}`;
    logEl.scrollTop = logEl.scrollHeight;
    }

    function clearLog(): void {
    logEl.textContent = '[ 00:00.000 ] Console cleared';
    }

    function onSpin(handler: () => void): () => void {
    spinBtn.addEventListener('click', handler);
    return () => spinBtn.removeEventListener('click', handler);
    }

    function onTriggerStop(handler: () => void): () => void {
    stopBtn.addEventListener('click', handler);
    return () => stopBtn.removeEventListener('click', handler);
    }

    function onKeyCommand(handler: (key: 'spin' | 'stop') => void): () => void {
    const listener = (evt: KeyboardEvent) => {
        if (evt.repeat) return;
        if (evt.key === 'Enter') handler('spin');
        if (evt.key === ' ') {
        evt.preventDefault();
        handler('stop');
        }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
    }

    clearLogBtn.addEventListener('click', () => clearLog());

    return {
        renderGrid,
        setSpinState,
        setNextStop,
        setElapsed,
        appendLog,
        clearLog,
        onSpin,
        onTriggerStop,
        onKeyCommand,
  };

}
