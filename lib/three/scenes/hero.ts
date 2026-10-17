import {
  BoxGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
} from "three";
import type { Palette } from "../palette";
import type { SceneController } from "../scene";
import { coinGeometry, createCoinMaterials } from "./coin";

/** Bar heights in scene units, rising left to right ("profit goes up"). */
export const HERO_BAR_HEIGHTS = [0.7, 1.15, 1.6, 2.2] as const;
export const HERO_COINS = 5;

const BAR_WIDTH = 0.62;
const BAR_GAP = 0.32;
const GROW_SECONDS = 1.1;
const GROW_STAGGER = 0.18;
const DROP_HEIGHT = 4.6;
const GRAVITY = 6;
const MAX_TILT_Y = 0.35;
const MAX_TILT_X = 0.12;

const COIN_RADIUS = 0.26;
const COIN_THICKNESS = 0.08;
const COIN_TILT = 0.4;
const COIN_GAP = 0.02;
/** Centre height of a resting coin above its bar top: the tilted disc's lowest point plus a small gap. */
export const COIN_CLEARANCE =
  COIN_RADIUS * Math.sin(COIN_TILT) + (COIN_THICKNESS / 2) * Math.cos(COIN_TILT) + COIN_GAP;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Landing hero (user decision): bars grow, coins drop onto them, the group tilts toward the pointer. */
export function createHeroScene(palette: Palette): SceneController {
  const root = new Group();
  const camera = new PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 2.4, 8);
  camera.lookAt(0, 1.1, 0);

  const ambient = new HemisphereLight(0xffffff, 0x9ca3af, 1.2);
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 6, 4);
  root.add(ambient, sun);

  const totalWidth = HERO_BAR_HEIGHTS.length * BAR_WIDTH + (HERO_BAR_HEIGHTS.length - 1) * BAR_GAP;
  const base = new Mesh(new BoxGeometry(totalWidth + 0.9, 0.12, 1.5), new MeshStandardMaterial({ color: palette.base }));
  base.position.y = -0.06;
  root.add(base);

  const barGeometry = new BoxGeometry(BAR_WIDTH, 1, BAR_WIDTH);
  barGeometry.translate(0, 0.5, 0); // grow from the floor: scale.y is the height
  const barMaterial = new MeshStandardMaterial({ color: palette.bar, roughness: 0.45 });
  const bars = HERO_BAR_HEIGHTS.map((_, i) => {
    const bar = new Mesh(barGeometry, barMaterial);
    bar.name = "bar";
    bar.position.x = -totalWidth / 2 + BAR_WIDTH / 2 + i * (BAR_WIDTH + BAR_GAP);
    bar.scale.y = 0.001;
    root.add(bar);
    return bar;
  });

  const geometry = coinGeometry(COIN_RADIUS, COIN_THICKNESS);
  const materials = createCoinMaterials(palette);
  type Coin = { mesh: Mesh; bar: number; level: number; velocity: number; delay: number; resting: number };
  const coins: Coin[] = Array.from({ length: HERO_COINS }, (_, i) => {
    const mesh = new Mesh(geometry, materials);
    mesh.name = "coin";
    mesh.rotation.x = COIN_TILT;
    root.add(mesh);
    return { mesh, bar: i % bars.length, level: 0, velocity: 0, delay: i * 0.55, resting: 0 };
  });
  /** Send a coin above the least-used bar; a coin sharing a bar stacks on the one already there. */
  const placeAbove = (coin: Coin, preferred: number) => {
    const load = (bar: number) => coins.filter((other) => other !== coin && other.bar === bar).length;
    let best = preferred;
    for (let k = 0; k < bars.length; k++) {
      const candidate = (preferred + k) % bars.length;
      if (load(candidate) < load(best)) best = candidate;
    }
    coin.bar = best;
    coin.level = load(best);
    coin.mesh.userData.bar = best;
    coin.mesh.position.set(bars[best].position.x, DROP_HEIGHT, 0);
    coin.velocity = 0;
    coin.resting = 0;
    coin.mesh.visible = false;
  };
  coins.forEach((coin) => placeAbove(coin, coin.bar));

  let pointerX = 0;
  let pointerY = 0;

  return {
    root,
    camera,
    setPointer(x, y) {
      pointerX = MathUtils.clamp(x, -1, 1);
      pointerY = MathUtils.clamp(y, -1, 1);
    },
    update(delta, elapsed) {
      bars.forEach((bar, i) => {
        const progress = MathUtils.clamp((elapsed - i * GROW_STAGGER) / GROW_SECONDS, 0, 1);
        bar.scale.y = Math.max(0.001, HERO_BAR_HEIGHTS[i] * easeOutCubic(progress));
      });

      for (const coin of coins) {
        if (elapsed < coin.delay) continue;
        coin.mesh.visible = true;
        const top = bars[coin.bar].scale.y + COIN_CLEARANCE + coin.level * (COIN_THICKNESS + 0.05);
        if (coin.resting > 0) {
          coin.resting += delta;
          if (coin.resting > 0.9) {
            placeAbove(coin, (coin.bar + 1) % bars.length);
          }
          continue;
        }
        coin.velocity += GRAVITY * delta;
        coin.mesh.position.y = Math.max(top, coin.mesh.position.y - coin.velocity * delta);
        coin.mesh.rotation.y += delta * 4;
        if (coin.mesh.position.y <= top) coin.resting = delta;
      }

      const sway = Math.sin(elapsed * 0.4) * 0.05;
      const damping = 1 - Math.exp(-delta * 4);
      root.rotation.y += (pointerX * MAX_TILT_Y + sway - root.rotation.y) * damping;
      root.rotation.x += (-pointerY * MAX_TILT_X - root.rotation.x) * damping;
    },
  };
}
