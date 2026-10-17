import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Sprite,
  SpriteMaterial,
} from "three";
import type { LineStatus } from "@/lib/calc";
import type { Palette } from "../palette";
import type { LabelFactory, SceneController } from "../scene";

export type ChartSceneBar = { name: string; valueLabel: string; value: number; status: LineStatus };

export const NAME_LABEL_MAX = 14;
const MAX_HEIGHT = 2.4;
const BAR_WIDTH = 0.7;
const BAR_GAP = 0.45;
/** Label text is drawn at this on-screen height whatever the canvas size (spec §7: numbers must be readable). */
export const LABEL_PX = 16;
const GROW_SECONDS = 0.9;
const BARS_WIDTH_SHARE = 0.8;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const shorten = (name: string) => (name.length > NAME_LABEL_MAX ? `${name.slice(0, NAME_LABEL_MAX).trimEnd()}…` : name);

/** Bars per product (height ∝ monthly contribution, losses below the floor) with value and name labels. */
export function createProfitChartScene(bars: ChartSceneBar[], palette: Palette, makeLabel: LabelFactory): SceneController {
  const root = new Group();
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  root.add(new AmbientLight(0xffffff, 1.5));
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(2, 6, 5);
  root.add(sun);

  const count = Math.max(bars.length, 1);
  const totalWidth = count * BAR_WIDTH + (count - 1) * BAR_GAP;
  const maxAbs = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1);
  const maxPositive = Math.max(...bars.map((bar) => (bar.value > 0 ? (bar.value / maxAbs) * MAX_HEIGHT : 0)), 0);
  const maxLoss = Math.max(...bars.map((bar) => (bar.value < 0 ? (-bar.value / maxAbs) * MAX_HEIGHT : 0)), 0);

  // Translucent and drawn before the bars, so a loss bar under it keeps its full colour.
  const floor = new Mesh(
    new BoxGeometry(totalWidth + 1, 0.04, 1.4),
    new MeshStandardMaterial({ color: palette.base, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  floor.name = "chart-floor";
  floor.position.y = -0.02;
  floor.renderOrder = 1;
  root.add(floor);

  const geometry = new BoxGeometry(BAR_WIDTH, 1, BAR_WIDTH);
  geometry.translate(0, 0.5, 0); // scale.y is the signed height from the floor
  const colourFor: Record<LineStatus, number> = { green: palette.positive, yellow: palette.warning, red: palette.negative };
  const style = { color: palette.labelText, background: palette.labelBackground };

  const label = (text: string, x: number) => {
    const { texture, aspect } = makeLabel(text, style);
    const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.name = "chart-label";
    sprite.userData.aspect = aspect;
    sprite.position.set(x, 0, 0.5);
    sprite.renderOrder = 10;
    root.add(sprite);
    return sprite;
  };

  const items = bars.map((bar, i) => {
    const x = -totalWidth / 2 + BAR_WIDTH / 2 + i * (BAR_WIDTH + BAR_GAP);
    const target = (bar.value / maxAbs) * MAX_HEIGHT;
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: colourFor[bar.status], roughness: 0.5, transparent: true }));
    mesh.name = "chart-bar";
    mesh.renderOrder = 2;
    mesh.position.x = x;
    mesh.scale.y = 0.001;
    root.add(mesh);
    const valueLabel = label(bar.valueLabel, x);
    const nameLabel = label(shorten(bar.name), x);
    return { mesh, target, valueLabel, nameLabel };
  });

  const tanHalfFov = Math.tan(MathUtils.degToRad(camera.fov) / 2);
  let viewHeight = 360;
  let labelHeight = 0.3; // world units, recomputed from the camera distance
  let progress = 0;
  let staggerDrop = 0; // odd bars' names drop by this much when neighbouring names would overlap

  const placeLabels = () => {
    const gap = labelHeight * 0.25;
    for (const [i, item] of items.entries()) {
      const height = item.target * progress;
      item.mesh.scale.y = Math.abs(height) < 0.001 ? 0.001 : height;
      // Value: above a gain; for a loss, just above the floor line. Name: right under the floor or the loss bar.
      item.valueLabel.position.y = height >= 0 ? height + gap + labelHeight / 2 : gap + labelHeight / 2;
      const drop = i % 2 === 1 ? staggerDrop : 0;
      item.nameLabel.position.y = Math.min(height, 0) - gap - labelHeight / 2 - drop;
    }
  };

  const fit = (aspect: number) => {
    const safeAspect = Math.max(aspect, 0.3);
    // Pixels → world units at the camera distance: labelHeight = LABEL_PX / viewHeight · 2·tan(fov/2) · distance.
    const perUnitDistance = (LABEL_PX / viewHeight) * 2 * tanHalfFov;
    const distanceForWidth = totalWidth / (BARS_WIDTH_SHARE * 2 * tanHalfFov * safeAspect);
    const room = Math.max(1.9 * tanHalfFov - 2 * perUnitDistance, 0.1);
    const solve = (extra: number) => {
      const distanceForHeight = (maxPositive + maxLoss + 0.5 + extra) / room;
      return Math.max(distanceForWidth, distanceForHeight, 3);
    };
    let distance = solve(0);
    labelHeight = perUnitDistance * Math.max(distance - 0.5, 0.5);
    // Names wider than a bar slot would collide: put every other one on a second row.
    const widestName = Math.max(...items.map((item) => item.nameLabel.userData.aspect as number), 0) * labelHeight;
    const stagger = items.length > 1 && widestName > (BAR_WIDTH + BAR_GAP) * 0.95;
    if (stagger) {
      distance = solve(labelHeight * 1.2);
      labelHeight = perUnitDistance * Math.max(distance - 0.5, 0.5);
    }
    staggerDrop = stagger ? labelHeight * 1.15 : 0;
    const gap = labelHeight * 0.25;
    const top = maxPositive + gap + labelHeight;
    const bottom = -maxLoss - gap - labelHeight - staggerDrop;
    const centreY = (top + bottom) / 2;
    camera.position.set(0, centreY + distance * 0.18, distance);
    camera.lookAt(0, centreY, 0);
    for (const item of items) {
      for (const sprite of [item.valueLabel, item.nameLabel]) {
        sprite.scale.set(labelHeight * (sprite.userData.aspect as number), labelHeight, 1);
      }
    }
    placeLabels();
  };
  fit(1.6);

  let pointerX = 0;
  const tiltTarget = () => pointerX * 0.25;
  return {
    root,
    camera,
    setPointer(x) {
      pointerX = MathUtils.clamp(x, -1, 1);
    },
    resize(width, height) {
      viewHeight = Math.max(height, 1);
      fit(width / viewHeight);
    },
    update(delta, elapsed) {
      progress = easeOutCubic(MathUtils.clamp(elapsed / GROW_SECONDS, 0, 1));
      placeLabels();
      const damping = 1 - Math.exp(-delta * 3);
      root.rotation.y += (tiltTarget() - root.rotation.y) * damping;
    },
    /** Grown and tilt settled: the host may stop drawing until the pointer moves again. */
    done: () => progress >= 1 && Math.abs(tiltTarget() - root.rotation.y) < 0.001,
  };
}
