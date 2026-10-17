import type { Object3D, PerspectiveCamera, Texture } from "three";

/** A scene the host can render. `root` is added to the host's Scene and disposed on unmount. */
export type SceneController = {
  root: Object3D;
  camera: PerspectiveCamera;
  update(deltaSeconds: number, elapsedSeconds: number): void;
  /** Pointer position over the canvas, -1…1 on both axes (0,0 = centre or pointer gone). */
  setPointer?(x: number, y: number): void;
  resize?(width: number, height: number): void;
  /** True when a one-shot animation has finished. */
  done?(): boolean;
};

/** Turns text into a texture; browser code draws on a canvas, tests pass a stub. */
export type LabelFactory = (text: string, style: { color: string; background: string }) => { texture: Texture; aspect: number };
