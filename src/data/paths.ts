// src/data/paths.ts
export const BASE = import.meta.env.BASE_URL; // "/" locally, "/reelbound/" on Pages
export const asset = (p: string) => `${BASE}assets/${p}`;
