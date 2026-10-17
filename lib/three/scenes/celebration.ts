import { AmbientLight, DirectionalLight, Group, Mesh, PerspectiveCamera, Vector3 } from "three";
import type { Palette } from "../palette";
import type { SceneController } from "../scene";
import { coinGeometry, createCoinMaterials } from "./coin";

export const CELEBRATION_COINS = 36;
export const CELEBRATION_SECONDS = 2.6;
const GRAVITY = 9;

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
  const coins = Array.from({ length: CELEBRATION_COINS }, () => {
    const mesh = new Mesh(geometry, materials);
    mesh.name = "coin";
    mesh.position.set((random() - 0.5) * 2, -5, (random() - 0.5) * 2);
    const velocity = new Vector3((random() - 0.5) * 7, 9 + random() * 5, (random() - 0.5) * 3);
    const spin = new Vector3(random() * 8, random() * 8, random() * 8);
    root.add(mesh);
    return { mesh, velocity, spin };
  });

  let time = 0;
  return {
    root,
    camera,
    update(delta) {
      time += delta;
      for (const coin of coins) {
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
