import {
  AmbientLight,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
} from "three";
import type { Palette } from "../palette";
import type { SceneController } from "../scene";

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

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Landing hero (user decision): bars grow, coins drop onto them, the group tilts toward the pointer. */
export function createHeroScene(palette: Palette): SceneController {
  const root = new Group();
  const camera = new PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 2.4, 8);
  camera.lookAt(0, 1.1, 0);

  const ambient = new AmbientLight(0xffffff, 1.4);
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

  const coinGeometry = new CylinderGeometry(0.26, 0.26, 0.08, 32);
  const coinMaterials = [
    new MeshStandardMaterial({ color: palette.coinEdge, metalness: 0.6, roughness: 0.35 }),
    new MeshStandardMaterial({ color: palette.coin, metalness: 0.5, roughness: 0.3 }),
    new MeshStandardMaterial({ color: palette.coin, metalness: 0.5, roughness: 0.3 }),
  ];
  const coins = Array.from({ length: HERO_COINS }, (_, i) => {
    const coin = new Mesh(coinGeometry, coinMaterials);
    coin.name = "coin";
    coin.rotation.x = Math.PI / 2.4;
    root.add(coin);
    return { mesh: coin, bar: i % bars.length, velocity: 0, delay: i * 0.55, resting: 0 };
  });
  const placeAbove = (coin: (typeof coins)[number]) => {
    coin.mesh.position.set(bars[coin.bar].position.x, DROP_HEIGHT, 0);
    coin.velocity = 0;
    coin.resting = 0;
    coin.mesh.visible = false;
  };
  coins.forEach(placeAbove);

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
        const top = bars[coin.bar].scale.y + 0.05;
        if (coin.resting > 0) {
          coin.resting += delta;
          if (coin.resting > 0.9) {
            coin.bar = (coin.bar + 1) % bars.length;
            placeAbove(coin);
          }
          continue;
        }
        coin.velocity += GRAVITY * delta;
        coin.mesh.position.y = Math.max(top, coin.mesh.position.y - coin.velocity * delta);
        coin.mesh.rotation.z += delta * 4;
        if (coin.mesh.position.y <= top) coin.resting = delta;
      }

      const sway = Math.sin(elapsed * 0.4) * 0.05;
      const damping = 1 - Math.exp(-delta * 4);
      root.rotation.y += (pointerX * MAX_TILT_Y + sway - root.rotation.y) * damping;
      root.rotation.x += (-pointerY * MAX_TILT_X - root.rotation.x) * damping;
    },
  };
}
