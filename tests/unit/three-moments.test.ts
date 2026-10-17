import { describe, expect, it } from "vitest";
import { disposeObject } from "@/lib/three/dispose";
import { PALETTES } from "@/lib/three/palette";
import { CELEBRATION_COINS, CELEBRATION_SECONDS, createCelebrationScene } from "@/lib/three/scenes/celebration";
import { createEmptyScene } from "@/lib/three/scenes/empty";

function run(controller: { update(d: number, e: number): void }, seconds: number) {
  for (let i = 1; i <= Math.round(seconds * 60); i++) controller.update(1 / 60, i / 60);
}

describe("createCelebrationScene", () => {
  it("bursts coins and finishes after its duration", () => {
    const burst = createCelebrationScene(PALETTES.light, 1);
    expect(burst.root.getObjectsByProperty("name", "coin")).toHaveLength(CELEBRATION_COINS);
    run(burst, CELEBRATION_SECONDS / 2);
    expect(burst.done!()).toBe(false);
    run(burst, CELEBRATION_SECONDS);
    expect(burst.done!()).toBe(true);
  });

  it("is the same for the same seed and keeps positions finite", () => {
    const a = createCelebrationScene(PALETTES.light, 7);
    const b = createCelebrationScene(PALETTES.light, 7);
    run(a, 1);
    run(b, 1);
    const positions = (scene: typeof a) => scene.root.getObjectsByProperty("name", "coin").map((coin) => coin.position.toArray());
    expect(positions(a)).toEqual(positions(b));
    expect(positions(a).flat().every(Number.isFinite)).toBe(true);
    expect(() => disposeObject(a.root)).not.toThrow();
  });
});

describe("createEmptyScene", () => {
  it("bobs a coin over an empty tray forever and disposes cleanly", () => {
    const empty = createEmptyScene(PALETTES.dark);
    const [coin] = empty.root.getObjectsByProperty("name", "coin");
    run(empty, 0.5);
    const y1 = coin.position.y;
    run(empty, 0.7);
    expect(coin.position.y).not.toBeCloseTo(y1, 3);
    expect(empty.done?.() ?? false).toBe(false);
    expect(() => disposeObject(empty.root)).not.toThrow();
  });
});
