import type { RunProgress } from "../game/run/runManager";

const STORAGE_KEY = "gamev3.run.progress";

/**
 * Persists the current run by serializing it into JSON and storing it in
 * whichever storage mechanism is available (browser localStorage or a simple
 * in-memory fallback for non-browser environments).
 */
export function saveRun(progress: RunProgress): void {
    const storage = getStorage();
    if (!storage) return;

    try {
        const payload = JSON.stringify(progress);
        storage.setItem(STORAGE_KEY, payload);
    } catch (err) {
        console.error("[saveAdapter] Failed to save run:", err);
    }
}

/**
 * Attempts to read the previously saved run. Returns the parsed RunProgress
 * object if successful, otherwise null when nothing was saved or parsing fails.
 */
export function loadRun(): RunProgress | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
        const stored = storage.getItem(STORAGE_KEY);
        if (!stored) return null;
        return JSON.parse(stored) as RunProgress;
    } catch (err) {
        console.error("[saveAdapter] Failed to load run:", err);
        return null;
    }
}

type StorageLike = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
} | null;

const memoryStore: NonNullable<StorageLike> = (() => {
    const cache: Record<string, string> = {};
    return {
        getItem(key: string) {
            return key in cache ? cache[key] : null;
        },
        setItem(key: string, value: string) {
            cache[key] = value;
        },
    };
})();

function getStorage(): StorageLike {
    const globalWithStorage = globalThis as { localStorage?: StorageLike };
    if (globalWithStorage.localStorage) {
        return globalWithStorage.localStorage;
    }

    return memoryStore;
}
