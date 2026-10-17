import { describe, expect, it } from "vitest";
import { disposeObject } from "@/lib/three/dispose";
import { PALETTES } from "@/lib/three/palette";
import { createHeroScene, HERO_BAR_HEIGHTS, HERO_COINS } from "@/lib/three/scenes/hero";

function step(controller: ReturnType<typeof createHeroScene>, seconds: number) {
  let elapsed = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    elapsed += 1 / 60;
    controller.update(1 / 60, elapsed);
  }
}

describe("createHeroScene", () => {
  it("has one bar per height and the coins", () => {
    const hero = createHeroScene(PALETTES.light);
    const bars = hero.root.getObjectsByProperty("name", "bar");
    const coins = hero.root.getObjectsByProperty("name", "coin");
    expect(bars).toHaveLength(HERO_BAR_HEIGHTS.length);
    expect(coins).toHaveLength(HERO_COINS);
  });

  it("grows the bars to their heights, rising left to right", () => {
    const hero = createHeroScene(PALETTES.light);
    step(hero, 3);
    const heights = hero.root.getObjectsByProperty("name", "bar").map((bar) => bar.scale.y);
    heights.forEach((height, i) => expect(height).toBeCloseTo(HERO_BAR_HEIGHTS[i], 2));
    expect([...heights].sort((a, b) => a - b)).toEqual(heights);
  });

  it("keeps coins inside the scene while they fall and respawn", () => {
    const hero = createHeroScene(PALETTES.light);
    for (let i = 0; i < 10; i++) {
      step(hero, 1);
      for (const coin of hero.root.getObjectsByProperty("name", "coin")) {
        expect(coin.position.y).toBeGreaterThanOrEqual(0);
        expect(coin.position.y).toBeLessThanOrEqual(6);
        expect(Number.isFinite(coin.position.x)).toBe(true);
      }
    }
  });

  it("tilts toward the pointer and back", () => {
    const hero = createHeroScene(PALETTES.light);
    hero.setPointer!(1, 0);
    step(hero, 2);
    expect(hero.root.rotation.y).toBeGreaterThan(0.15);
    hero.setPointer!(0, 0);
    step(hero, 3);
    expect(Math.abs(hero.root.rotation.y)).toBeLessThan(0.1);
  });

  it("never finishes and disposes cleanly", () => {
    const hero = createHeroScene(PALETTES.dark);
    step(hero, 1);
    expect(hero.done?.() ?? false).toBe(false);
    expect(() => disposeObject(hero.root)).not.toThrow();
  });
});
