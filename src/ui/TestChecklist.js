const STAGE_1_TESTS = [
  {
    id: 'free_movement',
    title: '1. Free movement on slopes, steps & stairs (no stuck state)',
    desc: 'Walk, run and sprint up the 10-step staircase and the 22° ramp onto the platform, then come back down. No clipping, no getting stuck.'
  },
  {
    id: 'no_foot_slide',
    title: '2. Zero foot sliding & active foot IK',
    desc: 'On stairs/ramp the feet land flat on each surface (no floating or sinking); walk/run speed matches the stride (no skating).'
  },
  {
    id: 'camera_collision',
    title: '3. Camera spring-arm never clips through walls',
    desc: 'Walk into the two-wall corridor on the right and swing the camera into the walls; it must pull in smoothly.'
  },
  {
    id: 'first_third_toggle',
    title: '4. First-person / third-person toggle (V)',
    desc: 'Press V (or the top-bar button) to switch between shoulder camera and eye camera.'
  },
  {
    id: 'jump_land_crouch',
    title: '5. Jump, fall, land & crouch transitions',
    desc: 'Jump (Space), step off the platform, toggle crouch (C). Check the STATE readout and that cross-fades are smooth with no T-pose.'
  },
  {
    id: 'interactions',
    title: '6. Interactions: pick up, drop, push, open door',
    desc: 'Orange crate: E pick up / drop, G throw. Green crate: E or G push (or walk into it). Blue door: E open / close.'
  },
  {
    id: 'input_and_fps',
    title: '7. Keyboard / gamepad / touch controls & 60 FPS on HIGH',
    desc: 'All inputs respond. F3 shows 60 FPS on HIGH on a mid PC (30+ FPS on LOW).'
  }
];

const STORAGE_KEY = 'opzero_stage1_checklist';

function loadResults() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

function saveResults(results) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  } catch (_) {
    /* storage blocked: results stay in memory for this session */
  }
}

export class TestChecklist {
  constructor() {
    this.visible = false;
    this.results = loadResults();

    this.el = document.createElement('div');
    this.el.id = 'checklist-overlay';
    this.el.className = 'overlay-panel hidden';
    this.render();
    document.body.appendChild(this.el);
  }

  setStatus(id, status) {
    this.results[id] = status;
    saveResults(this.results);
    this.render();
  }

  render() {
    const passCount = Object.values(this.results).filter((v) => v === 'pass').length;

    this.el.innerHTML = `
      <div class="panel-header">
        <span>F2 // STAGE 1 ACCEPTANCE CHECKLIST (${passCount}/${STAGE_1_TESTS.length} PASSED)</span>
        <button id="checklist-close" class="panel-btn" style="padding:2px 8px;">X</button>
      </div>
      <div class="checklist-body">
        ${STAGE_1_TESTS.map((item) => {
          const state = this.results[item.id] || 'untested';
          return `
            <div class="checklist-item">
              <div class="checklist-info">
                <div class="checklist-title">${item.title}</div>
                <div class="checklist-desc">${item.desc}</div>
              </div>
              <div class="checklist-actions">
                <button class="check-btn pass ${state === 'pass' ? 'active' : ''}" data-id="${item.id}" data-val="pass">PASS</button>
                <button class="check-btn fail ${state === 'fail' ? 'active' : ''}" data-id="${item.id}" data-val="fail">FAIL</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.el.querySelector('#checklist-close').addEventListener('click', () => this.toggle(false));

    this.el.querySelectorAll('.check-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setStatus(btn.getAttribute('data-id'), btn.getAttribute('data-val'));
      });
    });
  }

  toggle(forceState) {
    this.visible = typeof forceState === 'boolean' ? forceState : !this.visible;
    this.el.classList.toggle('hidden', !this.visible);
  }
}
