const PREVENT_DEFAULT_CODES = new Set([
  'F1',
  'F2', 'F3', 'Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
]);

export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();

    this.mouseDelta = { x: 0, y: 0 };
    this.isPointerDown = false;

    this.touchMove = { x: 0, y: 0 };
    this.touchLookDelta = { x: 0, y: 0 };
    this.touchSprint = false;
    this.touchFire = false;
    this.activeJoystickTouchId = null;
    this.activeLookTouchId = null;
    this.lastLookTouchPos = { x: 0, y: 0 };

    // Previous gamepad button states for edge detection
    this.prevGpButtons = {};

    this.state = {
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      sprint: false,
      walk: false,
      jumpJustPressed: false,
      crouchJustPressed: false,
      interactJustPressed: false,
      pushJustPressed: false,
      cameraToggleJustPressed: false,
      fire: false,
      aim: false,
      reloadJustPressed: false,
      punchJustPressed: false,
      kickJustPressed: false,
      weaponToggleJustPressed: false,
      outfitJustPressed: false,
      zombieJustPressed: false,
      infectJustPressed: false,
      vehicleJustPressed: false,
      stowJustPressed: false,
      handbrake: false
    };

    this.bindKeyboardAndMouse();
    this.bindTouch();
  }

  bindKeyboardAndMouse() {
    window.addEventListener('keydown', (e) => {
      // Stop the browser handling F3 (find), F2, Tab focus change, page scroll on arrows/space
      if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();

      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Avoid stuck keys / stuck drag when the window loses focus
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.isPointerDown = false;
    });

    const releaseAll = () => {
      this.keys.clear();
      this.isPointerDown = false;
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) releaseAll(); });

    window.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'CANVAS') {
        this.isPointerDown = true;
        this.keys.add('Mouse' + e.button);
        // Click the game once to capture the mouse (Esc releases it)
        if (!document.pointerLockElement && e.target.requestPointerLock) {
          try {
            const p = e.target.requestPointerLock();
            if (p && p.catch) p.catch(() => {});
          } catch (_) {
            /* pointer lock unavailable: drag-to-look still works */
          }
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      this.isPointerDown = false;
      this.keys.delete('Mouse' + e.button);
    });
    window.addEventListener('contextmenu', (e) => {
      if (e.target.tagName === 'CANVAS') e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerDown || document.pointerLockElement) {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      }
    });
  }

  bindTouch() {
    const touchContainer = document.getElementById('touch-controls');
    const joyZone = document.getElementById('touch-joystick-zone');
    const joyStick = document.getElementById('touch-joystick-stick');
    const lookZone = document.getElementById('touch-look-zone');

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice && touchContainer) {
      touchContainer.classList.remove('hidden');
    }

    if (joyZone && joyStick) {
      joyZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.activeJoystickTouchId = touch.identifier;
        this.updateJoystick(touch, joyZone, joyStick);
      }, { passive: false });

      joyZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
          if (touch.identifier === this.activeJoystickTouchId) {
            this.updateJoystick(touch, joyZone, joyStick);
          }
        }
      }, { passive: false });

      const resetJoystick = (e) => {
        for (const touch of e.changedTouches) {
          if (touch.identifier === this.activeJoystickTouchId) {
            this.activeJoystickTouchId = null;
            this.touchMove.x = 0;
            this.touchMove.y = 0;
            joyStick.style.transform = 'translate(0px, 0px)';
          }
        }
      };

      joyZone.addEventListener('touchend', resetJoystick);
      joyZone.addEventListener('touchcancel', resetJoystick);
    }

    if (lookZone) {
      lookZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.activeLookTouchId = touch.identifier;
        this.lastLookTouchPos.x = touch.clientX;
        this.lastLookTouchPos.y = touch.clientY;
      }, { passive: false });

      lookZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
          if (touch.identifier === this.activeLookTouchId) {
            this.touchLookDelta.x += (touch.clientX - this.lastLookTouchPos.x) * 1.5;
            this.touchLookDelta.y += (touch.clientY - this.lastLookTouchPos.y) * 1.5;
            this.lastLookTouchPos.x = touch.clientX;
            this.lastLookTouchPos.y = touch.clientY;
          }
        }
      }, { passive: false });

      const endLook = (e) => {
        for (const touch of e.changedTouches) {
          if (touch.identifier === this.activeLookTouchId) {
            this.activeLookTouchId = null;
          }
        }
      };

      lookZone.addEventListener('touchend', endLook);
      lookZone.addEventListener('touchcancel', endLook);
    }

    // Touch action buttons
    const tapButton = (id, code) => {
      document.getElementById(id)?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.justPressed.add(code);
      }, { passive: false });
    };
    tapButton('touch-btn-jump', 'Space');
    tapButton('touch-btn-crouch', 'KeyC');
    tapButton('touch-btn-interact', 'KeyE');
    tapButton('touch-btn-reload', 'KeyR');
    tapButton('touch-btn-punch', 'KeyF');
    const fireBtn = document.getElementById('touch-btn-fire');
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchFire = true; }, { passive: false });
      const stopFire = () => { this.touchFire = false; };
      fireBtn.addEventListener('touchend', stopFire);
      fireBtn.addEventListener('touchcancel', stopFire);
    }

    const sprintBtn = document.getElementById('touch-btn-sprint');
    if (sprintBtn) {
      sprintBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.touchSprint = true;
      }, { passive: false });
      const stopSprint = () => {
        this.touchSprint = false;
      };
      sprintBtn.addEventListener('touchend', stopSprint);
      sprintBtn.addEventListener('touchcancel', stopSprint);
    }
  }

  updateJoystick(touch, zone, stick) {
    const rect = zone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 16;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    this.touchMove.x = dx / maxRadius;
    this.touchMove.y = -dy / maxRadius;
  }

  consumeJustPressed(code) {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  /** Call exactly once per displayed frame. */
  update() {
    let kbX = 0;
    let kbY = 0;

    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kbX += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kbX -= 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kbY += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kbY -= 1;

    let gpX = 0;
    let gpY = 0;
    let gpLookX = 0;
    let gpLookY = 0;
    let gpSprint = false;
    let gpJumpJust = false;
    let gpCrouchJust = false;
    let gpInteractJust = false;
    let gpCamJust = false;
    let gpFire = false;
    let gpAim = false;
    let gpReloadJust = false;
    let gpPunchJust = false;

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    if (gp) {
      const deadzone = 0.15;
      if (Math.abs(gp.axes[0]) > deadzone) gpX = gp.axes[0];
      if (Math.abs(gp.axes[1]) > deadzone) gpY = -gp.axes[1];
      if (Math.abs(gp.axes[2]) > deadzone) gpLookX = gp.axes[2] * 9;
      if (Math.abs(gp.axes[3]) > deadzone) gpLookY = gp.axes[3] * 9;

      gpSprint = Boolean(gp.buttons[10]?.pressed);

      const checkGpEdge = (btnIndex) => {
        const isDown = Boolean(gp.buttons[btnIndex]?.pressed);
        const wasDown = Boolean(this.prevGpButtons[btnIndex]);
        this.prevGpButtons[btnIndex] = isDown;
        return isDown && !wasDown;
      };

      gpJumpJust = checkGpEdge(0); // A / Cross
      gpCrouchJust = checkGpEdge(1); // B / Circle
      gpInteractJust = checkGpEdge(2); // X / Square
      gpCamJust = checkGpEdge(3); // Y / Triangle
      gpFire = Boolean(gp.buttons[7]?.pressed); // RT
      gpAim = Boolean(gp.buttons[6]?.pressed); // LT
      gpReloadJust = checkGpEdge(4); // LB
      gpPunchJust = checkGpEdge(5); // RB
    }

    this.state.moveX = Math.max(-1, Math.min(1, kbX + gpX + this.touchMove.x));
    this.state.moveY = Math.max(-1, Math.min(1, kbY + gpY + this.touchMove.y));

    this.state.lookX = this.mouseDelta.x + gpLookX + this.touchLookDelta.x;
    this.state.lookY = this.mouseDelta.y + gpLookY + this.touchLookDelta.y;

    this.state.sprint =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      gpSprint ||
      this.touchSprint;
    this.state.walk = this.keys.has('KeyX'); // hold X to walk slowly on keyboard

    this.state.jumpJustPressed = this.consumeJustPressed('Space') || gpJumpJust;
    this.state.crouchJustPressed =
      this.consumeJustPressed('KeyC') ||
      this.consumeJustPressed('ControlLeft') ||
      gpCrouchJust;
    this.state.interactJustPressed = this.consumeJustPressed('KeyE') || gpInteractJust;
    this.state.pushJustPressed = this.consumeJustPressed('KeyG');
    this.state.cameraToggleJustPressed = this.consumeJustPressed('KeyV') || gpCamJust;

    // combat: LMB / Enter fire (mouse only counts once the pointer is captured), RMB / Z aim
    this.state.fire =
      (this.keys.has('Mouse0') && Boolean(document.pointerLockElement)) ||
      this.keys.has('Enter') ||
      gpFire ||
      this.touchFire;
    this.state.aim = this.keys.has('Mouse2') || this.keys.has('KeyZ') || gpAim;
    this.state.reloadJustPressed = this.consumeJustPressed('KeyR') || gpReloadJust;
    this.state.punchJustPressed = this.consumeJustPressed('KeyF') || gpPunchJust;
    this.state.kickJustPressed = this.consumeJustPressed('KeyQ');
    this.state.weaponToggleJustPressed = this.consumeJustPressed('KeyH');
    this.state.outfitJustPressed = this.consumeJustPressed('KeyN');
    this.state.zombieJustPressed = this.consumeJustPressed('KeyU');
    this.state.infectJustPressed = this.consumeJustPressed('KeyI');
    this.state.vehicleJustPressed = this.consumeJustPressed('KeyY');
    this.state.stowJustPressed = this.consumeJustPressed('KeyB');
    this.state.handbrake = this.keys.has('Space');

    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    this.touchLookDelta.x = 0;
    this.touchLookDelta.y = 0;
  }
}
