# Motion check (how the hero and GOKU really move)

Run 2026-11-24T07:45:43.720Z. SIMULATED (software GL). 146 measurements: 132 in typical range, 14 outside (0 Major, 14 Minor), 0 no data.

Outside a range means "go and look at the pictures", not "bug": ranges are typical adult values (textbook biomechanics, ESTIMATE).

**LIMITS:** clip only (the game also applies foot IK, and a weapon-hold IK that overrides the arms: NOT applied here); animation clips are procedural ("synthesized"); software GL; arms/hands, face, clothes clipping and vehicles are NOT in this report.

| Who / clip | Measurement | Game | Typical range | Verdict |
|---|---|---|---|---|
| hero walk | steps per minute | 126.316 | 90..135 | IN_RANGE |
| hero walk | knee bend max (deg) | 60.493 | 40..80 | IN_RANGE |
| hero walk | pelvis up-down travel (m) | 0.055 | 0.02..0.08 | IN_RANGE |
| hero walk | trunk lean forward (deg) | 2.611 | -3..10 | IN_RANGE |
| hero walk | share of time a foot is on the ground | 0.675 | 0.5..0.7 | IN_RANGE |
| hero walk | share of time BOTH feet are in the air | 0 | 0..0.02 | IN_RANGE |
| hero walk | knee bend min (deg, negative = hyper-extended) | 5.125 | -5..35 | IN_RANGE |
| hero walk | knee bent the WRONG way (deg) | 0 | 0..3 | IN_RANGE |
| hero walk | leg bone length change over the cycle (fraction) | 0 | 0..0.03 | IN_RANGE |
| hero walk | hip-ankle / leg length (1.0 = knee locked straight) | 0.999 | 0..0.995 | OUT_OF_RANGE (Minor) |
| hero walk | knee sideways off the hip-ankle line (m) = curved / bow / knock-knee | 0 | 0..0.07 | IN_RANGE |
| hero walk | left-right foot phase (0.5 = opposite) | 0.491 | 0.42..0.58 | IN_RANGE |
| hero walk | foot skating at the clip's own speed 1.46 m/s (fraction) | 0.001 | 0..0.2 | IN_RANGE |
| hero walk | foot skating at the slowest speed this clip is used (0.2 m/s) | 3.013 | 0..0.6 | OUT_OF_RANGE (Minor) |
| hero walk | foot skating at the fastest speed this clip is used (2.5 m/s) | 0.001 | 0..0.6 | IN_RANGE |
| hero run | steps per minute | 166.667 | 140..195 | IN_RANGE |
| hero run | knee bend max (deg) | 114.326 | 75..135 | IN_RANGE |
| hero run | pelvis up-down travel (m) | 0.069 | 0.04..0.13 | IN_RANGE |
| hero run | trunk lean forward (deg) | 7.656 | 2..20 | IN_RANGE |
| hero run | share of time a foot is on the ground | 0.384 | 0.25..0.5 | IN_RANGE |
| hero run | share of time BOTH feet are in the air | 0.233 | 0..0.4 | IN_RANGE |
| hero run | knee bend min (deg, negative = hyper-extended) | 5.125 | -5..35 | IN_RANGE |
| hero run | knee bent the WRONG way (deg) | 0 | 0..3 | IN_RANGE |
| hero run | leg bone length change over the cycle (fraction) | 0 | 0..0.03 | IN_RANGE |
| hero run | hip-ankle / leg length (1.0 = knee locked straight) | 0.999 | 0..0.995 | OUT_OF_RANGE (Minor) |
| hero run | knee sideways off the hip-ankle line (m) = curved / bow / knock-knee | 0 | 0..0.07 | IN_RANGE |
| hero run | left-right foot phase (0.5 = opposite) | 0.465 | 0.42..0.58 | IN_RANGE |
| hero run | foot skating at the clip's own speed 2.997 m/s (fraction) | 0.003 | 0..0.2 | IN_RANGE |
| hero run | foot skating at the slowest speed this clip is used (2 m/s) | 0.003 | 0..0.6 | IN_RANGE |
| hero run | foot skating at the fastest speed this clip is used (5.2 m/s) | 0.003 | 0..0.6 | IN_RANGE |
| hero sprint | steps per minute | 214.286 | 165..235 | IN_RANGE |
| hero sprint | knee bend max (deg) | 128.33 | 90..150 | IN_RANGE |
| hero sprint | pelvis up-down travel (m) | 0.077 | 0.04..0.15 | IN_RANGE |
| hero sprint | trunk lean forward (deg) | 12.253 | 6..32 | IN_RANGE |
| hero sprint | share of time a foot is on the ground | 0.313 | 0.15..0.4 | IN_RANGE |
| hero sprint | share of time BOTH feet are in the air | 0.373 | 0..0.6 | IN_RANGE |
| hero sprint | knee bend min (deg, negative = hyper-extended) | 5.125 | -5..35 | IN_RANGE |
| hero sprint | knee bent the WRONG way (deg) | 0 | 0..3 | IN_RANGE |
| hero sprint | leg bone length change over the cycle (fraction) | 0 | 0..0.03 | IN_RANGE |
| hero sprint | hip-ankle / leg length (1.0 = knee locked straight) | 0.999 | 0..0.995 | OUT_OF_RANGE (Minor) |
| hero sprint | knee sideways off the hip-ankle line (m) = curved / bow / knock-knee | 0 | 0..0.07 | IN_RANGE |
| hero sprint | left-right foot phase (0.5 = opposite) | 0.5 | 0.42..0.58 | IN_RANGE |
| hero sprint | foot skating at the clip's own speed 5.303 m/s (fraction) | 0.001 | 0..0.2 | IN_RANGE |
| hero sprint | foot skating at the slowest speed this clip is used (4.6 m/s) | 0.001 | 0..0.6 | IN_RANGE |
| hero sprint | foot skating at the fastest speed this clip is used (7.5 m/s) | 0.001 | 0..0.6 | IN_RANGE |
| hero crouch-walk | steps per minute | 126.316 | 70..130 | IN_RANGE |
| hero crouch-walk | knee bend max (deg) | 85.944 | 40..130 | IN_RANGE |
| hero crouch-walk | pelvis up-down travel (m) | 0.019 | 0..0.1 | IN_RANGE |
| hero crouch-walk | trunk lean forward (deg) | 15.942 | 0..40 | IN_RANGE |
| hero crouch-walk | share of time a foot is on the ground | 0.447 | 0.45..0.8 | OUT_OF_RANGE (Minor) |
| hero crouch-walk | share of time BOTH feet are in the air | 0.105 | 0..0.02 | OUT_OF_RANGE (Minor) |
| hero crouch-walk | knee bend min (deg, negative = hyper-extended) | 65.89 | 20..95 | IN_RANGE |
| hero crouch-walk | knee bent the WRONG way (deg) | 0 | 0..3 | IN_RANGE |
| hero crouch-walk | leg bone length change over the cycle (fraction) | 0 | 0..0.03 | IN_RANGE |
| hero crouch-walk | hip-ankle / leg length (1.0 = knee locked straight) | 0.839 | 0..0.995 | IN_RANGE |
| hero crouch-walk | knee sideways off the hip-ankle line (m) = curved / bow / knock-knee | 0 | 0..0.07 | IN_RANGE |
| hero crouch-walk | left-right foot phase (0.5 = opposite) | 0.491 | 0.42..0.58 | IN_RANGE |
| hero crouch-walk | foot skating at the clip's own speed 1.35 m/s (fraction) | 0.076 | 0..0.2 | IN_RANGE |
| hero crouch-walk | foot skating at the slowest speed this clip is used (0.25 m/s) | 1.745 | 0..0.6 | OUT_OF_RANGE (Minor) |
| hero crouch-walk | foot skating at the fastest speed this clip is used (1.8 m/s) | 0.076 | 0..0.6 | IN_RANGE |
| hero blend idle -> walk | biggest one-frame joint turn (deg, bone RightLeg) | 12.801 | 0..30 | IN_RANGE |
| hero blend walk -> run | biggest one-frame joint turn (deg, bone LeftLeg) | 17.321 | 0..30 | IN_RANGE |
| hero blend run -> sprint | biggest one-frame joint turn (deg, bone LeftLeg) | 21.594 | 0..30 | IN_RANGE |
| hero blend sprint -> run | biggest one-frame joint turn (deg, bone RightLeg) | 16.341 | 0..30 | IN_RANGE |
| hero blend run -> walk | biggest one-frame joint turn (deg, bone LeftLeg) | 15.99 | 0..30 | IN_RANGE |
| hero blend walk -> idle | biggest one-frame joint turn (deg, bone LeftLeg) | 8.431 | 0..30 | IN_RANGE |
| hero blend idle -> jump | biggest one-frame joint turn (deg, bone LeftArm) | 5.779 | 0..30 | IN_RANGE |
| hero blend jump -> fall | biggest one-frame joint turn (deg, bone LeftArm) | 1.499 | 0..30 | IN_RANGE |
| hero blend fall -> land | biggest one-frame joint turn (deg, bone LeftArm) | 3.039 | 0..30 | IN_RANGE |
| hero blend land -> idle | biggest one-frame joint turn (deg, bone LeftLeg) | 4.616 | 0..30 | IN_RANGE |
| hero blend idle -> crouch | biggest one-frame joint turn (deg, bone LeftLeg) | 6.738 | 0..30 | IN_RANGE |
| hero blend crouch -> crouch-walk | biggest one-frame joint turn (deg, bone RightUpLeg) | 3.036 | 0..30 | IN_RANGE |
| hero blend idle -> turn | biggest one-frame joint turn (deg, bone LeftUpLeg) | 2.156 | 0..30 | IN_RANGE |
| goku walk | steps per minute | 126.316 | 90..135 | IN_RANGE |
| goku walk | knee bend max (deg) | 60.765 | 40..80 | IN_RANGE |
| goku walk | pelvis up-down travel (m) | 0.055 | 0.02..0.08 | IN_RANGE |
| goku walk | trunk lean forward (deg) | 2.292 | -3..10 | IN_RANGE |
| goku walk | share of time a foot is on the ground | 0.675 | 0.5..0.7 | IN_RANGE |
| goku walk | share of time BOTH feet are in the air | 0 | 0..0.02 | IN_RANGE |
| goku walk | knee bend min (deg, negative = hyper-extended) | 5.125 | -5..35 | IN_RANGE |
| goku walk | knee bent the WRONG way (deg) | 0 | 0..3 | IN_RANGE |
| goku walk | leg bone length change over the cycle (fraction) | 0 | 0..0.03 | IN_RANGE |
| goku walk | hip-ankle / leg length (1.0 = knee locked straight) | 0.999 | 0..0.995 | OUT_OF_RANGE (Minor) |
| goku walk | knee sideways off the hip-ankle line (m) = curved / bow / knock-knee | 0 | 0..0.07 | IN_RANGE |
| goku walk | left-right foot phase (0.5 = opposite) | 0.491 | 0.42..0.58 | IN_RANGE |
| goku walk | foot skating at the clip's own speed 1.46 m/s (fraction) | 0.001 | 0..0.2 | IN_RANGE |
| goku walk | foot skating at the slowest speed this clip is used (0.2 m/s) | 3.012 | 0..0.6 | OUT_OF_RANGE (Minor) |
| goku walk | foot skating at the fastest speed this clip is used (2.5 m/s) | 0.001 | 0..0.6 | IN_RANGE |
| goku run | steps per minute | 166.667 | 140..195 | IN_RANGE |
| goku run | knee bend max (deg) | 114.05 | 75..135 | IN_RANGE |
| goku run | pelvis up-down travel (m) | 0.069 | 0.04..0.13 | IN_RANGE |
| goku run | trunk lean forward (deg) | 7.338 | 2..20 | IN_RANGE |
| goku run | share of time a foot is on the ground | 0.378 | 0.25..0.5 | IN_RANGE |
| goku run | share of time BOTH feet are in the air | 0.244 | 0..0.4 | IN_RANGE |
| goku run | knee bend min (deg, negative = hyper-extended) | 5.125 | -5..35 | IN_RANGE |
| goku run | knee bent the WRONG way (deg) | 0 | 0..3 | IN_RANGE |
| goku run | leg bone length change over the cycle (fraction) | 0 | 0..0.03 | IN_RANGE |
| goku run | hip-ankle / leg length (1.0 = knee locked straight) | 0.999 | 0..0.995 | OUT_OF_RANGE (Minor) |
| goku run | knee sideways off the hip-ankle line (m) = curved / bow / knock-knee | 0 | 0..0.07 | IN_RANGE |
| goku run | left-right foot phase (0.5 = opposite) | 0.488 | 0.42..0.58 | IN_RANGE |
| goku run | foot skating at the clip's own speed 2.997 m/s (fraction) | 0.001 | 0..0.2 | IN_RANGE |
| goku run | foot skating at the slowest speed this clip is used (2 m/s) | 0.001 | 0..0.6 | IN_RANGE |
| goku run | foot skating at the fastest speed this clip is used (5.2 m/s) | 0.001 | 0..0.6 | IN_RANGE |
| goku sprint | steps per minute | 214.286 | 165..235 | IN_RANGE |
| goku sprint | knee bend max (deg) | 128.641 | 90..150 | IN_RANGE |
| goku sprint | pelvis up-down travel (m) | 0.077 | 0.04..0.15 | IN_RANGE |
| goku sprint | trunk lean forward (deg) | 11.934 | 6..32 | IN_RANGE |
| goku sprint | share of time a foot is on the ground | 0.313 | 0.15..0.4 | IN_RANGE |
| goku sprint | share of time BOTH feet are in the air | 0.373 | 0..0.6 | IN_RANGE |
| goku sprint | knee bend min (deg, negative = hyper-extended) | 5.125 | -5..35 | IN_RANGE |
| goku sprint | knee bent the WRONG way (deg) | 0 | 0..3 | IN_RANGE |
| goku sprint | leg bone length change over the cycle (fraction) | 0 | 0..0.03 | IN_RANGE |
| goku sprint | hip-ankle / leg length (1.0 = knee locked straight) | 0.999 | 0..0.995 | OUT_OF_RANGE (Minor) |
| goku sprint | knee sideways off the hip-ankle line (m) = curved / bow / knock-knee | 0 | 0..0.07 | IN_RANGE |
| goku sprint | left-right foot phase (0.5 = opposite) | 0.5 | 0.42..0.58 | IN_RANGE |
| goku sprint | foot skating at the clip's own speed 5.303 m/s (fraction) | 0.002 | 0..0.2 | IN_RANGE |
| goku sprint | foot skating at the slowest speed this clip is used (4.6 m/s) | 0.002 | 0..0.6 | IN_RANGE |
| goku sprint | foot skating at the fastest speed this clip is used (7.5 m/s) | 0.002 | 0..0.6 | IN_RANGE |
| goku crouch-walk | steps per minute | 126.316 | 70..130 | IN_RANGE |
| goku crouch-walk | knee bend max (deg) | 85.944 | 40..130 | IN_RANGE |
| goku crouch-walk | pelvis up-down travel (m) | 0.019 | 0..0.1 | IN_RANGE |
| goku crouch-walk | trunk lean forward (deg) | 15.621 | 0..40 | IN_RANGE |
| goku crouch-walk | share of time a foot is on the ground | 0.447 | 0.45..0.8 | OUT_OF_RANGE (Minor) |
| goku crouch-walk | share of time BOTH feet are in the air | 0.105 | 0..0.02 | OUT_OF_RANGE (Minor) |
| goku crouch-walk | knee bend min (deg, negative = hyper-extended) | 65.89 | 20..95 | IN_RANGE |
| goku crouch-walk | knee bent the WRONG way (deg) | 0 | 0..3 | IN_RANGE |
| goku crouch-walk | leg bone length change over the cycle (fraction) | 0 | 0..0.03 | IN_RANGE |
| goku crouch-walk | hip-ankle / leg length (1.0 = knee locked straight) | 0.839 | 0..0.995 | IN_RANGE |
| goku crouch-walk | knee sideways off the hip-ankle line (m) = curved / bow / knock-knee | 0 | 0..0.07 | IN_RANGE |
| goku crouch-walk | left-right foot phase (0.5 = opposite) | 0.491 | 0.42..0.58 | IN_RANGE |
| goku crouch-walk | foot skating at the clip's own speed 1.35 m/s (fraction) | 0.076 | 0..0.2 | IN_RANGE |
| goku crouch-walk | foot skating at the slowest speed this clip is used (0.25 m/s) | 1.745 | 0..0.6 | OUT_OF_RANGE (Minor) |
| goku crouch-walk | foot skating at the fastest speed this clip is used (1.8 m/s) | 0.076 | 0..0.6 | IN_RANGE |
| goku blend idle -> walk | biggest one-frame joint turn (deg, bone RightLeg) | 14.631 | 0..30 | IN_RANGE |
| goku blend walk -> run | biggest one-frame joint turn (deg, bone LeftLeg) | 17.695 | 0..30 | IN_RANGE |
| goku blend run -> sprint | biggest one-frame joint turn (deg, bone LeftLeg) | 18.376 | 0..30 | IN_RANGE |
| goku blend sprint -> run | biggest one-frame joint turn (deg, bone RightLeg) | 18.389 | 0..30 | IN_RANGE |
| goku blend run -> walk | biggest one-frame joint turn (deg, bone RightLeg) | 14.631 | 0..30 | IN_RANGE |
| goku blend walk -> idle | biggest one-frame joint turn (deg, bone LeftUpLeg) | 4.965 | 0..30 | IN_RANGE |
| goku blend idle -> jump | biggest one-frame joint turn (deg, bone LeftArm) | 5.779 | 0..30 | IN_RANGE |
| goku blend jump -> fall | biggest one-frame joint turn (deg, bone LeftArm) | 1.499 | 0..30 | IN_RANGE |
| goku blend fall -> land | biggest one-frame joint turn (deg, bone LeftArm) | 3.039 | 0..30 | IN_RANGE |
| goku blend land -> idle | biggest one-frame joint turn (deg, bone LeftLeg) | 4.616 | 0..30 | IN_RANGE |
| goku blend idle -> crouch | biggest one-frame joint turn (deg, bone LeftLeg) | 6.738 | 0..30 | IN_RANGE |
| goku blend crouch -> crouch-walk | biggest one-frame joint turn (deg, bone RightUpLeg) | 3.036 | 0..30 | IN_RANGE |
| goku blend idle -> turn | biggest one-frame joint turn (deg, bone LeftUpLeg) | 2.156 | 0..30 | IN_RANGE |

## Raw numbers per clip
```json
[
 {
  "who": "hero",
  "synthesized": true,
  "forwardOk": true,
  "states": [
   {
    "state": "walk",
    "duration": 0.95,
    "refSpeed": 1.46,
    "cadence": 126.316,
    "kneeFlexMax": 60.493,
    "kneeFlexMin": 5.125,
    "kneeWrongWay": 0,
    "legStretch": 0,
    "reachMax": 0.999,
    "bow": 0,
    "bob": 0.055,
    "lean": 2.611,
    "duty": 0.675,
    "flight": 0,
    "doubleSupport": 0.351,
    "phase": 0.491,
    "stanceFootSpeed": 1.459,
    "slideRef": 0.001,
    "slideLow": 3.013,
    "slideHigh": 0.001,
    "domain": [
     0.2,
     2.5
    ],
    "samples": 114,
    "stanceSamples": 148
   },
   {
    "state": "run",
    "duration": 0.72,
    "refSpeed": 2.997,
    "cadence": 166.667,
    "kneeFlexMax": 114.326,
    "kneeFlexMin": 5.125,
    "kneeWrongWay": 0,
    "legStretch": 0,
    "reachMax": 0.999,
    "bow": 0,
    "bob": 0.069,
    "lean": 7.656,
    "duty": 0.384,
    "flight": 0.233,
    "doubleSupport": 0,
    "phase": 0.465,
    "stanceFootSpeed": 2.988,
    "slideRef": 0.003,
    "slideLow": 0.003,
    "slideHigh": 0.003,
    "domain": [
     2,
     5.2
    ],
    "samples": 86,
    "stanceSamples": 61
   },
   {
    "state": "sprint",
    "duration": 0.56,
    "refSpeed": 5.303,
    "cadence": 214.286,
    "kneeFlexMax": 128.33,
    "kneeFlexMin": 5.125,
    "kneeWrongWay": 0,
    "legStretch": 0,
    "reachMax": 0.999,
    "bow": 0,
    "bob": 0.077,
    "lean": 12.253,
    "duty": 0.313,
    "flight": 0.373,
    "doubleSupport": 0,
    "phase": 0.5,
    "stanceFootSpeed": 5.296,
    "slideRef": 0.001,
    "slideLow": 0.001,
    "slideHigh": 0.001,
    "domain": [
     4.6,
     7.5
    ],
    "samples": 67,
    "stanceSamples": 37
   },
   {
    "state": "crouch-walk",
    "duration": 0.95,
    "refSpeed": 1.35,
    "cadence": 126.316,
    "kneeFlexMax": 85.944,
    "kneeFlexMin": 65.89,
    "kneeWrongWay": 0,
    "legStretch": 0,
    "reachMax": 0.839,
    "bow": 0,
    "bob": 0.019,
    "lean": 15.942,
    "duty": 0.447,
    "flight": 0.105,
    "doubleSupport": 0,
    "phase": 0.491,
    "stanceFootSpeed": 1.248,
    "slideRef": 0.076,
    "slideLow": 1.745,
    "slideHigh": 0.076,
    "domain": [
     0.25,
     1.8
    ],
    "samples": 114,
    "stanceSamples": 97
   }
  ],
  "pops": [
   {
    "from": "idle",
    "to": "walk",
    "maxStepDeg": 12.801,
    "bone": "RightLeg"
   },
   {
    "from": "walk",
    "to": "run",
    "maxStepDeg": 17.321,
    "bone": "LeftLeg"
   },
   {
    "from": "run",
    "to": "sprint",
    "maxStepDeg": 21.594,
    "bone": "LeftLeg"
   },
   {
    "from": "sprint",
    "to": "run",
    "maxStepDeg": 16.341,
    "bone": "RightLeg"
   },
   {
    "from": "run",
    "to": "walk",
    "maxStepDeg": 15.99,
    "bone": "LeftLeg"
   },
   {
    "from": "walk",
    "to": "idle",
    "maxStepDeg": 8.431,
    "bone": "LeftLeg"
   },
   {
    "from": "idle",
    "to": "jump",
    "maxStepDeg": 5.779,
    "bone": "LeftArm"
   },
   {
    "from": "jump",
    "to": "fall",
    "maxStepDeg": 1.499,
    "bone": "LeftArm"
   },
   {
    "from": "fall",
    "to": "land",
    "maxStepDeg": 3.039,
    "bone": "LeftArm"
   },
   {
    "from": "land",
    "to": "idle",
    "maxStepDeg": 4.616,
    "bone": "LeftLeg"
   },
   {
    "from": "idle",
    "to": "crouch",
    "maxStepDeg": 6.738,
    "bone": "LeftLeg"
   },
   {
    "from": "crouch",
    "to": "crouch-walk",
    "maxStepDeg": 3.036,
    "bone": "RightUpLeg"
   },
   {
    "from": "idle",
    "to": "turn",
    "maxStepDeg": 2.156,
    "bone": "LeftUpLeg"
   }
  ]
 },
 {
  "who": "goku",
  "synthesized": true,
  "forwardOk": true,
  "states": [
   {
    "state": "walk",
    "duration": 0.95,
    "refSpeed": 1.46,
    "cadence": 126.316,
    "kneeFlexMax": 60.765,
    "kneeFlexMin": 5.125,
    "kneeWrongWay": 0,
    "legStretch": 0,
    "reachMax": 0.999,
    "bow": 0,
    "bob": 0.055,
    "lean": 2.292,
    "duty": 0.675,
    "flight": 0,
    "doubleSupport": 0.351,
    "phase": 0.491,
    "stanceFootSpeed": 1.459,
    "slideRef": 0.001,
    "slideLow": 3.012,
    "slideHigh": 0.001,
    "domain": [
     0.2,
     2.5
    ],
    "samples": 114,
    "stanceSamples": 149
   },
   {
    "state": "run",
    "duration": 0.72,
    "refSpeed": 2.997,
    "cadence": 166.667,
    "kneeFlexMax": 114.05,
    "kneeFlexMin": 5.125,
    "kneeWrongWay": 0,
    "legStretch": 0,
    "reachMax": 0.999,
    "bow": 0,
    "bob": 0.069,
    "lean": 7.338,
    "duty": 0.378,
    "flight": 0.244,
    "doubleSupport": 0,
    "phase": 0.488,
    "stanceFootSpeed": 2.993,
    "slideRef": 0.001,
    "slideLow": 0.001,
    "slideHigh": 0.001,
    "domain": [
     2,
     5.2
    ],
    "samples": 86,
    "stanceSamples": 60
   },
   {
    "state": "sprint",
    "duration": 0.56,
    "refSpeed": 5.303,
    "cadence": 214.286,
    "kneeFlexMax": 128.641,
    "kneeFlexMin": 5.125,
    "kneeWrongWay": 0,
    "legStretch": 0,
    "reachMax": 0.999,
    "bow": 0,
    "bob": 0.077,
    "lean": 11.934,
    "duty": 0.313,
    "flight": 0.373,
    "doubleSupport": 0,
    "phase": 0.5,
    "stanceFootSpeed": 5.291,
    "slideRef": 0.002,
    "slideLow": 0.002,
    "slideHigh": 0.002,
    "domain": [
     4.6,
     7.5
    ],
    "samples": 67,
    "stanceSamples": 37
   },
   {
    "state": "crouch-walk",
    "duration": 0.95,
    "refSpeed": 1.35,
    "cadence": 126.316,
    "kneeFlexMax": 85.944,
    "kneeFlexMin": 65.89,
    "kneeWrongWay": 0,
    "legStretch": 0,
    "reachMax": 0.839,
    "bow": 0,
    "bob": 0.019,
    "lean": 15.621,
    "duty": 0.447,
    "flight": 0.105,
    "doubleSupport": 0,
    "phase": 0.491,
    "stanceFootSpeed": 1.248,
    "slideRef": 0.076,
    "slideLow": 1.745,
    "slideHigh": 0.076,
    "domain": [
     0.25,
     1.8
    ],
    "samples": 114,
    "stanceSamples": 97
   }
  ],
  "pops": [
   {
    "from": "idle",
    "to": "walk",
    "maxStepDeg": 14.631,
    "bone": "RightLeg"
   },
   {
    "from": "walk",
    "to": "run",
    "maxStepDeg": 17.695,
    "bone": "LeftLeg"
   },
   {
    "from": "run",
    "to": "sprint",
    "maxStepDeg": 18.376,
    "bone": "LeftLeg"
   },
   {
    "from": "sprint",
    "to": "run",
    "maxStepDeg": 18.389,
    "bone": "RightLeg"
   },
   {
    "from": "run",
    "to": "walk",
    "maxStepDeg": 14.631,
    "bone": "RightLeg"
   },
   {
    "from": "walk",
    "to": "idle",
    "maxStepDeg": 4.965,
    "bone": "LeftUpLeg"
   },
   {
    "from": "idle",
    "to": "jump",
    "maxStepDeg": 5.779,
    "bone": "LeftArm"
   },
   {
    "from": "jump",
    "to": "fall",
    "maxStepDeg": 1.499,
    "bone": "LeftArm"
   },
   {
    "from": "fall",
    "to": "land",
    "maxStepDeg": 3.039,
    "bone": "LeftArm"
   },
   {
    "from": "land",
    "to": "idle",
    "maxStepDeg": 4.616,
    "bone": "LeftLeg"
   },
   {
    "from": "idle",
    "to": "crouch",
    "maxStepDeg": 6.738,
    "bone": "LeftLeg"
   },
   {
    "from": "crouch",
    "to": "crouch-walk",
    "maxStepDeg": 3.036,
    "bone": "RightUpLeg"
   },
   {
    "from": "idle",
    "to": "turn",
    "maxStepDeg": 2.156,
    "bone": "LeftUpLeg"
   }
  ]
 }
]
```
