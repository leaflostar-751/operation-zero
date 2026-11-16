import { QUALITY_TIERS } from '../core/QualityConfig.js';

export class SettingsMenu {
  constructor(initialTierName, onTierChange, physics, onColliderToggle) {
    this.currentTierName = initialTierName;
    this.onTierChange = onTierChange;
    this.physics = physics;
    this.onColliderToggle = onColliderToggle;
    this.visible = false;

    this.el = document.createElement('div');
    this.el.id = 'settings-menu';
    this.el.className = 'overlay-panel hidden';
    this.render();
    document.body.appendChild(this.el);
  }

  render() {
    const tier = QUALITY_TIERS[this.currentTierName];
    this.el.innerHTML = `
      <div class="panel-header">
        <span>GRAPHICS &amp; ENGINE SETTINGS</span>
        <button id="settings-close" class="panel-btn" style="padding:2px 8px;">X</button>
      </div>
      <div class="setting-group">
        <label>Quality Tier Preset (Live Switch)</label>
        <div class="tier-buttons">
          ${Object.keys(QUALITY_TIERS)
            .map(
              (key) =>
                `<button class="tier-btn ${key === this.currentTierName ? 'active' : ''}" data-tier="${key}">${key}</button>`
            )
            .join('')}
        </div>
      </div>
      <div class="toggle-row">
        <span>Resolution Scale</span>
        <span class="debug-val">${Math.round(tier.resolutionScale * 100)}%</span>
      </div>
      <div class="toggle-row">
        <span>Shadow Map Size</span>
        <span class="debug-val">${tier.shadowMapSize}px</span>
      </div>
      <div class="toggle-row">
        <span>Post-Processing Chain</span>
        <span class="debug-val">${tier.postProcessing ? 'ON' : 'OFF'}</span>
      </div>
      <div class="toggle-row">
        <span>SSAO / Bloom</span>
        <span class="debug-val">${tier.ssao ? 'SSAO+Bloom' : tier.bloom ? 'Bloom Only' : 'OFF'}</span>
      </div>
      <div class="toggle-row">
        <span>Anti-Aliasing (MSAA)</span>
        <span class="debug-val">${tier.postProcessing ? (tier.msaaSamples ? tier.msaaSamples + 'x' : 'OFF') : 'OFF'}</span>
      </div>
      <div class="toggle-row">
        <span>Draw Distance</span>
        <span class="debug-val">${tier.drawDistance}m</span>
      </div>
      <div class="toggle-row" style="margin-top:6px;border-top:1px solid #334155;padding-top:10px;">
        <span>Rapier Collider Wireframe</span>
        <button id="settings-collider-toggle" class="panel-btn">${this.physics.debugEnabled ? 'ON' : 'OFF'}</button>
      </div>
    `;

    this.el.querySelector('#settings-close').addEventListener('click', () => this.toggle(false));

    this.el.querySelectorAll('.tier-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selected = btn.getAttribute('data-tier');
        this.currentTierName = selected;
        try {
          localStorage.setItem('opzero_quality_tier', selected);
        } catch (_) {
          /* storage blocked: tier still switches, just not remembered */
        }
        this.onTierChange(selected);
        this.render();
      });
    });

    this.el.querySelector('#settings-collider-toggle').addEventListener('click', () => {
      this.onColliderToggle();
      this.render();
    });
  }

  toggle(forceState) {
    this.visible = typeof forceState === 'boolean' ? forceState : !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
    if (this.visible) {
      this.render();
    }
  }
}
