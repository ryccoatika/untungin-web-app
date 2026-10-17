import type { BufferGeometry, Material, Object3D, Texture } from "three";

type Renderable = Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };

/**
 * Frees the GPU resources under `root`: each geometry, material and texture exactly once.
 * Not covered: ShaderMaterial uniform textures, InstancedMesh buffers, render targets,
 * and scene.background / scene.environment (dispose those where they are created).
 */
export function disposeObject(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    const item = object as Renderable;
    if (item.geometry) geometries.add(item.geometry);
    const list = Array.isArray(item.material) ? item.material : item.material ? [item.material] : [];
    for (const material of list) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value && typeof value === "object" && (value as Texture).isTexture) textures.add(value as Texture);
    }
  }

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
