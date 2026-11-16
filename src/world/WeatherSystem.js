import * as THREE from 'three';

/**
 * Day/night cycle + weather (Stage 4 / M-Weather).
 * - sun/moon direction, light colour, hemisphere light, fog and a procedural sky dome follow the clock
 * - weather presets blend smoothly: clear, cloudy, rain, storm, fog, dust
 * - rain is drawn by a GPU shader (no per-frame CPU work), lightning flashes, wet ground
 * - zombies get a sight/hearing multiplier (night: see less, hear more; rain masks sound)
 * - small procedural Web Audio layer (rain / wind / thunder): needs a user gesture, NOT TESTED with real audio
 */

export const WEATHER_PRESETS = {
  clear:  { label: 'Clear',  cloud: 0.12, fog: 1.0, light: 1.0,  rain: 0, wind: 0.25, wet: 0, flash: 0, dust: 0 },
  cloudy: { label: 'Cloudy', cloud: 0.75, fog: 1.7, light: 0.62, rain: 0, wind: 0.5,  wet: 0, flash: 0, dust: 0 },
  rain:   { label: 'Rain',   cloud: 0.92, fog: 2.8, light: 0.42, rain: 0.65, wind: 0.6, wet: 0.75, flash: 0, dust: 0 },
  storm:  { label: 'Storm',  cloud: 1.0,  fog: 3.6, light: 0.28, rain: 1.0, wind: 1.0, wet: 1.0, flash: 1, dust: 0 },
  fog:    { label: 'Fog',    cloud: 0.55, fog: 8.0, light: 0.5,  rain: 0, wind: 0.1, wet: 0.2, flash: 0, dust: 0 },
  dust:   { label: 'Dust storm', cloud: 0.3, fog: 6.0, light: 0.62, rain: 0, wind: 0.95, wet: 0, flash: 0, dust: 1 }
};
const ORDER = Object.keys(WEATHER_PRESETS);
const NUMERIC = ['cloud', 'fog', 'light', 'rain', 'wind', 'wet', 'flash', 'dust'];

const RAIN_COUNT = { LOW: 900, MEDIUM: 2200, HIGH: 4500, ULTRA: 8000 };
const BASE_FOG = 0.0013;
const SKY_R = 2600;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const C = (h) => new THREE.Color(h);
const NIGHT_H = C(0x0a1020), NIGHT_Z = C(0x01030a);
const DUSK_H = C(0xe0894a), DUSK_Z = C(0x28365a);
const DAY_H = C(0xb9cde0), DAY_Z = C(0x3f7fc4);
const OVER_DAY = C(0x8a949e), OVER_NIGHT = C(0x10141b);
const DUST_C = C(0xb98a55);

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.9999; }`;

const SKY_FRAG = /* glsl */`
varying vec3 vDir;
uniform vec3 uHorizon, uZenith, uSunDir, uMoonDir, uOver, uSunCol;
uniform float uCloud, uDay, uTime, uNight, uFlash, uWind;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  float g = pow(1.0 - clamp(d.y, 0.0, 1.0), 2.4);
  vec3 col = mix(uZenith, uHorizon, g);
  // sun glow + disc
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.28 + pow(sd, 400.0) * 3.0) * (1.0 - uCloud * 0.85);
  // moon + stars
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.75,0.82,1.0) * pow(md, 900.0) * 2.0 * uNight * (1.0 - uCloud);
  vec2 sp = d.xz / (d.y + 0.35) * 55.0;
  float star = step(0.9975, hash(floor(sp))) * smoothstep(0.05, 0.3, d.y);
  col += vec3(star) * uNight * (1.0 - uCloud) * 0.9;
  // clouds on a plane above the camera
  if (d.y > 0.0) {
    vec2 cp = d.xz / (d.y + 0.18) * 1.6 + vec2(uTime * 0.012 * (0.4 + uWind), uTime * 0.004);
    float n = fbm(cp);
    float cover = smoothstep(1.0 - uCloud * 0.95 - 0.05, 1.05 - uCloud * 0.5, n);
    cover *= smoothstep(0.0, 0.18, d.y);
    vec3 cc = mix(uOver * 1.25, uOver * 0.55, smoothstep(0.35, 0.9, n));
    cc += uSunCol * pow(sd, 3.0) * 0.18 * (1.0 - uCloud * 0.6) * uDay;
    col = mix(col, cc, clamp(cover * (0.35 + uCloud * 0.65), 0.0, 1.0));
  }
  col += vec3(0.75, 0.8, 1.0) * uFlash;
  // below horizon: blend into the fog colour so there is no seam
  col = mix(col, uHorizon, smoothstep(0.0, -0.15, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const RAIN_VERT = /* glsl */`
attribute vec4 seed; attribute float endFlag;
uniform float uTime, uIntensity, uWindX; uniform vec3 uCam;
varying float vA;
void main(){
  vec3 box = vec3(70.0, 36.0, 70.0);
  float speed = 24.0 + seed.w * 8.0;
  vec3 p = seed.xyz * box;
  p.y -= uTime * speed;
  p.x += uTime * uWindX * 6.0;
  vec3 off = mod(p - uCam + box * 0.5, box) - box * 0.5;
  vec3 pos = uCam + off;
  pos += endFlag * vec3(uWindX * 0.18, 0.75, 0.0) * (0.7 + seed.w * 0.6);
  vA = (1.0 - endFlag * 0.85) * 0.55;
  if (seed.w > uIntensity) pos = vec3(1.0e6);
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;
const RAIN_FRAG = /* glsl */`
varying float vA; uniform vec3 uColor;
void main(){ gl_FragColor = vec4(uColor, vA); }`;

export class WeatherSystem {
  constructor(scene, camera, world, tierName = 'MEDIUM') {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.tierName = tierName;

    this.hour = 10.0;          // game clock 0-24
    this.day = 1;
    this.hoursPerSecond = 1 / 30; // 1 game hour = 30 s  -> 12 min per full day
    this.timeFlow = true;
    this.auto = true;          // random weather changes
    this.autoTimer = 90;
    this.time = 0;

    this.current = 'clear';
    this.target = 'clear';
    this.state = { ...WEATHER_PRESETS.clear };

    this.flash = 0;
    this.flashTimer = 8;
    this.thunderQueue = [];

    // read-only outputs used by other systems
    this.sunElevation = 1;
    this.daylight = 1;
    this.sense = { sight: 1, hear: 1 };

    this._tmpA = new THREE.Color();
    this._tmpB = new THREE.Color();
    this._horizon = new THREE.Color();
    this._zenith = new THREE.Color();
    this._sunDir = new THREE.Vector3();
    this._moonDir = new THREE.Vector3();
    this._lightDir = new THREE.Vector3();

    this.buildSky();
    this.buildRain();
    this.buildHud();
    this.audio = new WeatherAudio();

    this.apply(0, true);
  }

  // ---------- construction ----------
  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: {
        uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
        uOver: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color(1, 0.85, 0.6) },
        uCloud: { value: 0 }, uDay: { value: 1 }, uNight: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 }, uWind: { value: 0.3 }
      }
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 16), this.skyMat);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    this.scene.background = null; // the dome is the background now (HDRI is still used for reflections)
  }

  buildRain() {
    const n = RAIN_COUNT[this.tierName] || 2200;
    const pos = new Float32Array(n * 2 * 3);
    const seed = new Float32Array(n * 2 * 4);
    const end = new Float32Array(n * 2);
    let s = 1234567;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      const a = rnd(), b = rnd(), c = rnd(), d = i / n; // d spreads the intensity threshold evenly
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k;
        seed[j * 4] = a; seed[j * 4 + 1] = b; seed[j * 4 + 2] = c; seed[j * 4 + 3] = d;
        end[j] = k;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    geo.setAttribute('endFlag', new THREE.BufferAttribute(end, 1));
    this.rainMat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uWindX: { value: 0 }, uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0.75, 0.82, 0.95) } }
    });
    if (this.rain) { this.scene.remove(this.rain); this.rain.geometry.dispose(); }
    this.rain = new THREE.LineSegments(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rain.renderOrder = 900;
    this.scene.add(this.rain);
  }

  buildHud() {
    const el = document.createElement('div');
    el.id = 'hud-weather';
    Object.assign(el.style, {
      position: 'fixed', top: '58px', left: '50%', transform: 'translateX(-50%)', padding: '4px 12px',
      font: '600 12px system-ui, sans-serif', color: '#e2e8f0', background: 'rgba(15,23,42,0.6)',
      borderRadius: '6px', zIndex: 15, pointerEvents: 'none', letterSpacing: '0.04em'
    });
    el.title = 'Comma = +1 hour, Period = next weather, Slash = freeze/unfreeze time';
    document.body.appendChild(el);
    this.hudEl = el;
  }

  applyTier(tierName) {
    if (tierName === this.tierName) return;
    this.tierName = tierName;
    this.buildRain();
  }

  // ---------- control ----------
  setWeather(name, instant = false) {
    if (!WEATHER_PRESETS[name]) return;
    this.target = name;
    if (instant) { this.current = name; this.state = { ...WEATHER_PRESETS[name] }; this.apply(0, true); }
  }
  nextWeather() { this.setWeather(ORDER[(ORDER.indexOf(this.target) + 1) % ORDER.length]); }
  setHour(h) { this.hour = ((h % 24) + 24) % 24; this.apply(0, true); }
  addHours(h) { this.setHour(this.hour + h); }
  get label() { return WEATHER_PRESETS[this.target].label; }

  // ---------- per-frame ----------
  update(dt, focus) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    if (this.timeFlow) {
      this.hour += dt * this.hoursPerSecond;
      if (this.hour >= 24) { this.hour -= 24; this.day++; }
    }
    if (this.auto) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) {
        this.autoTimer = 75 + Math.random() * 120;
        const r = Math.random();
        this.setWeather(r < 0.38 ? 'clear' : r < 0.58 ? 'cloudy' : r < 0.74 ? 'rain' : r < 0.82 ? 'storm' : r < 0.92 ? 'fog' : 'dust');
      }
    }
    // blend towards the target preset (about 4 s time constant)
    const goal = WEATHER_PRESETS[this.target];
    const k = 1 - Math.exp(-dt / 4);
    for (const key of NUMERIC) this.state[key] += (goal[key] - this.state[key]) * k;
    this.apply(dt, false, focus);
  }

  apply(dt, snap, focus) {
    const st = this.state;
    const h = this.hour;
    // sun path: east at 6:00, zenith at 12:00, west at 18:00
    const ang = ((h - 6) / 12) * Math.PI;
    const sx = -Math.cos(ang) * 0.85, sy = Math.sin(ang), sz = 0.5;
    this._sunDir.set(sx, sy, sz).normalize();
    this._moonDir.copy(this._sunDir).multiplyScalar(-1);
    const e = this._sunDir.y;            // sun elevation (-1..1)
    this.sunElevation = e;
    const day = smooth(-0.08, 0.28, e);  // 0 night .. 1 full day
    const twi = 1 - Math.min(1, Math.abs(e) / 0.28); // 1 at the horizon
    const night = 1 - smooth(-0.3, 0.02, e);
    this.daylight = day;

    // sky palette
    this._horizon.copy(NIGHT_H).lerp(DAY_H, day).lerp(DUSK_H, twi * 0.85 * (1 - st.cloud * 0.6));
    this._zenith.copy(NIGHT_Z).lerp(DAY_Z, day).lerp(DUSK_Z, twi * 0.6);
    const over = this._tmpA.copy(OVER_NIGHT).lerp(OVER_DAY, day).multiplyScalar(0.55 + st.light * 0.6);
    this._horizon.lerp(over, st.cloud * 0.8);
    this._zenith.lerp(over, st.cloud * 0.85);
    if (st.dust > 0.01) { this._horizon.lerp(DUST_C.clone().multiplyScalar(0.3 + 0.7 * day), st.dust * 0.8); this._zenith.lerp(DUST_C.clone().multiplyScalar(0.25 + 0.5 * day), st.dust * 0.7); }

    // lightning
    if (st.flash > 0.5) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashTimer = 4 + Math.random() * 11;
        this.flash = 1;
        this.thunderQueue.push(0.4 + Math.random() * 2.2);
      }
    }
    this.flash = Math.max(0, this.flash - dt * 4.5);
    for (let i = this.thunderQueue.length - 1; i >= 0; i--) {
      this.thunderQueue[i] -= dt;
      if (this.thunderQueue[i] <= 0) { this.thunderQueue.splice(i, 1); this.audio.thunder(); }
    }
    const flick = this.flash * (0.6 + 0.4 * Math.sin(this.time * 90));

    // sky uniforms
    const u = this.skyMat.uniforms;
    u.uHorizon.value.copy(this._horizon); u.uZenith.value.copy(this._zenith);
    u.uSunDir.value.copy(this._sunDir); u.uMoonDir.value.copy(this._moonDir);
    u.uOver.value.copy(over);
    u.uSunCol.value.setRGB(1.0, 0.82 + 0.15 * day, 0.55 + 0.4 * day);
    u.uCloud.value = st.cloud; u.uDay.value = day; u.uNight.value = night; u.uTime.value = this.time; u.uFlash.value = flick * 0.6; u.uWind.value = st.wind;
    this.sky.position.copy(this.camera.position);

    // sun / moon light
    const sun = this.world.sunLight;
    if (sun) {
      const sunI = 2.8 * smooth(0, 0.25, e) * (0.25 + 0.75 * st.light);
      const moonI = 0.6 * smooth(0, 0.3, -e) * (0.45 + 0.55 * (1 - st.cloud));
      sun.intensity = Math.max(sunI, moonI);
      const dirSrc = e > 0 ? this._sunDir : this._moonDir;
      this._lightDir.copy(dirSrc);
      this._lightDir.y = Math.max(this._lightDir.y, 0.18); // avoid razor-grazing shadows
      this._lightDir.normalize();
      this.world.setSunDirection?.(this._lightDir);
      if (e > 0) sun.color.setRGB(1.0, 0.72 + 0.26 * smooth(0, 0.5, e), 0.45 + 0.5 * smooth(0, 0.5, e));
      else sun.color.setRGB(0.55, 0.65, 1.0);
    }
    const hemi = this.world.hemiLight;
    if (hemi) {
      hemi.color.copy(this._zenith).lerp(this._tmpB.setRGB(1, 1, 1), 0.35);
      hemi.groundColor.copy(this._horizon).multiplyScalar(0.35);
      hemi.intensity = (0.2 + 0.28 * day) * (0.55 + 0.45 * st.light) + flick * 2.2;
    }
    const tierEnv = this.world.tierConfig?.envMapIntensity ?? 1;
    this.scene.environmentIntensity = tierEnv * (0.17 + 0.83 * smooth(-0.2, 0.3, e)) * (0.45 + 0.55 * st.light) + flick * 0.8;

    // fog follows the horizon colour; thicker in bad weather and at night
    const fog = this.scene.fog;
    if (fog) {
      fog.color.copy(this._horizon);
      fog.density = BASE_FOG * st.fog * (1 + 0.35 * night);
    }

    // wet ground
    const gm = this.world.groundMaterial;
    if (gm) { gm.color.setScalar(1 - 0.38 * st.wet); gm.envMapIntensity = 1 + 1.4 * st.wet; }

    // rain
    const rainOn = st.rain > 0.02;
    this.rain.visible = rainOn;
    if (rainOn) {
      const ru = this.rainMat.uniforms;
      ru.uTime.value = this.time; ru.uIntensity.value = st.rain; ru.uWindX.value = (st.wind - 0.25) * 2.2;
      ru.uCam.value.copy(this.camera.position);
      ru.uColor.value.setRGB(0.55 + 0.4 * day, 0.62 + 0.38 * day, 0.75 + 0.25 * day);
    }

    // street lamps at night (glow only; real point lights would be too costly)
    const city = this.world.city;
    if (city?.lampMat) {
      const lampOn = smooth(0.1, -0.05, e) * (1 - 0.0) + (st.cloud > 0.85 ? 0.35 * day : 0);
      const L = Math.min(1, lampOn);
      city.lampMat.emissiveIntensity = L * 3.2;
      city.lampPoolMat.opacity = L * 0.75;
      city.lampPool.visible = L > 0.02;
    }

    // colour grade by time and weather
    const gr = this.grade;
    if (gr) {
      gr.uSat.value = 1.1 - 0.38 * st.cloud * (1 - st.dust) - 0.25 * Math.min(1, st.fog / 8) + 0.1 * twi;
      gr.uContrast.value = 1.12 + 0.08 * day - 0.1 * st.cloud;
      gr.uShadowTint.value.setRGB(0.9 + 0.08 * day, 0.98, 1.08 - 0.04 * day + 0.05 * night);
      gr.uHighTint.value.setRGB(1.04 + 0.05 * twi, 1.0, 0.95 + 0.04 * (1 - twi) + 0.05 * st.cloud);
      if (st.dust > 0.01) gr.uHighTint.value.lerp(this._tmpB.setRGB(1.15, 0.95, 0.7), st.dust * 0.7);
    }

    // what zombies can see / hear
    const vis = 1 / (1 + (st.fog - 1) * 0.28);
    this.sense.sight = Math.max(0.3, vis * (0.5 + 0.5 * day));
    this.sense.hear = (1 + 0.5 * night) * (1 - 0.35 * st.rain);

    this.audio.set(st.rain, st.wind);

    // HUD clock
    if (this.hudEl) {
      const hh = Math.floor(this.hour), mm = Math.floor((this.hour - hh) * 60);
      const txt = `Day ${this.day}  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ·  ${this.label}`;
      if (txt !== this._lastTxt) { this.hudEl.textContent = txt; this._lastTxt = txt; }
    }
  }

  dispose() {
    this.scene.remove(this.sky); this.scene.remove(this.rain);
    this.sky.geometry.dispose(); this.skyMat.dispose(); this.rain.geometry.dispose(); this.rainMat.dispose();
    this.hudEl?.remove(); this.audio.dispose();
  }
}

/** Procedural weather sound: filtered noise for rain/wind and a low rumble for thunder. */
class WeatherAudio {
  constructor() {
    this.ctx = null; this.ready = false;
    const start = () => this.start();
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    this._rain = 0; this._wind = 0;
  }
  start() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const mk = (type, freq, q) => {
        const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = this.ctx.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start();
        return g;
      };
      this.rainGain = mk('highpass', 1500, 0.5);
      this.windGain = mk('bandpass', 380, 0.6);
      this.ready = true;
      this.set(this._rain, this._wind);
    } catch (_) { /* no audio device: stay silent */ }
  }
  set(rain, wind) {
    this._rain = rain; this._wind = wind;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(rain * 0.14, t, 0.4);
    this.windGain.gain.setTargetAtTime(wind * 0.08 * (0.7 + 0.3 * Math.sin(t * 0.6)), t, 0.6);
  }
  thunder() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start(t); src.stop(t + 3.3);
  }
  dispose() { try { this.ctx?.close(); } catch (_) { /* ignore */ } }
}
