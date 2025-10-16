import {
  MachineUnlockRegistry,
  getUnlockState,
  isMachineUnlocked,
  markUnlocked,
  acknowledgeNewBadge,
  PlayerProfile,
} from '../types/index';

export const getMachineState = (p: PlayerProfile, id: string) =>
  getUnlockState(p.unlockedMachines, id);

export const unlockMachine = (p: PlayerProfile, id: string) =>
  markUnlocked(p.unlockedMachines, id);

export const clearNewBadge = (p: PlayerProfile, id: string) =>
  acknowledgeNewBadge(p.unlockedMachines, id);
