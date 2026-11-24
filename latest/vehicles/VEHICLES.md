# Vehicle motion check (driving forward, reverse, turning, braking, handbrake)

Run 2026-11-24T07:46:11.111Z. 104 measurements: 101 in typical range, 3 outside (0 Major, 3 Minor), 0 no data.

The game's own drive() and updateFrame() ran in a 60 Hz loop in free space (collisions off while measuring). **LIMITS:** flat free space only - NO crashes, ramps, slopes, curbs, driver pose, camera, doors or suspension per wheel; ranges are typical values for a class (ESTIMATE).

| Vehicle | Measurement | Game | Typical range | Verdict |
|---|---|---|---|---|
| Apex GT (car) | any NaN / broken number while driving (0 = none) | 0 | 0..0 | IN_RANGE |
| Apex GT (car) | wheels turn the right way when going FORWARD (share of samples) | 1 | 1..1 | IN_RANGE |
| Apex GT (car) | wheels turn the right way when going in REVERSE (share of samples) | 1 | 1..1 | IN_RANGE |
| Apex GT (car) | wheel spin vs ground speed (1.0 = rolls without slipping) | 1 | 0.9..1.1 | IN_RANGE |
| Apex GT (car) | left input turns the vehicle left, right input turns it right (1 = yes) | 1 | 1..1 | IN_RANGE |
| Apex GT (car) | front wheel(s) point the way the vehicle turns (1 = yes) | 1 | 1..1 | IN_RANGE |
| Apex GT (car) | front wheel steer angle at full lock, parking speed (deg) | 25.892 | 25..45 | IN_RANGE |
| Apex GT (car) | front wheel steer angle at 14 m/s (deg): less lock at speed | 25.245 | 1..35 | IN_RANGE |
| Apex GT (car) | Ackermann: inner wheel turns more than the outer by (deg) | 5.104 | 0..15 | IN_RANGE |
| Apex GT (car) | body roll OUTWARD in a turn (deg, + = outward like a real car, - = leans into the turn like a bike) | 1.445 | 0..7 | IN_RANGE |
| Apex GT (car) | roll left-turn vs right-turn size difference (deg) | 0 | 0..1 | IN_RANGE |
| Apex GT (car) | nose UP when accelerating (deg) | 1.445 | 0..4 | IN_RANGE |
| Apex GT (car) | nose DOWN when braking (deg) | 2.288 | 0..6 | IN_RANGE |
| Apex GT (car) | lowest wheel hub minus wheel radius = wheel sunk into the ground (m) | 0 | -0.05..0.05 | IN_RANGE |
| Apex GT (car) | highest wheel hub minus wheel radius = wheel floating (m) | 0 | -0.05..0.05 | IN_RANGE |
| Apex GT (car) | straight line drift with no steering after 6 s (m) | 0 | 0..0.05 | IN_RANGE |
| Apex GT (car) | speed RISES while braking and still rolling forward (m/s) | 0 | 0..0.01 | IN_RANGE |
| Apex GT (car) | strongest braking (g) | 1.506 | 0..1.6 | IN_RANGE |
| Apex GT (car) | biggest speed jump in one 1/60 s frame (m/s) | 0.396 | 0..0.5 | IN_RANGE |
| Apex GT (car) | sideways acceleration in turns (g) | 1.045 | 0..1.3650000000000002 | IN_RANGE |
| Apex GT (car) | handbrake slide angle (deg) | 65.845 | 5..90 | IN_RANGE |
| Stallion V8 (car) | any NaN / broken number while driving (0 = none) | 0 | 0..0 | IN_RANGE |
| Stallion V8 (car) | wheels turn the right way when going FORWARD (share of samples) | 1 | 1..1 | IN_RANGE |
| Stallion V8 (car) | wheels turn the right way when going in REVERSE (share of samples) | 1 | 1..1 | IN_RANGE |
| Stallion V8 (car) | wheel spin vs ground speed (1.0 = rolls without slipping) | 1 | 0.9..1.1 | IN_RANGE |
| Stallion V8 (car) | left input turns the vehicle left, right input turns it right (1 = yes) | 1 | 1..1 | IN_RANGE |
| Stallion V8 (car) | front wheel(s) point the way the vehicle turns (1 = yes) | 1 | 1..1 | IN_RANGE |
| Stallion V8 (car) | front wheel steer angle at full lock, parking speed (deg) | 25.936 | 25..45 | IN_RANGE |
| Stallion V8 (car) | front wheel steer angle at 14 m/s (deg): less lock at speed | 25.084 | 1..35 | IN_RANGE |
| Stallion V8 (car) | Ackermann: inner wheel turns more than the outer by (deg) | 5.173 | 0..15 | IN_RANGE |
| Stallion V8 (car) | body roll OUTWARD in a turn (deg, + = outward like a real car, - = leans into the turn like a bike) | 1.826 | 0..7 | IN_RANGE |
| Stallion V8 (car) | roll left-turn vs right-turn size difference (deg) | 0 | 0..1 | IN_RANGE |
| Stallion V8 (car) | nose UP when accelerating (deg) | 1.333 | 0..4 | IN_RANGE |
| Stallion V8 (car) | nose DOWN when braking (deg) | 2.081 | 0..6 | IN_RANGE |
| Stallion V8 (car) | lowest wheel hub minus wheel radius = wheel sunk into the ground (m) | 0 | -0.05..0.05 | IN_RANGE |
| Stallion V8 (car) | highest wheel hub minus wheel radius = wheel floating (m) | 0 | -0.05..0.05 | IN_RANGE |
| Stallion V8 (car) | straight line drift with no steering after 6 s (m) | 0 | 0..0.05 | IN_RANGE |
| Stallion V8 (car) | speed RISES while braking and still rolling forward (m/s) | 0 | 0..0.01 | IN_RANGE |
| Stallion V8 (car) | strongest braking (g) | 1.372 | 0..1.6 | IN_RANGE |
| Stallion V8 (car) | biggest speed jump in one 1/60 s frame (m/s) | 0.388 | 0..0.5 | IN_RANGE |
| Stallion V8 (car) | sideways acceleration in turns (g) | 0.944 | 0..1.2349999999999999 | IN_RANGE |
| Stallion V8 (car) | handbrake slide angle (deg) | 62.967 | 5..90 | IN_RANGE |
| Ranger 4x4 (car) | any NaN / broken number while driving (0 = none) | 0 | 0..0 | IN_RANGE |
| Ranger 4x4 (car) | wheels turn the right way when going FORWARD (share of samples) | 1 | 1..1 | IN_RANGE |
| Ranger 4x4 (car) | wheels turn the right way when going in REVERSE (share of samples) | 1 | 1..1 | IN_RANGE |
| Ranger 4x4 (car) | wheel spin vs ground speed (1.0 = rolls without slipping) | 1 | 0.9..1.1 | IN_RANGE |
| Ranger 4x4 (car) | left input turns the vehicle left, right input turns it right (1 = yes) | 1 | 1..1 | IN_RANGE |
| Ranger 4x4 (car) | front wheel(s) point the way the vehicle turns (1 = yes) | 1 | 1..1 | IN_RANGE |
| Ranger 4x4 (car) | front wheel steer angle at full lock, parking speed (deg) | 25.565 | 25..45 | IN_RANGE |
| Ranger 4x4 (car) | front wheel steer angle at 14 m/s (deg): less lock at speed | 24.926 | 1..35 | IN_RANGE |
| Ranger 4x4 (car) | Ackermann: inner wheel turns more than the outer by (deg) | 5.296 | 0..15 | IN_RANGE |
| Ranger 4x4 (car) | body roll OUTWARD in a turn (deg, + = outward like a real car, - = leans into the turn like a bike) | 2.414 | 0..7 | IN_RANGE |
| Ranger 4x4 (car) | roll left-turn vs right-turn size difference (deg) | 0 | 0..1 | IN_RANGE |
| Ranger 4x4 (car) | nose UP when accelerating (deg) | 1.146 | 0..4 | IN_RANGE |
| Ranger 4x4 (car) | nose DOWN when braking (deg) | 1.898 | 0..6 | IN_RANGE |
| Ranger 4x4 (car) | lowest wheel hub minus wheel radius = wheel sunk into the ground (m) | 0 | -0.05..0.05 | IN_RANGE |
| Ranger 4x4 (car) | highest wheel hub minus wheel radius = wheel floating (m) | 0 | -0.05..0.05 | IN_RANGE |
| Ranger 4x4 (car) | straight line drift with no steering after 6 s (m) | 0 | 0..0.05 | IN_RANGE |
| Ranger 4x4 (car) | speed RISES while braking and still rolling forward (m/s) | 0 | 0..0.01 | IN_RANGE |
| Ranger 4x4 (car) | strongest braking (g) | 1.217 | 0..1.6 | IN_RANGE |
| Ranger 4x4 (car) | biggest speed jump in one 1/60 s frame (m/s) | 0.339 | 0..0.5 | IN_RANGE |
| Ranger 4x4 (car) | sideways acceleration in turns (g) | 0.796 | 0..1.04 | IN_RANGE |
| Ranger 4x4 (car) | handbrake slide angle (deg) | 57.238 | 5..90 | IN_RANGE |
| Vortex R (car) | any NaN / broken number while driving (0 = none) | 0 | 0..0 | IN_RANGE |
| Vortex R (car) | wheels turn the right way when going FORWARD (share of samples) | 1 | 1..1 | IN_RANGE |
| Vortex R (car) | wheels turn the right way when going in REVERSE (share of samples) | 1 | 1..1 | IN_RANGE |
| Vortex R (car) | wheel spin vs ground speed (1.0 = rolls without slipping) | 1 | 0.9..1.1 | IN_RANGE |
| Vortex R (car) | left input turns the vehicle left, right input turns it right (1 = yes) | 1 | 1..1 | IN_RANGE |
| Vortex R (car) | front wheel(s) point the way the vehicle turns (1 = yes) | 1 | 1..1 | IN_RANGE |
| Vortex R (car) | front wheel steer angle at full lock, parking speed (deg) | 23.916 | 25..45 | OUT_OF_RANGE (Minor) |
| Vortex R (car) | front wheel steer angle at 14 m/s (deg): less lock at speed | 23.683 | 1..35 | IN_RANGE |
| Vortex R (car) | Ackermann: inner wheel turns more than the outer by (deg) | 4.659 | 0..15 | IN_RANGE |
| Vortex R (car) | body roll OUTWARD in a turn (deg, + = outward like a real car, - = leans into the turn like a bike) | 1.208 | 0..7 | IN_RANGE |
| Vortex R (car) | roll left-turn vs right-turn size difference (deg) | 0 | 0..1 | IN_RANGE |
| Vortex R (car) | nose UP when accelerating (deg) | 1.896 | 0..4 | IN_RANGE |
| Vortex R (car) | nose DOWN when braking (deg) | 2.513 | 0..6 | IN_RANGE |
| Vortex R (car) | lowest wheel hub minus wheel radius = wheel sunk into the ground (m) | 0 | -0.05..0.05 | IN_RANGE |
| Vortex R (car) | highest wheel hub minus wheel radius = wheel floating (m) | 0 | -0.05..0.05 | IN_RANGE |
| Vortex R (car) | straight line drift with no steering after 6 s (m) | 0 | 0..0.05 | IN_RANGE |
| Vortex R (car) | speed RISES while braking and still rolling forward (m/s) | 0 | 0..0.01 | IN_RANGE |
| Vortex R (car) | strongest braking (g) | 1.787 | 0..1.6 | OUT_OF_RANGE (Minor) |
| Vortex R (car) | biggest speed jump in one 1/60 s frame (m/s) | 0.408 | 0..0.5 | IN_RANGE |
| Vortex R (car) | sideways acceleration in turns (g) | 1.252 | 0..1.625 | IN_RANGE |
| Vortex R (car) | handbrake slide angle (deg) | 71.353 | 5..90 | IN_RANGE |
| Sprint-R (bike) | any NaN / broken number while driving (0 = none) | 0 | 0..0 | IN_RANGE |
| Sprint-R (bike) | wheels turn the right way when going FORWARD (share of samples) | 1 | 1..1 | IN_RANGE |
| Sprint-R (bike) | wheels turn the right way when going in REVERSE (share of samples) | 1 | 1..1 | IN_RANGE |
| Sprint-R (bike) | wheel spin vs ground speed (1.0 = rolls without slipping) | 0.999 | 0.9..1.1 | IN_RANGE |
| Sprint-R (bike) | left input turns the vehicle left, right input turns it right (1 = yes) | 1 | 1..1 | IN_RANGE |
| Sprint-R (bike) | front wheel(s) point the way the vehicle turns (1 = yes) | 1 | 1..1 | IN_RANGE |
| Sprint-R (bike) | front wheel steer angle at full lock, parking speed (deg) | 7.917 | 8..45 | OUT_OF_RANGE (Minor) |
| Sprint-R (bike) | front wheel steer angle at 14 m/s (deg): less lock at speed | 1.565 | 1..35 | IN_RANGE |
| Sprint-R (bike) | lean INTO the turn (deg, + = into the turn) | 35.966 | 3..50 | IN_RANGE |
| Sprint-R (bike) | roll left-turn vs right-turn size difference (deg) | 0 | 0..1 | IN_RANGE |
| Sprint-R (bike) | nose UP when accelerating (deg) | 0.823 | -4..6 | IN_RANGE |
| Sprint-R (bike) | nose DOWN when braking (deg) | 1.135 | -2..8 | IN_RANGE |
| Sprint-R (bike) | lowest wheel hub minus wheel radius = wheel sunk into the ground (m) | -0.016 | -0.05..0.05 | IN_RANGE |
| Sprint-R (bike) | highest wheel hub minus wheel radius = wheel floating (m) | 0.021 | -0.05..0.05 | IN_RANGE |
| Sprint-R (bike) | straight line drift with no steering after 6 s (m) | 0 | 0..0.05 | IN_RANGE |
| Sprint-R (bike) | speed RISES while braking and still rolling forward (m/s) | 0 | 0..0.01 | IN_RANGE |
| Sprint-R (bike) | strongest braking (g) | 1.512 | 0..1.6 | IN_RANGE |
| Sprint-R (bike) | biggest speed jump in one 1/60 s frame (m/s) | 0.247 | 0..0.5 | IN_RANGE |
| Sprint-R (bike) | sideways acceleration in turns (g) | 1.077 | 0..1.4300000000000002 | IN_RANGE |
| Sprint-R (bike) | handbrake slide angle (deg) | 40.42 | 0..90 | IN_RANGE |

## Raw numbers
```json
[
 {
  "type": "apex-gt",
  "name": "Apex GT",
  "kind": "car",
  "wheelCount": 4,
  "frontSteered": 2,
  "wheelRadius": 0.335,
  "vmax": 56,
  "mu": 1.05,
  "t100": 4.067,
  "topSpeedReached": 33.547,
  "straightDrift": 0,
  "noseUpAccel": 1.445,
  "noseDownBrake": 2.288,
  "brakeSpeedRise": 0,
  "maxDecelG": 1.506,
  "reverseSpeed": -6.288,
  "spinSignFwd": 1,
  "spinSignRev": 1,
  "rollingRatio": 1,
  "leftTurnYawSign": 1,
  "rightTurnYawSign": -1,
  "frontWheelSignMatchesTurn": true,
  "steerLockDeg": 25.892,
  "steerAtSpeedDeg": 25.245,
  "ackermannDeg": 5.104,
  "rollOutwardDeg": 1.445,
  "rollSymmetry": 0,
  "maxLateralG": 1.045,
  "hubHeightErrorMin": 0,
  "hubHeightErrorMax": 0,
  "maxSpeedStepPerFrame": 0.396,
  "handbrakeSlipDeg": 65.845,
  "handbrakeYawRateMax": 0.87,
  "nan": false
 },
 {
  "type": "stallion",
  "name": "Stallion V8",
  "kind": "car",
  "wheelCount": 4,
  "frontSteered": 2,
  "wheelRadius": 0.355,
  "vmax": 52,
  "mu": 0.95,
  "t100": 4.733,
  "topSpeedReached": 30.931,
  "straightDrift": 0,
  "noseUpAccel": 1.333,
  "noseDownBrake": 2.081,
  "brakeSpeedRise": 0,
  "maxDecelG": 1.372,
  "reverseSpeed": -6.058,
  "spinSignFwd": 1,
  "spinSignRev": 1,
  "rollingRatio": 1,
  "leftTurnYawSign": 1,
  "rightTurnYawSign": -1,
  "frontWheelSignMatchesTurn": true,
  "steerLockDeg": 25.936,
  "steerAtSpeedDeg": 25.084,
  "ackermannDeg": 5.173,
  "rollOutwardDeg": 1.826,
  "rollSymmetry": 0,
  "maxLateralG": 0.944,
  "hubHeightErrorMin": 0,
  "hubHeightErrorMax": 0,
  "maxSpeedStepPerFrame": 0.388,
  "handbrakeSlipDeg": 62.967,
  "handbrakeYawRateMax": 0.805,
  "nan": false
 },
 {
  "type": "ranger",
  "name": "Ranger 4x4",
  "kind": "car",
  "wheelCount": 4,
  "frontSteered": 2,
  "wheelRadius": 0.4,
  "vmax": 38,
  "mu": 0.8,
  "t100": null,
  "topSpeedReached": 26.557,
  "straightDrift": 0,
  "noseUpAccel": 1.146,
  "noseDownBrake": 1.898,
  "brakeSpeedRise": 0,
  "maxDecelG": 1.217,
  "reverseSpeed": -5.987,
  "spinSignFwd": 1,
  "spinSignRev": 1,
  "rollingRatio": 1,
  "leftTurnYawSign": 1,
  "rightTurnYawSign": -1,
  "frontWheelSignMatchesTurn": true,
  "steerLockDeg": 25.565,
  "steerAtSpeedDeg": 24.926,
  "ackermannDeg": 5.296,
  "rollOutwardDeg": 2.414,
  "rollSymmetry": 0,
  "maxLateralG": 0.796,
  "hubHeightErrorMin": 0,
  "hubHeightErrorMax": 0,
  "maxSpeedStepPerFrame": 0.339,
  "handbrakeSlipDeg": 57.238,
  "handbrakeYawRateMax": 0.778,
  "nan": false
 },
 {
  "type": "vortex",
  "name": "Vortex R",
  "kind": "car",
  "wheelCount": 4,
  "frontSteered": 2,
  "wheelRadius": 0.345,
  "vmax": 72,
  "mu": 1.25,
  "t100": 2.683,
  "topSpeedReached": 44.018,
  "straightDrift": 0,
  "noseUpAccel": 1.896,
  "noseDownBrake": 2.513,
  "brakeSpeedRise": 0,
  "maxDecelG": 1.787,
  "reverseSpeed": -6.975,
  "spinSignFwd": 1,
  "spinSignRev": 1,
  "rollingRatio": 1,
  "leftTurnYawSign": 1,
  "rightTurnYawSign": -1,
  "frontWheelSignMatchesTurn": true,
  "steerLockDeg": 23.916,
  "steerAtSpeedDeg": 23.683,
  "ackermannDeg": 4.659,
  "rollOutwardDeg": 1.208,
  "rollSymmetry": 0,
  "maxLateralG": 1.252,
  "hubHeightErrorMin": 0,
  "hubHeightErrorMax": 0,
  "maxSpeedStepPerFrame": 0.408,
  "handbrakeSlipDeg": 71.353,
  "handbrakeYawRateMax": 0.958,
  "nan": false
 },
 {
  "type": "sprint-r",
  "name": "Sprint-R",
  "kind": "bike",
  "wheelCount": 2,
  "frontSteered": 1,
  "wheelRadius": 0.31,
  "vmax": 64,
  "mu": 1.1,
  "t100": 3.317,
  "topSpeedReached": 38.187,
  "straightDrift": 0,
  "noseUpAccel": 0.823,
  "noseDownBrake": 1.135,
  "brakeSpeedRise": 0,
  "maxDecelG": 1.512,
  "reverseSpeed": -2.245,
  "spinSignFwd": 1,
  "spinSignRev": 1,
  "rollingRatio": 0.999,
  "leftTurnYawSign": 1,
  "rightTurnYawSign": -1,
  "frontWheelSignMatchesTurn": true,
  "steerLockDeg": 7.917,
  "steerAtSpeedDeg": 1.565,
  "ackermannDeg": null,
  "rollOutwardDeg": -35.966,
  "rollSymmetry": 0,
  "maxLateralG": 1.077,
  "hubHeightErrorMin": -0.016,
  "hubHeightErrorMax": 0.021,
  "maxSpeedStepPerFrame": 0.247,
  "handbrakeSlipDeg": 40.42,
  "handbrakeYawRateMax": 1.345,
  "nan": false
 }
]
```
