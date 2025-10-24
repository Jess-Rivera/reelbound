import {
  Tickets,
  Contracts,
  ICONS,
  IconId,
  IconMetaData,
  SpinState,
  RoundMode,
  RoundState,
  RoundModePreset,
  ROUND_MODE_PRESETS,
  MachineSpec,
  HeatTier,
  PatternFamily,
  PatternId,
  Modifier,
  Difficulty,
  RunState,
  ShopSpec,
  ShopStockItem,
  ScoringPattern,
  RNG,
  RNGSeed,
  validateMachineConfig
} from './contracts/MainTypes';
import machineConfigData from './data/selectableMachines.json'
import patterns from './data/patterns.json'



/*------------------------------------------------Set Seed-----------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
class SimpleRNG implements RNG {
  private state: number;

  constructor(seed?: RNGSeed) {
    this.state =
      typeof seed === 'undefined'
        ? Date.now() >>> 0
        : this.hashSeed(seed);
  }

  private hashSeed(seed: RNGSeed): number {
    const text = seed.toString();
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  setSeed(seed: RNGSeed): void {
    this.state = this.hashSeed(seed);
  }
}


/*-------------------------------------------------Bootstrap---------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/

async function bootstrap() {
/*-------------------------------------------------------
Establishes the seed right away
--------------------------------------------------------*/
    const params = new URLSearchParams(window.location.search);
    const seedParam = params.get('seed') ?? params.get('rngSeed');
    const rng = new SimpleRNG(seedParam ?? undefined);

/*-------------------------------------------------------
Set up canvases
Print Console messages
--------------------------------------------------------*/
    const debugPanel = document.querySelector<HTMLPreElement>('#debug');
    const machineLabel = document.querySelector<HTMLSpanElement>('#machine-name');

    console.log(`Setting Up Systems.`);

/*-------------------------------------------------------
Build Default Machine, Replace with Main Menu Later
Validates selectableMachines.json is good
--------------------------------------------------------*/
    const machineCandidates = machineConfigData as unknown;
    if (!Array.isArray(machineCandidates)) {
        console.error('[Spike] Machine config JSON must be an array.');
        return;
    }

    const patternIds = new Set<PatternId>();
    if (Array.isArray(patterns)) {
        for (const entry of patterns) {
            if (entry && typeof entry.id === 'string') {
                patternIds.add(entry.id as PatternId);
            }
        }
    }

    const validMachines: MachineSpec[] = [];
    const validationProblems: Array<{ index: number; error: string }> = [];

    machineCandidates.forEach((candidate, index) => {
        const result = validateMachineConfig(candidate, patternIds);
        if (result.ok) {
            validMachines.push(result.value);
        } else {
            validationProblems.push({ index, error: result.error });
        }
    });

    if (validationProblems.length > 0) {
        const detail = validationProblems
            .map(({ index, error }) => `#${index}: ${error}`)
            .join('\n');
        throw new Error(`[Spike] Machine config errors:\n${detail}`);
    }

    if (validMachines.length === 0) {
        console.error('[Spike] No valid machines available. Aborting bootstrap.');
        return;
    }

    const selectedMachine = validMachines[0];
    console.log('[Spike] Machines loaded properly. Selected default machine:', selectedMachine.id);



}



/*-------------------------------------------------Call-Bootstrap----------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
bootstrap().catch((err) => {
  console.error('[Spike] bootstrap failed', err);
});
