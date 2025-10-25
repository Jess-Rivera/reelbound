import {
  RNG,
  RNGSeed
} from './contracts/MainTypes';
import { loadMachineResources } from './core/machineLoader';



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

/*-------------------------------------------------------
bootstrap – wire up seed, load machines, and prep initial state.
Example: bootstrap().catch(console.error);
-------------------------------------------------------*/
async function bootstrap() {
  /*-------------------------------------------------------
  Establish seed from URL or clock.
  -------------------------------------------------------*/
  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get('seed') ?? params.get('rngSeed');
  const rng = new SimpleRNG(seedParam ?? undefined);

  /*-------------------------------------------------------
  Wire debug hooks / DOM references.
  -------------------------------------------------------*/
  const debugPanel = document.querySelector<HTMLPreElement>('#debug');
  const machineLabel = document.querySelector<HTMLSpanElement>('#machine-name');

  console.log('Setting Up Systems.');

  /*-------------------------------------------------------
  Load machines & icon resources via loader.
  -------------------------------------------------------*/
  const { machines, iconMeta, baseIconWeights } = loadMachineResources();
  if (machines.length === 0) {
    throw new Error('[Spike] Machine loader produced zero machines.');
  }

  const selectedMachine = machines[0];
  console.log('[Spike] Machines loaded properly. Selected default machine:', selectedMachine.spec.id);

  // TODO: Wire up menu / gameplay bootstrap using selectedMachine, iconMeta, baseIconWeights.
}



/*-------------------------------------------------Call-Bootstrap----------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
/*-------------------------------------------------------------------------------------------------------------------*/
bootstrap().catch((err) => {
  console.error('[Spike] bootstrap failed', err);
});
