import { buildRuntime, SlotMachine } from './core/slotMachine';
import { ReelHandler } from './core/reelHandler';
import { iconMeta } from './data/iconMetaTable';
import machineConfigData from './data/machines/selectableMachines.json';
import { isMachineConfig, MachineConfig, RNG, ICONS, makeGrid, IconId } from './types/index';

class SimpleRNG implements RNG {
  private state = Date.now() >>> 0;

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  setSeed(seed: number | string): void {
    const text = seed.toString();
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    this.state = hash >>> 0;
  }
}

async function bootstrap() {
  const debugPanel = document.querySelector<HTMLPreElement>('#debug');
  const machineLabel = document.querySelector<HTMLSpanElement>('#machine-name');

  const print = (lines: string[]) => {
    if (debugPanel) debugPanel.textContent = lines.join('\n');
    console.log('[Slotspire]', ...lines);
  };

  print(['Bootstrapping…']);

  const cfgCandidate = machineConfigData as unknown;
  if (!isMachineConfig(cfgCandidate)) {
    print(['Failed to validate machine config JSON.', JSON.stringify(cfgCandidate, null, 2)]);
    return;
  }
  const machineConfig = cfgCandidate as MachineConfig;

  const runtime = buildRuntime(machineConfig, iconMeta);
  const rng = new SimpleRNG();
  const slotMachine = new SlotMachine(runtime, rng);

  const reel = new ReelHandler('#reels');
  await reel.loadIcons(iconMeta);
  const placeholder = makeGrid(runtime.gridWidth, runtime.gridHeight, ICONS[0] as IconId);
  reel.render(placeholder);

  const spinButton = document.querySelector<HTMLButtonElement>('#spin');
  if (!spinButton) {
    print(['Spin button not found; aborting.']);
    return;
  }

  if (machineLabel) {
    machineLabel.textContent = runtime.name;
  }

  print([
    `Machine: ${runtime.name}`,
    `Grid: ${runtime.gridWidth}×${runtime.gridHeight}`,
    `Available icons: ${Object.keys(runtime.icons).length}`,
    '',
    'Press SPIN to generate a result.',
  ]);

  spinButton.addEventListener('click', async () => {
  spinButton.disabled = true;  // prevent double-clicks
  
  const result = slotMachine.spin();
  
  // Animate the spin!
  await reel.animate(result.grid);
  
  spinButton.disabled = false;
  
  print([
    `Last payout: ${result.payout.toFixed(2)}`,
    '',
    'Grid:',
    result.grid.map((row: IconId[]) => row.join(' ')).join('\n'),
  ]);
});
}

bootstrap().catch((err) => {
  const debugPanel = document.querySelector<HTMLPreElement>('#debug');
  if (debugPanel) {
    const message =
      err instanceof Error
        ? `${err.name}: ${err.message}\n${err.stack ?? ''}`
        : typeof err === 'object'
          ? JSON.stringify(err, null, 2)
          : String(err);
    debugPanel.textContent = `Bootstrap failed:\n${message}`;
  }
  console.error('Failed to bootstrap slot machine', err);
    });

