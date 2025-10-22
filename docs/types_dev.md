## Static Configuration

| **Static Configuration** | **Config Type** | **Description** |
|:-------------------------|:---------------:|:----------------|
| Machine | JSON | `MachineSpec`: `{ id, name, gridWidth, gridHeight, reels: string[][], spinTimings, basePayoutScale, heatTuning, familyHeatFactors, patternIds, iconWeightOverrides? }`. |
| Icon | JSON | `IconMeta`: `{ id, name, glyph, asset?, baseScore, category, rarity, tags[], synergyGroup? }`. |
| WinPattern | JSON | `WinPatternSpec`: `{ id, name, detector, family, baseMultiplier, length?, offsets?, mask?, constraintTags? }`. |
| HelperFamily | constant | `HelperFamilyConfig`: `{ familyId, baseCost, chainCostFn, maxChains?, rewritePenalty }` used by heat math. |
| Difficulty | JSON | `DifficultyPreset`: `{ id, label, mapFloors, enemyMultiplier, ticketModifier, contractModifier, overspinPenalty? }`. |
| Heat Tier | JSON | `HeatTierConfig`: `{ tiers: [{ id, label, min, max?, bonuses, decayRate }], overspin: { burningStart, breakdownStart } }`. |
| Shop Actions | JSON | `ShopActionSpec`: `{ id, label, description, baseCost, costScaling?, effect, availability? }`. |
| Enemy Templates | JSON | `EnemyTemplate`: `{ id, name, tier, baseTarget, rounds, hp, traitIds[], rewards, specialRules? }`. |
| Traits | JSON | `TraitSpec`: `{ id, name, appliesTo, description, hooks, modifiers, exclusions?, rarity? }`. |

| **Static Configuration** | **Config Type** | **Description**                                                                                                                                                                                                                                                                                                                               |
|--------------------------|:---------------:|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Machine                  |       JSON      | Contains per-machine info: `Rows`, `Reels` (RowsxReels is the total grid size), `WarmUpThreshold`, `OnFireThreshold`, `WarmedUpBonus`, `OnFireBonus`, `BurningUpBonus`, `BurningUpPenalty`, `BreakdownBonus`, `BreakdownPenalty`,  `machinIconOverrides`, `machineIconDeltas`, `specialEffects`, `spinTime`, `baseHeatScalar` (Hb), `power`,  |
| Icon                     |       JSON      | Contains per-icon info: `id`, `name`, `asset` (ASCII initially, PNG later), `baseScore`, `category`, `material`, `aspect`, `rarity`, `corrupted`, `synergyGroup`, `effects`                                                                                                                                                                   |
| WinPattern               |       JSON      | Contains pattern info: `id`, `name`, `kind`,  `minLength`, `family`, `multiplier`, `mask?`                                                                                                                                                                                                                                                    |
| HelperFamily             |     constant    | Defines formulas for heat gain by helper family. //Need help filling this out                                                                                                                                                                                                                                                                 |
| Difficulty               |       JSON      | Defines heat tiers and difficulty scaling data: `id`, `name`, `mapLength`, `difficultyMult`, `baseTicketsPerWin`, `ticketBonusByPerformace`, `contractMult`, `heatDecayRate`, `overspinPenalty`, `unlockFlag`                                                                                                                                 |
| Shop Actions             |       JSON      | Contains shop item costs, ticket economy, and purchasing logic: `id`, `name`, `description`                                                                                                                                                                                                                                                   |
| Enemy Templates          |       JSON      | Defines enemy data: health, modifiers, rewards, and contract payouts: `id`, `name`, `tier`, `monsterMult`, `hpPercent`, `baseHP`, `roundsBase`, `damageOnRun`, `overspinHeatGain`, `traits`                                                                                                                                                   |
| Traits                   |       JSON      | Contains map and enemy traits for path generation and modifiers: `id`, `name`, `appliesTo`, `phase`, `rarity` modifiers: {`payoutMultiplier`, `heatDelta`, `patternBlocklist`, `chanceNoScore`}                                                                                                                                               |

---

## Runtime State

| **Runtime State** | **Runtime Info** |
|:------------------|:-----------------|
| Spin State | Enum: `preSpin`, `spinning`, `slowing`, `preScore`, `scoring`, `postScore`, `logging` plus `elapsed`, `spinId`. |
| Round State | `{ phase: 'awaitingChoice' \| 'safe' \| 'risky' \| 'resolved', spinsRemaining, multiplier, choiceMadeAt }`. |
| Fight State | `{ status: 'active' \| 'overspin' \| 'run' \| 'defeat' \| 'victory', roundIndex, totalCredits, heat }`. |
| Heat State | `{ value, tierId, breakdown: { wins, helpers, rewrites }, overspin?: boolean }`. |
| Tickets | Number that resets per run; tracked on RunState. |
| Contracts | Number that persists between runs. |
| Run State | `{ runId, machineId, difficultyId, seed, currentNodeId, tickets, contracts, health, heatState, totalCredits, log[] }`. |
| Map Progress | `{ nodes: Record<NodeId, MapNodeStatus>, currentFloor, pathTaken[] }`. |
| Rewrite Event | `{ position: { x, y }, fromIcon, toIcon, familyId, order }` per helper execution. |
| Helper Execution | `{ familyId, chainIndex, resultSummary }` used for heat math/UI. |

---

## Transient Results / Logs

| **Transient Result** | **Input** | **Output** |
|:----------------------|:----------|:------------|
| SpinOutcome | Spin state + scoring data | `{ spinId, grid, payouts[], heatBreakdown, helperEvents[], logLines[], timestamp }` → UI + save. |
| RoundResult | Round state at resolution | `{ roundIndex, mode, spinsUsed, creditsGained, heatEnd, logLines[], timestamp }` → UI + save. |
| FightResult | Fight state at end | `{ nodeId, outcome, totalCredits, ticketsEarned, heat, damageTaken }` → UI + save. |
| HeatGainValue | Heat state update | `{ wins, helpers, rewrites, total }` → displayed + folded into RunState. |
| NodeSummary | Completed encounter or shop | `{ nodeId, nodeType, result, rewards, heatAfter, ticketsAfter, timestamp }` → appended to RunState history. |

---
