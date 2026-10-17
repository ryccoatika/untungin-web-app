import { CanvasTexture, SRGBColorSpace } from "three";
import type { LabelFactory } from "@/lib/three/scene";

const SCALE = 2;
const FONT_PX = 48 * SCALE;
const PADDING_PX = 18 * SCALE;

/** Draws `text` on a rounded pill and returns it as a texture (2× pixel density for crisp sprites). */
export const makeCanvasLabel: LabelFactory = (text, style) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const font = `600 ${FONT_PX}px ui-sans-serif, system-ui, sans-serif`;
  context.font = font;
  const width = Math.ceil(context.measureText(text).width) + PADDING_PX * 2;
  const height = FONT_PX + PADDING_PX * 2;
  canvas.width = width;
  canvas.height = height;
  context.font = font;
  context.fillStyle = style.background;
  context.beginPath();
  context.roundRect(0, 0, width, height, height / 2);
  context.fill();
  context.fillStyle = style.color;
  context.textBaseline = "middle";
  context.fillText(text, PADDING_PX, height / 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { texture, aspect: width / height };
};
