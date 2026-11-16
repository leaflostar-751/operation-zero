export class DebugOverlay {
  constructor(renderer, physics, getTierNameCallback) {
    this.renderer = renderer;
    this.physics = physics;
    this.getTierNameCallback = getTierNameCallback;

    this.visible = false;
    this.frames = 0;
    this.accumTime = 0;
    this.currentFps = 60;
    this.currentFrameTime = 16.6;

    this.el = document.createElement('div');
    this.el.id = 'debug-overlay';
    this.el.className = 'overlay-panel hidden';
    this.el.innerHTML = `
      <div class="panel-header">
        <span>F3 // TELEMETRY</span>
        <button id="dbg-collider-btn" class="panel-btn" style="padding:2px 6px;font-size:0.7rem;">Colliders: OFF</button>
      </div>
      <div class="debug-row"><span>FPS:</span><span id="dbg-fps" class="debug-val">--</span></div>
      <div class="debug-row"><span>Frame Time:</span><span id="dbg-ms" class="debug-val">-- ms</span></div>
      <div class="debug-row"><span>Quality Tier:</span><span id="dbg-tier" class="debug-val">--</span></div>
      <div class="debug-row"><span>Draw Calls:</span><span id="dbg-draws" class="debug-val">--</span></div>
      <div class="debug-row"><span>Triangles:</span><span id="dbg-tris" class="debug-val">--</span></div>
      <div class="debug-row"><span>Geometries / Tex:</span><span id="dbg-mem" class="debug-val">--</span></div>
      <div class="debug-row"><span>JS Heap:</span><span id="dbg-heap" class="debug-val">--</span></div>
    `;
    document.body.appendChild(this.el);

    this.fpsEl = this.el.querySelector('#dbg-fps');
    this.msEl = this.el.querySelector('#dbg-ms');
    this.tierEl = this.el.querySelector('#dbg-tier');
    this.drawsEl = this.el.querySelector('#dbg-draws');
    this.trisEl = this.el.querySelector('#dbg-tris');
    this.memEl = this.el.querySelector('#dbg-mem');
    this.heapEl = this.el.querySelector('#dbg-heap');
    this.colliderBtn = this.el.querySelector('#dbg-collider-btn');

    this.colliderBtn.addEventListener('click', () => {
      const next = !this.physics.debugEnabled;
      this.physics.setDebugEnabled(next);
      this.syncColliderButton();
    });
  }

  syncColliderButton() {
    this.colliderBtn.textContent = `Colliders: ${this.physics.debugEnabled ? 'ON' : 'OFF'}`;
  }

  toggle() {
    this.visible = !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
  }

  update(dt) {
    this.frames++;
    this.accumTime += dt;

    if (this.accumTime >= 0.25) {
      this.currentFps = Math.round(this.frames / this.accumTime);
      this.currentFrameTime = ((this.accumTime / this.frames) * 1000).toFixed(1);
      this.frames = 0;
      this.accumTime = 0;

      if (!this.visible) return;

      const info = this.renderer.instance.info;
      this.fpsEl.textContent = `${this.currentFps}`;
      this.fpsEl.style.color = this.currentFps >= 30 ? '#4ade80' : '#f87171';
      this.msEl.textContent = `${this.currentFrameTime} ms`;
      this.tierEl.textContent = this.getTierNameCallback();
      this.drawsEl.textContent = `${info.render.calls}`;
      this.trisEl.textContent = `${info.render.triangles}`;
      this.memEl.textContent = `${info.memory.geometries} / ${info.memory.textures}`;

      if (performance.memory) {
        const mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
        this.heapEl.textContent = `${mb} MB`;
      } else {
        this.heapEl.textContent = 'N/A';
      }
    }
  }
}
