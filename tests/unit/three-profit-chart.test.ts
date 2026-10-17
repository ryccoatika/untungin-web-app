import { Texture } from "three";
import { describe, expect, it } from "vitest";
import { disposeObject } from "@/lib/three/dispose";
import { PALETTES } from "@/lib/three/palette";
import { createProfitChartScene, LABEL_PX, NAME_LABEL_MAX, type ChartSceneBar } from "@/lib/three/scenes/profit-chart";
import type { LabelFactory } from "@/lib/three/scene";

const labels: string[] = [];
const stubLabel: LabelFactory = (text) => {
  labels.push(text);
  return { texture: new Texture(), aspect: 3 };
};

function settle(controller: ReturnType<typeof createProfitChartScene>) {
  for (let i = 1; i <= 180; i++) controller.update(1 / 60, i / 60);
}

const bar = (name: string, value: number, status: ChartSceneBar["status"] = "green"): ChartSceneBar => ({
  name,
  value,
  valueLabel: `Rp${value}`,
  status,
});

describe("createProfitChartScene", () => {
  it("draws one bar with a value label and a name label per product", () => {
    labels.length = 0;
    const chart = createProfitChartScene([bar("Es teh", 470_000), bar("Kopi", 120_000, "yellow")], PALETTES.light, stubLabel);
    settle(chart);
    expect(chart.root.getObjectsByProperty("name", "chart-bar")).toHaveLength(2);
    expect(chart.root.getObjectsByProperty("name", "chart-label")).toHaveLength(4);
    expect(labels).toEqual(expect.arrayContaining(["Rp470000", "Es teh", "Rp120000", "Kopi"]));
  });

  it("scales bars to the largest value and sends losses below the floor", () => {
    const chart = createProfitChartScene([bar("A", 400), bar("B", 200), bar("C", -400, "red")], PALETTES.light, stubLabel);
    settle(chart);
    const [a, b, c] = chart.root.getObjectsByProperty("name", "chart-bar");
    expect(b.scale.y).toBeCloseTo(a.scale.y / 2, 3);
    expect(c.scale.y).toBeCloseTo(-a.scale.y, 3);
  });

  it("colours bars by status", () => {
    const chart = createProfitChartScene(
      [bar("A", 3), bar("B", 2, "yellow"), bar("C", 1, "red")],
      PALETTES.dark,
      stubLabel,
    );
    const colours = chart.root
      .getObjectsByProperty("name", "chart-bar")
      .map((mesh) => ((mesh as unknown as { material: { color: { getHex(): number } } }).material.color.getHex()));
    expect(colours).toEqual([PALETTES.dark.positive, PALETTES.dark.warning, PALETTES.dark.negative]);
  });

  it("shortens long names", () => {
    labels.length = 0;
    createProfitChartScene([bar("Es kopi hitam spesial racikan senja", 10)], PALETTES.light, stubLabel);
    const name = labels.find((text) => text.startsWith("Es kopi"))!;
    expect(name.length).toBeLessThanOrEqual(NAME_LABEL_MAX + 1);
    expect(name.endsWith("…")).toBe(true);
  });

  it("handles all-zero values and a single bar without NaN", () => {
    const chart = createProfitChartScene([bar("Nol", 0)], PALETTES.light, stubLabel);
    settle(chart);
    const [only] = chart.root.getObjectsByProperty("name", "chart-bar");
    expect(Number.isFinite(only.scale.y)).toBe(true);
    expect(Number.isFinite(chart.camera.position.z)).toBe(true);
    expect(() => disposeObject(chart.root)).not.toThrow();
  });

  it("keeps labels at a constant on-screen height at any canvas size", () => {
    const bars = [bar("A", 400), bar("B", 200), bar("C", -100, "red")];
    for (const [width, height] of [[360, 288], [1280, 320], [768, 320]]) {
      const chart = createProfitChartScene(bars, PALETTES.light, stubLabel);
      chart.camera.aspect = width / height;
      chart.resize!(width, height);
      settle(chart);
      const [label] = chart.root.getObjectsByProperty("name", "chart-label");
      const distance = chart.camera.position.z - label.position.z;
      const px = (label.scale.y / (2 * Math.tan((chart.camera.fov * Math.PI) / 360) * distance)) * height;
      expect(px).toBeGreaterThanOrEqual(LABEL_PX - 1.5);
      expect(px).toBeLessThanOrEqual(LABEL_PX + 2);
    }
  });

  it("puts each name right under its own bar, not at the depth of another bar's loss", () => {
    const chart = createProfitChartScene([bar("A", 400), bar("B", -400, "red")], PALETTES.light, stubLabel);
    settle(chart);
    const labelObjects = chart.root.getObjectsByProperty("name", "chart-label");
    const nameA = labelObjects[1];
    const nameB = labelObjects[3];
    const [barA, barB] = chart.root.getObjectsByProperty("name", "chart-bar");
    expect(nameA.position.y).toBeLessThan(0);
    expect(nameA.position.y).toBeGreaterThan(-1);
    expect(nameB.position.y).toBeLessThan(barB.scale.y);
    expect(nameB.position.y).toBeGreaterThan(barB.scale.y - 1);
    expect(barA.scale.y).toBeGreaterThan(0);
  });

  it("draws a translucent floor so loss bars show through", () => {
    const chart = createProfitChartScene([bar("A", 1)], PALETTES.light, stubLabel);
    const [floor] = chart.root.getObjectsByProperty("name", "chart-floor");
    const material = (floor as unknown as { material: { transparent: boolean; opacity: number } }).material;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(0.5);
  });
});
