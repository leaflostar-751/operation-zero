import { ROADS, CANAL, MINOR_CANALS, LANDMARKS, ZONES, MAP_BOUNDS, px } from '../world/CityData.js';

/** Rotating mini-map (bottom-right) and a full-map overlay (M). */
export class Minimap {
  constructor(city) {
    this.city = city;
    this.S = 0.25; // pixels per metre on the cached map
    this.big = false;
    const b = MAP_BOUNDS;
    this.ox = b.minX;
    this.oz = b.minZ;
    this.base = document.createElement('canvas');
    this.base.width = Math.ceil((b.maxX - b.minX) * this.S);
    this.base.height = Math.ceil((b.maxZ - b.minZ) * this.S);
    this.drawBase();
    this.el = document.createElement('canvas');
    this.el.id = 'minimap';
    this.el.width = this.el.height = 190;
    this.S = 0.4; // closer zoom on the small map
    Object.assign(this.el.style, { position: 'fixed', right: '16px', bottom: '110px', width: '190px', height: '190px', borderRadius: '50%', zIndex: 20, pointerEvents: 'none', background: 'transparent', webkitMaskImage: 'radial-gradient(circle, #000 62%, transparent 72%)', maskImage: 'radial-gradient(circle, #000 62%, transparent 72%)' });
    document.body.appendChild(this.el);
    this.ctx = this.el.getContext('2d');
    this.label = document.createElement('div');
    this.label.id = 'minimap-label';
    Object.assign(this.label.style, { position: 'fixed', right: '16px', bottom: '84px', width: '190px', textAlign: 'center', color: '#e8eef5', font: '600 11px system-ui, sans-serif', textShadow: '0 1px 3px #000', zIndex: 20, pointerEvents: 'none' });
    document.body.appendChild(this.label);
  }
  toWorldBase(x, z) { return [(x - this.ox) * this.S, (z - this.oz) * this.S]; }
  drawBase() {
    // transparent base: ONLY roads (and the canal as a faint line). No ground, no buildings, no text.
    const c = this.base.getContext('2d');
    const S = this.S;
    c.clearRect(0, 0, this.base.width, this.base.height);
    const line = (pts, w, col, cap = 'round') => {
      c.strokeStyle = col; c.lineWidth = Math.max(1.2, w * S); c.lineCap = cap; c.lineJoin = 'round';
      c.beginPath();
      pts.forEach((p, i) => { const [x, y] = this.toWorldBase(p[0], p[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    };
    line(this.city.canal.sp, this.city.canal.w, 'rgba(120,200,230,0.45)');
    for (const m of this.city.minor) line(m.sp, m.w, 'rgba(120,200,230,0.35)');
    // dark halo first so thin white roads stay readable on any background
    for (const r of this.city.roads) line(r.sp, r.w + 2.5, 'rgba(0,0,0,0.55)');
    for (const r of this.city.roads) line(r.sp, r.w, r.type === 'highway' ? 'rgba(255,214,110,0.95)' : 'rgba(245,245,240,0.9)');
  }
  toggle() { /* the big map is now the 3D map (main.js) */ }
  resize() {
    const s = this.big ? Math.min(window.innerHeight * 0.8, window.innerWidth * 0.8) : 190;
    this.el.width = this.el.height = Math.round(s);
    Object.assign(this.el.style, this.big
      ? { width: s + 'px', height: s + 'px', right: '50%', bottom: '50%', transform: 'translate(50%,50%)', borderRadius: '12px' }
      : { width: '190px', height: '190px', right: '16px', bottom: '110px', transform: 'none', borderRadius: '50%' });
    this.label.style.display = 'none';
  }
  update(pos, yaw) {
    const c = this.ctx, W = this.el.width;
    const S = this.S * (this.big ? 0.9 : 1);
    c.clearRect(0, 0, W, W);
    c.save();
    c.translate(W / 2, W / 2);
    // facing direction of the camera = (-sin yaw, -cos yaw); rotate so it points up
    const a = Math.atan2(-Math.sin(yaw), Math.cos(yaw));
    if (!this.big) c.rotate(-a);
    const [bx, bz] = this.toWorldBase(pos.x, pos.z);
    const zoom = this.big ? 0.9 : 1;
    c.scale(zoom, zoom);
    c.translate(-bx, -bz);
    c.drawImage(this.base, 0, 0);
    c.restore();
    // player arrow
    c.save();
    c.translate(W / 2, W / 2);
    if (this.big) {
      const [px2, pz2] = this.toWorldBase(pos.x, pos.z);
      c.translate((px2 - this.base.width / 2) * 0.9, (pz2 - this.base.height / 2) * 0.9);
      c.rotate(a);
    }
    c.fillStyle = '#ff3b30'; c.strokeStyle = '#fff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(0, 4); c.lineTo(-6, 7); c.closePath(); c.fill(); c.stroke();
    c.restore();
    void S;
    // district label
    if (!this.big) {
      const r = this.city.roadClearance(pos.x, pos.z);
      this.label.textContent = r.c < 12 && r.road ? r.road.name : `x ${Math.round(pos.x)}  z ${Math.round(pos.z)}`;
    }
  }
}
