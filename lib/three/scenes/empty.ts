import { AmbientLight, BoxGeometry, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera } from "three";
import type { Palette } from "../palette";
import type { SceneController } from "../scene";
import { coinGeometry, createCoinMaterials } from "./coin";

/** Light empty-state picture: an empty tray with one coin bobbing above it. */
export function createEmptyScene(palette: Palette): SceneController {
  const root = new Group();
  const camera = new PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 1.8, 5);
  camera.lookAt(0, 0.4, 0);
  root.add(new AmbientLight(0xffffff, 1.5));
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(2, 5, 3);
  root.add(sun);

  const trayMaterial = new MeshStandardMaterial({ color: palette.base, roughness: 0.8, emissive: palette.base, emissiveIntensity: 0.15 });
  const tray = new Group();
  const floor = new Mesh(new BoxGeometry(2, 0.08, 1.3), trayMaterial);
  const wall = new BoxGeometry(2, 0.3, 0.06);
  const side = new BoxGeometry(0.06, 0.3, 1.3);
  tray.add(floor);
  for (const [geometry, x, z] of [
    [wall, 0, 0.62],
    [wall, 0, -0.62],
    [side, 0.97, 0],
    [side, -0.97, 0],
  ] as const) {
    const mesh = new Mesh(geometry, trayMaterial);
    mesh.position.set(x, 0.15, z);
    tray.add(mesh);
  }
  root.add(tray);

  const coin = new Mesh(coinGeometry(0.3, 0.09), createCoinMaterials(palette));
  coin.name = "coin";
  coin.rotation.x = Math.PI / 2; // face towards the camera
  const pivot = new Group();
  pivot.add(coin);
  root.add(pivot);

  return {
    root,
    camera,
    update(_delta, elapsed) {
      pivot.position.y = 1 + Math.sin(elapsed * 2) * 0.15;
      pivot.rotation.y = Math.sin(elapsed * 1.2) * 0.9;
      root.rotation.y = Math.sin(elapsed * 0.5) * 0.15;
    },
  };
}
