import { isStuck } from "./rules";
import type { Game } from "./types";

self.onmessage = (event: MessageEvent<{ id: number; game: Game }>) => {
  self.postMessage({ id: event.data.id, stuck: isStuck(event.data.game) });
};
