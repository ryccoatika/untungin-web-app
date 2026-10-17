import { AmbientLight, DirectionalLight, Group, Mesh, PerspectiveCamera, Vector3 } from "three";
import type { Palette } from "../palette";
import type { SceneController } from "../scene";
import { coinGeometry, createCoinMaterials } from "./coin";

export const CELEBRATION_COINS = 36;
export const CELEBRATION_SECONDS = 3.4;
const GRAVITY = 9;
const CAMERA_Z = 12;
const HALF_HEIGHT = CAMERA_Z * Math.tan((45 / 2) * (Math.PI / 180));
const MAX_DELAY = 0.25;

/** Small deterministic PRNG so tests (and the look) are repeatable. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A burst of coins from the bottom centre that falls away; done after CELEBRATION_SECONDS. */
export function createCelebrationScene(palette: Palette, seed = Date.now()): SceneController {
  const random = mulberry32(seed);
  const root = new Group();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 12);
  root.add(new AmbientLight(0xffffff, 1.5));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 5, 6);
  root.add(sun);

  const geometry = coinGeometry(0.32, 0.09);
  const materials = createCoinMaterials(palette);
  // Coins start just below the frame, spread across its width, and fly up and outward; the frame width follows the canvas aspect.
  let halfW = HALF_HEIGHT;
  const coins = Array.from({ length: CELEBRATION_COINS }, () => {
    const mesh = new Mesh(geometry, materials);
    mesh.name = "coin";
    const unit = { x: random() - 0.5, z: random() - 0.5, vx: random() - 0.5, vy: random(), delay: random() * MAX_DELAY };
    const velocity = new Vector3();
    const spin = new Vector3(random() * 8, random() * 8, random() * 8);
    root.add(mesh);
    return { mesh, velocity, spin, unit, started: false };
  });
  const park = () => {
    for (const coin of coins) {
      if (coin.started) continue;
      coin.mesh.position.set(coin.unit.x * halfW * 1.6, -HALF_HEIGHT - 0.5, coin.unit.z * 2);
      // Peak stays under about y = +2.5, below the message at the top of the page.
      coin.velocity.set(coin.unit.vx * halfW * 1.6, 10 + coin.unit.vy * 1.9, 0);
    }
  };
  park();

  let time = 0;
  return {
    root,
    camera,
    resize(width, height) {
      halfW = HALF_HEIGHT * (width / height);
      park();
    },
    update(delta) {
      time += delta;
      for (const coin of coins) {
        if (!coin.started) {
          if (time < coin.unit.delay) continue;
          coin.started = true;
        }
        coin.velocity.y -= GRAVITY * delta;
        coin.mesh.position.addScaledVector(coin.velocity, delta);
        coin.mesh.rotation.x += coin.spin.x * delta;
        coin.mesh.rotation.y += coin.spin.y * delta;
        coin.mesh.rotation.z += coin.spin.z * delta;
      }
    },
    done: () => time >= CELEBRATION_SECONDS,
  };
}
