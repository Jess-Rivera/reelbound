import { IconId } from "../types/index";

// Default icon pool for machines that don't specify their own

// e.g., src/data/defaultPool.ts
export const defaultPool: Partial<Record<IconId, number>> = {
    cherry: 19,
    lemon: 19,
    melon: 19,
    grape: 19,
    bell: 10,
    seven: 4,
    bar: 4,
    diamond: 3,
    star: 3
};
