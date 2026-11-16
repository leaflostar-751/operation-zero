# STAGE 3 – REMAINING ISSUES
Labels: LIVE VERIFIED / SIMULATED (harness Rapier stub) / STATIC (source reading) / NOT TESTED.

Open bugs: VEH-101 .. VEH-109 (see STAGE3_BUG_REGISTER.md).

Cannot be closed without the user's machine or new assets:
- **Real Rapier / real GPU**: all collision numbers are from a stub. Run `tests/stage2_console.js`-style checks (and the per-vehicle script, available on request) locally.
- **Audio**: NOT TESTED.
- **Real input devices** (keyboard, mouse, gamepad, touch) into the vehicle: NOT TESTED.
- **Graphics ceiling**: see STAGE3_GRAPHICS_REPORT.md. Brand-grade BMW/Toyota/Jeep detail needs authored GLB models; shaders and lighting cannot add missing geometry.
- **Not modelled at all** (so nothing to test): rollover, airborne/landing, slopes, vehicle-vs-vehicle momentum, body deformation, door animation, indicators, first-person cockpit.

Suggested next work, in order: curb/step-height handling (VEH-101), vehicle-vs-vehicle push (VEH-102), visual damage states (VEH-103), real suspension/ground following (VEH-104).
