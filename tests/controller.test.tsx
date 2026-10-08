// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useKlondike } from "../src/hooks/useKlondike";
import { sfx } from "../src/fx/audio";

vi.mock("../src/fx/audio", () => ({ sfx: { flick: vi.fn(), deal: vi.fn(), ui: vi.fn() } }));
vi.mock("../src/fx/effects", () => ({
  boardApi: {},
  fb: { stopWin: vi.fn(), draw: vi.fn(), undo: vi.fn(), hint: vi.fn(), invalid: vi.fn(), stuck: vi.fn() },
}));
let api: ReturnType<typeof useKlondike>;
let root: Root;
let host: HTMLDivElement;
let reduce = false;
class TestWorker {
  static latest: TestWorker;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  messages: { id: number }[] = [];
  terminated = false;
  constructor() { TestWorker.latest = this; }
  postMessage(message: { id: number }) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  reply(id: number) { this.onmessage?.({ data: { id, stuck: true } } as MessageEvent); }
}
function Harness() {
  api = useKlondike(() => {}, () => "TEST");
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: reduce }));
  vi.stubGlobal("Worker", TestWorker);
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  reduce = false;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("synchronizes deal sounds and cancels the previous deal on restart", () => {
  act(() => api.startGame({ seed: 1, draw: 1 }));
  act(() => vi.advanceTimersByTime(1360));
  expect(sfx.deal).toHaveBeenCalledTimes(1);
  act(() => api.startGame({ seed: 2, draw: 3 }));
  act(() => vi.advanceTimersByTime(3050));
  expect(api.stage).toBe(3);
  expect(api.game.seed).toBe(2);
  expect(sfx.deal).toHaveBeenCalledTimes(29);
});
it("restores the exact deck on undo and ignores actions while paused", () => {
  reduce = true;
  act(() => api.startGame({ seed: 42, draw: 3 }));
  const original = api.game;
  act(() => api.draw());
  expect(api.game.waste).toHaveLength(3);
  act(() => api.undo());
  expect(api.game).toEqual(original);
  act(() => api.pause());
  act(() => api.draw());
  expect(api.game).toEqual(original);
  expect(api.phase).toBe("paused");
  act(() => api.resume());
  act(() => api.draw());
  expect(api.game.waste).toHaveLength(3);
});
it("skips the decorative deal when reduced motion is enabled", () => {
  reduce = true;
  act(() => api.startGame({ seed: 1, draw: 1 }));
  expect(api.stage).toBe(3);
  expect(sfx.deal).not.toHaveBeenCalled();
});
it("stops game timers and stale deal sounds when unmounted", () => {
  act(() => api.startGame({ seed: 7, draw: 1 }));
  act(() => root.unmount());
  expect(vi.getTimerCount()).toBe(0);
  expect(TestWorker.latest.terminated).toBe(true);
  act(() => vi.advanceTimersByTime(10000));
  expect(sfx.deal).not.toHaveBeenCalled();
  root = createRoot(host);
});
it("ignores stale worker results and results delivered during pause", () => {
  reduce = true;
  act(() => api.startGame({ seed: 42, draw: 1 }));
  act(() => vi.advanceTimersByTime(1100));
  const worker = TestWorker.latest;
  const oldId = worker.messages.at(-1)!.id;
  act(() => api.draw());
  act(() => vi.advanceTimersByTime(1100));
  act(() => worker.reply(oldId));
  expect(api.phase).toBe("playing");
  act(() => api.pause());
  act(() => worker.reply(worker.messages.at(-1)!.id));
  expect(api.phase).toBe("paused");
  act(() => api.resume());
  act(() => vi.advanceTimersByTime(1100));
  act(() => worker.reply(worker.messages.at(-1)!.id));
  expect(api.phase).toBe("stuck");
});
