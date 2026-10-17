import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { chooseRenderMode } from "@/lib/three/capability";
import { disposeObject } from "@/lib/three/dispose";
import { PALETTES } from "@/lib/three/palette";
import { RenderLoop } from "@/lib/three/render-loop";

const strong = { reducedMotion: false, webgl: true, hardwareConcurrency: 8, deviceMemory: 8 };

describe("chooseRenderMode", () => {
  it("gives 3D to a capable device", () => {
    expect(chooseRenderMode(strong)).toBe("3d");
    expect(chooseRenderMode({ reducedMotion: false, webgl: true })).toBe("3d"); // signals unavailable
  });

  it.each([
    ["reduced motion", { ...strong, reducedMotion: true }],
    ["no WebGL", { ...strong, webgl: false }],
    ["4 cores", { ...strong, hardwareConcurrency: 4 }],
    ["2 cores", { ...strong, hardwareConcurrency: 2 }],
    ["4 GB memory", { ...strong, deviceMemory: 4 }],
    ["0.5 GB memory", { ...strong, deviceMemory: 0.5 }],
  ])("falls back to static for %s", (_label, signals) => {
    expect(chooseRenderMode(signals)).toBe("static");
  });

  it("keeps 3D at 5 cores and 8 GB", () => {
    expect(chooseRenderMode({ ...strong, hardwareConcurrency: 5 })).toBe("3d");
  });
});

describe("disposeObject", () => {
  it("disposes every geometry, material and texture once, including shared ones", () => {
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const other = new THREE.SpriteMaterial({ map: new THREE.Texture() });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material, other]), new THREE.Sprite(other));
    const spies = [geometry, texture, material, other, other.map!].map((item) => vi.spyOn(item, "dispose"));

    disposeObject(root);

    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });

  it("handles an empty group", () => {
    expect(() => disposeObject(new THREE.Group())).not.toThrow();
  });
});

describe("RenderLoop", () => {
  function fakeFrames() {
    const queue = new Map<number, (now: number) => void>();
    let next = 1;
    return {
      raf: (cb: (now: number) => void) => {
        queue.set(next, cb);
        return next++;
      },
      caf: (id: number) => void queue.delete(id),
      /** Runs every pending callback at time `now` (ms). */
      flush(now: number) {
        const pending = [...queue.values()];
        queue.clear();
        for (const cb of pending) cb(now);
      },
      get size() {
        return queue.size;
      },
    };
  }

  it("calls the frame with delta and elapsed seconds while running", () => {
    const frames = fakeFrames();
    const frame = vi.fn();
    const loop = new RenderLoop(frame, frames.raf, frames.caf);
    loop.start();
    frames.flush(1000);
    frames.flush(1050);
    expect(frame).toHaveBeenNthCalledWith(1, 0, 0);
    expect(frame.mock.calls[1][0]).toBeCloseTo(0.05);
    expect(frame.mock.calls[1][1]).toBeCloseTo(0.05);
  });

  it("caps a long pause to 0.1 s so animations do not jump", () => {
    const frames = fakeFrames();
    const frame = vi.fn();
    const loop = new RenderLoop(frame, frames.raf, frames.caf);
    loop.start();
    frames.flush(0);
    frames.flush(5000);
    expect(frame.mock.calls[1][0]).toBeCloseTo(0.1);
  });

  it("pauses when off-screen or when the tab is hidden, and resumes", () => {
    const frames = fakeFrames();
    const loop = new RenderLoop(vi.fn(), frames.raf, frames.caf);
    loop.start();
    expect(loop.active).toBe(true);
    loop.setVisible(false);
    expect(loop.active).toBe(false);
    expect(frames.size).toBe(0);
    loop.setVisible(true);
    loop.setPageVisible(false);
    expect(loop.active).toBe(false);
    loop.setPageVisible(true);
    expect(loop.active).toBe(true);
    loop.stop();
    expect(loop.active).toBe(false);
    expect(frames.size).toBe(0);
  });
});

describe("RenderLoop resume and restart", () => {
  it("starts the next frame with delta 0 after a pause and resume", () => {
    const queue = new Map<number, (now: number) => void>();
    let next = 1;
    const raf = (cb: (now: number) => void) => (queue.set(next, cb), next++);
    const caf = (id: number) => void queue.delete(id);
    const flush = (now: number) => {
      const pending = [...queue.values()];
      queue.clear();
      for (const cb of pending) cb(now);
    };
    const frame = vi.fn();
    const loop = new RenderLoop(frame, raf, caf);
    loop.start();
    flush(0);
    flush(50);
    loop.setVisible(false);
    loop.setVisible(true);
    flush(10_000);
    expect(frame.mock.calls[2][0]).toBe(0);
  });

  it("does not schedule two frames when started twice", () => {
    const raf = vi.fn(() => 1);
    const loop = new RenderLoop(vi.fn(), raf, vi.fn());
    loop.start();
    loop.start();
    expect(raf).toHaveBeenCalledTimes(1);
  });
});

describe("PALETTES", () => {
  it("has the same keys for light and dark", () => {
    expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
  });
});
