import type { NetworkMode } from "@/lib/types";

const STORAGE_KEY = "campus_network_mode";
type Listener = () => void;

let mode: NetworkMode = "online";
const listeners = new Set<Listener>();

export function getNetworkMode(): NetworkMode {
  return mode;
}

export function setNetworkMode(next: NetworkMode) {
  mode = next;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  listeners.forEach((l) => l());
}

export function subscribeNetworkMode(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateNetworkModeFromStorage() {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(STORAGE_KEY) as NetworkMode | null;
  if (stored && stored !== mode) {
    mode = stored;
    listeners.forEach((l) => l());
  }
}
