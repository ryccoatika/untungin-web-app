type Frame = (deltaSeconds: number, elapsedSeconds: number) => void;
type RequestFrame = (callback: (now: number) => void) => number;
type CancelFrame = (handle: number) => void;

/** Longest step one frame may take, so a tab coming back does not make animations jump. */
const MAX_DELTA = 0.1;

/**
 * requestAnimationFrame loop that runs only while started, on screen and in a visible tab
 * (spec §7). The host component feeds visibility from IntersectionObserver and visibilitychange.
 */
export class RenderLoop {
  private running = false;
  private visible = true;
  private pageVisible = true;
  private handle: number | null = null;
  private last = -1;
  private elapsed = 0;

  constructor(
    private readonly frame: Frame,
    private readonly raf: RequestFrame = (callback) => requestAnimationFrame(callback),
    private readonly caf: CancelFrame = (handle) => cancelAnimationFrame(handle),
  ) {}

  get active(): boolean {
    return this.handle !== null;
  }

  start() {
    this.running = true;
    this.sync();
  }

  stop() {
    this.running = false;
    this.sync();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.sync();
  }

  setPageVisible(visible: boolean) {
    this.pageVisible = visible;
    this.sync();
  }

  private sync() {
    const shouldRun = this.running && this.visible && this.pageVisible;
    if (shouldRun && this.handle === null) {
      this.last = -1;
      this.handle = this.raf(this.tick);
    } else if (!shouldRun && this.handle !== null) {
      this.caf(this.handle);
      this.handle = null;
    }
  }

  private tick = (now: number) => {
    const delta = this.last < 0 ? 0 : Math.min((now - this.last) / 1000, MAX_DELTA);
    this.last = now;
    this.elapsed += delta;
    this.handle = this.raf(this.tick);
    this.frame(delta, this.elapsed);
  };
}
