export class GameLoop {
  /**
   * fixedStepCallback(fixedDt)        -> physics / character simulation at a constant 60 Hz
   * renderCallback(dt, elapsed, alpha)-> camera, UI and drawing once per display frame;
   *                                      alpha (0..1) = progress to the next fixed step,
   *                                      used to interpolate visuals so motion stays smooth
   */
  constructor(fixedStepCallback, renderCallback) {
    this.fixedStepCallback = fixedStepCallback;
    this.renderCallback = renderCallback;

    this.fixedDelta = 1 / 60;
    this.maxSubSteps = 5;
    this.accumulator = 0;
    this.lastTime = 0;
    this.elapsedTime = 0;
    this.running = false;
    this.rafId = null;

    this.loop = this.loop.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  loop(now) {
    if (!this.running) return;

    const frameDelta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.elapsedTime += frameDelta;
    this.accumulator += frameDelta;

    let steps = 0;
    while (this.accumulator >= this.fixedDelta && steps < this.maxSubSteps) {
      this.fixedStepCallback(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
      steps++;
    }
    // Drop leftover time after a long stall instead of spiralling
    if (steps === this.maxSubSteps) this.accumulator = 0;

    this.renderCallback(frameDelta, this.elapsedTime, this.accumulator / this.fixedDelta);
    this.rafId = requestAnimationFrame(this.loop);
  }
}
