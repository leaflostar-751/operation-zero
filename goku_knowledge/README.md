# GOKU knowledge pack — "degree aur skills" ka sach

**Sach:** GOKU ek program hai, usay degree nahi di ja sakti. Jo ho sakta hai: doctor/engineer/architect jaisa **ilm numbers aur rules ki shakl mein likhna**, jise GOKU har run mein game se **naap kar** compare kare. Yahi uski "skills" hain. File: `references.json`, code: `tools/oz-explorer/reference.mjs`.

| Maahir | GOKU kya naapta hai (abhi) | Status |
|---|---|---|
| Doctor / anatomy | jodon (ghutna, kohni) ka jhukna: max angle, ulta mudna; left-right limb ki lambai barabar; limb/height tanasub | MEASURED (GOKU ki 10 animation clips par) |
| Character artist | qad, tangon/bazuon/kandhon ka tanasub (hero + GOKU) | MEASURED |
| Car engineer | lambai/chorai/unchai, wheelbase, wheel radius, ratios — class ki typical range se | MEASURED (5 gaadiyan) |
| Architect / constructor | manzil ki unchai (492 imaraton mein exact; landmarks mein andaza) | MEASURED / APPROX |
| Chehra (aankhon ka faasla, naak, munh) | — | NOT_IMPLEMENTED: chehre ke hisse tag nahi (Step 1: characters ke saath) |
| Seerhi, darwaza, khidki, railing | — | NOT_IMPLEMENTED: game mein interiors/data nahi |
| Gaadi asli jaisi *dikhti* hai ya nahi | — | asli photo/blueprint + dekhne wala (insaan/Claude/vision AI) chahiye |

**Asli model se muqabla (brand-wise):** `models` list mein asli specs daalein (model ka naam + saal + length/width/height/wheelbase/wheelRadius + source). GOKU phir us gaadi ko asli model se ±3% par compare karega. Aap model ka naam bata dein, main specs web se verify kar ke daal dunga.

**Zaroori sach:**
- Ranges *typical* hain (class ki), kisi ek insaan/gaadi ki nahi. Range ke bahar = "yahan dekho", "bug hai" nahi.
- Pixel/number se "khoobsurti" ya "asli jaisa look" nahi pakda ja sakta; uske liye reference photos + dekhne wala chahiye.
- Report: `latest/game/REFERENCE.md` (poori table), `REPORT.md` (sirf range se bahar wali), GOKU ke trend mein "Outside real-world range" column.
