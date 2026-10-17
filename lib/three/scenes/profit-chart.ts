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
const LABEL_HEIGHT = 0.32;
const GROW_SECONDS = 0.9;

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
  const hasLoss = bars.some((bar) => bar.value < 0);

  const floor = new Mesh(new BoxGeometry(totalWidth + 1, 0.04, 1.4), new MeshStandardMaterial({ color: palette.base, transparent: true, opacity: 0.45, depthWrite: false }));
  floor.position.y = -0.02;
  floor.renderOrder = 1; // translucent, so loss bars below it show through when seen from above
  root.add(floor);

  const geometry = new BoxGeometry(BAR_WIDTH, 1, BAR_WIDTH);
  geometry.translate(0, 0.5, 0); // scale.y is the signed height from the floor
  const colourFor: Record<LineStatus, number> = { green: palette.positive, yellow: palette.warning, red: palette.negative };
  const style = { color: palette.labelText, background: palette.labelBackground };

  const label = (text: string, x: number, y: number) => {
    const { texture, aspect } = makeLabel(text, style);
    const sprite = new Sprite(new SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.name = "chart-label";
    sprite.scale.set(LABEL_HEIGHT * aspect, LABEL_HEIGHT, 1);
    sprite.position.set(x, y, 0.5);
    sprite.renderOrder = 10;
    root.add(sprite);
    return sprite;
  };

  const items = bars.map((bar, i) => {
    const x = -totalWidth / 2 + BAR_WIDTH / 2 + i * (BAR_WIDTH + BAR_GAP);
    const target = (bar.value / maxAbs) * MAX_HEIGHT;
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: colourFor[bar.status], roughness: 0.5 }));
    mesh.name = "chart-bar";
    mesh.position.x = x;
    mesh.scale.y = 0.001;
    root.add(mesh);
    const valueLabel = label(bar.valueLabel, x, 0);
    label(shorten(bar.name), x, hasLoss ? -MAX_HEIGHT - 0.35 : -0.35);
    return { mesh, target, valueLabel };
  });

  const fit = (aspect: number) => {
    const span = Math.max(totalWidth + 1.2, 4);
    const verticalSpan = (hasLoss ? MAX_HEIGHT * 2 : MAX_HEIGHT) + 1.4;
    const fov = MathUtils.degToRad(camera.fov);
    const distanceForWidth = span / 2 / Math.tan(fov / 2) / Math.max(aspect, 0.3);
    const distanceForHeight = verticalSpan / 2 / Math.tan(fov / 2);
    const distance = Math.max(distanceForWidth, distanceForHeight) * 1.05;
    const centreY = hasLoss ? 0 : MAX_HEIGHT / 2 - 0.2;
    camera.position.set(0, centreY + distance * 0.18, distance);
    camera.lookAt(0, centreY, 0);
  };
  fit(1.6);

  let pointerX = 0;
  return {
    root,
    camera,
    setPointer(x) {
      pointerX = MathUtils.clamp(x, -1, 1);
    },
    resize(width, height) {
      fit(width / height);
    },
    update(delta, elapsed) {
      const progress = easeOutCubic(MathUtils.clamp(elapsed / GROW_SECONDS, 0, 1));
      for (const item of items) {
        const height = item.target * progress;
        item.mesh.scale.y = Math.abs(height) < 0.001 ? 0.001 : height;
        item.valueLabel.position.y = height >= 0 ? height + 0.3 : height - 0.3;
      }
      const damping = 1 - Math.exp(-delta * 3);
      root.rotation.y += (pointerX * 0.25 - root.rotation.y) * damping;
    },
  };
}
