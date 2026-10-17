import { CylinderGeometry, MeshStandardMaterial } from "three";
import type { Palette } from "../palette";

/** Coin materials [edge, face, face] for a cylinder. Low metalness plus a little emissive keeps them gold without an environment map. */
export function createCoinMaterials(palette: Palette): MeshStandardMaterial[] {
  const face = () =>
    new MeshStandardMaterial({ color: palette.coin, metalness: 0.1, roughness: 0.4, emissive: palette.coin, emissiveIntensity: 0.3 });
  return [
    new MeshStandardMaterial({ color: palette.coinEdge, metalness: 0.1, roughness: 0.5, emissive: palette.coinEdge, emissiveIntensity: 0.35 }),
    face(),
    face(),
  ];
}

export function coinGeometry(radius: number, thickness = 0.08): CylinderGeometry {
  return new CylinderGeometry(radius, radius, thickness, 32);
}
