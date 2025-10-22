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
  Modifier,
  Difficulty,
  RunState,
  ShopSpec,
  ShopStockItem,
  ScoringPattern,
  RNG,
  RNGSeed,
  isMachineConfig
} from './contracts/MainTypes';
import machinConfigData from './'



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
--------------------------------------------------------*/
    const machineCandidates = machineConfigData as unknown;
    if (!isMachineConfig(machineCandidates)) {
        print(['Failed to validate machine config JSON.', JSON.stringify(machineCandidates, null, 2)]);
        return
    }



}


/*-------------------------------------------------Call-Bootstrap----------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
bootstrap().catch((err) => {
  console.error('[Spike] bootstrap failed', err);
});
