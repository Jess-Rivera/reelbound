import defaultPoolData from '../data/defaultPool.json';
import machineConfigData from '../data/selectableMachines.json';
import patternData from '../data/patterns.json';
import {
  IconId,
  IconMetaData,
  MachineSpec,
  PatternId,
  validateMachineConfig
} from '../contracts/MainTypes';

type RawDefaultPoolEntry = {
  id: string;
  name: string;
  glyph: string;
  assetURL?: string;
  baseScore: number;
  category: string;
  rarity: string;
  tags: string[];
  defaultAmount: number;
};

type RawPatternEntry = { id?: string | null };

export interface ResolvedMachineSpec {
  spec: MachineSpec;
  iconWeights: Record<IconId, number>;
}

export interface MachineResources {
  iconMeta: Record<IconId, IconMetaData>;
  baseIconWeights: Record<IconId, number>;
  machines: ResolvedMachineSpec[];
}

/*-------------------------------------------------------
loadMachineResources – hydrate icon data and machines from JSON.
Example: const resources = loadMachineResources(asset);
-------------------------------------------------------*/
export function loadMachineResources(
  resolveAsset?: (relativePath: string) => string
): MachineResources {
  const { iconMeta, baseIconWeights, iconIdSet } = buildIconCatalog(resolveAsset);
  const machines = buildMachines(baseIconWeights, iconIdSet);
  return { iconMeta, baseIconWeights, machines };
}

/*-------------------------------------------------------
buildIconCatalog – parse defaultPool.json into usable icon tables.
Example: const tables = buildIconCatalog();
-------------------------------------------------------*/
function buildIconCatalog(resolveAsset?: (relativePath: string) => string) {
  const rawEntries = defaultPoolData as unknown;
  if (!Array.isArray(rawEntries)) {
    throw new Error('[MachineLoader] defaultPool.json must be an array');
  }

  const resolver = resolveAsset ?? ((path: string) => path);
  const iconMeta: Record<IconId, IconMetaData> = Object.create(null);
  const baseIconWeights: Record<IconId, number> = Object.create(null);
  const iconIdSet = new Set<IconId>();

  rawEntries.forEach((entry, index) => {
    const poolEntry = entry as RawDefaultPoolEntry;
    if (!poolEntry || typeof poolEntry.id !== 'string') {
      throw new Error(`[MachineLoader] defaultPool entry #${index} is missing a string id`);
    }

    const iconId = poolEntry.id as IconId;
    iconIdSet.add(iconId);

    if (typeof poolEntry.defaultAmount !== 'number' || poolEntry.defaultAmount < 0) {
      throw new Error(`[MachineLoader] defaultPool entry "${iconId}" must include a non-negative defaultAmount`);
    }

    baseIconWeights[iconId] = poolEntry.defaultAmount;

    iconMeta[iconId] = {
      id: poolEntry.id,
      name: poolEntry.name,
      glyph: poolEntry.glyph,
      assetURL: poolEntry.assetURL ? resolver(poolEntry.assetURL) : undefined,
      baseScore: poolEntry.baseScore,
      category: poolEntry.category,
      rarity: poolEntry.rarity,
      tags: poolEntry.tags,
    };
  });

  return { iconMeta, baseIconWeights, iconIdSet };
}

/*-------------------------------------------------------
buildMachines – validate and merge machines against defaults.
Example: const machines = buildMachines(baseWeights, iconIds);
-------------------------------------------------------*/
function buildMachines(baseIconWeights: Record<IconId, number>, validIconIds: Set<IconId>) {
  const machineCandidates = machineConfigData as unknown;
  if (!Array.isArray(machineCandidates)) {
    throw new Error('[MachineLoader] selectableMachines.json must export an array');
  }

  const patternIds = collectPatternIds(patternData);
  const errors: string[] = [];
  const machines: ResolvedMachineSpec[] = [];

  machineCandidates.forEach((candidate, index) => {
    const result = validateMachineConfig(candidate, patternIds);
    if (!result.ok) {
      errors.push(`#${index}: ${result.error}`);
      return;
    }

    const spec = result.value;
    const { mergedWeights, mergeErrors } = mergeIconWeights(baseIconWeights, spec, validIconIds);

    if (mergeErrors.length > 0) {
      mergeErrors.forEach((msg) => errors.push(`#${index}: ${msg}`));
      return;
    }

    machines.push({
      spec,
      iconWeights: mergedWeights,
    });
  });

  if (errors.length > 0) {
    throw new Error(`[MachineLoader] Machine config errors:\n${errors.join('\n')}`);
  }

  return machines;
}

/*-------------------------------------------------------
collectPatternIds – gather valid pattern ids from JSON.
Example: const patternIds = collectPatternIds(patternData);
-------------------------------------------------------*/
function collectPatternIds(rawPatterns: unknown): Set<PatternId> {
  const set = new Set<PatternId>();
  if (!Array.isArray(rawPatterns)) {
    return set;
  }

  (rawPatterns as RawPatternEntry[]).forEach((entry) => {
    if (entry && typeof entry.id === 'string') {
      set.add(entry.id as PatternId);
    }
  });
  return set;
}

/*-------------------------------------------------------
mergeIconWeights – apply machine overrides/deltas to base weights.
Example: const { mergedWeights } = mergeIconWeights(baseWeights, spec, iconIds);
-------------------------------------------------------*/
function mergeIconWeights(
  baseIconWeights: Record<IconId, number>,
  spec: MachineSpec,
  validIconIds: Set<IconId>
) {
  const weights: Record<IconId, number> = { ...baseIconWeights };
  const errors: string[] = [];

  const { poolAdjustments } = spec;
  if (!poolAdjustments) {
    return { mergedWeights: weights, mergeErrors: errors };
  }

  if (poolAdjustments.overrides) {
    Object.entries(poolAdjustments.overrides).forEach(([icon, value]) => {
      const iconId = icon as IconId;
      if (!validIconIds.has(iconId)) {
        errors.push(`poolAdjustments.overrides references unknown icon "${icon}"`);
        return;
      }
      if (typeof value !== 'number' || value < 0) {
        errors.push(`poolAdjustments.overrides["${icon}"] must be a non-negative number`);
        return;
      }
      weights[iconId] = value;
    });
  }

  if (poolAdjustments.deltas) {
    Object.entries(poolAdjustments.deltas).forEach(([icon, delta]) => {
      const iconId = icon as IconId;
      if (!validIconIds.has(iconId)) {
        errors.push(`poolAdjustments.deltas references unknown icon "${icon}"`);
        return;
      }
      if (typeof delta !== 'number') {
        errors.push(`poolAdjustments.deltas["${icon}"] must be a number`);
        return;
      }
      const nextValue = (weights[iconId] ?? 0) + delta;
      weights[iconId] = nextValue < 0 ? 0 : nextValue;
    });
  }

  return { mergedWeights: weights, mergeErrors: errors };
}
