# GOKU permissions — "poora redesign karo, par kuch kharab mat karna" (owner ka hukm, 2026-11-23)

## Ijazat (owner ne di)
GOKU/Claude game ka **kuch bhi redesign** kar sakta hai: graphics, characters, gaadiyan, city, performance, code ka structure. Order wahi: Step 4 → 3 → 2 → 1 → 0, har step owner ki tasdeeq ke baad.

## "Kharab nahi karna" ko kaam karne wala rule banaya
Koi bhi badlaav tabhi **rakha** jata hai jab ye sab sach ho. Ek bhi jhoota to badlaav **wapas** (revert):
1. **Naap behtar** — jis issue ke liye badla (jaise draw calls) uska *LIVE* before/after number behtar ho (`drawcalls.mjs`, `goku_qa.mjs`).
2. **Kuch toota nahi** — saare unit tests PASS (reference, eyes, daily_guard, improvement, publish, relay) + regression PASS (smoke, A0 debug door "read-only", GOKU partner, explorer: koi naya Critical/Major finding nahi).
3. **Shakal wahi ya behtar** — same camera se before/after tasveer (`turntable.mjs`/A/B shots); tooti, kheenchi, gaib hui cheez = FAIL.
4. **Ek waqt mein ek badlaav**, chhota, wapas lene layak (git commit/tag).
5. **Evidence likhi hui** — `improvement.mjs add game|goku ...` mein status word, UNVERIFIED hissa, aur "owner ko kya chalana hai".

## Kahan likh sakta hai (online ke liye)
| Jagah | Ijazat |
|---|---|
| branch `reports` | haan (sirf reports, replace mode) |
| branch `goku/<issue-id>` + Pull Request | haan, evidence ke saath |
| `main` / `master` | **nahi** — merge owner karega (auto-merge abhi BAND; owner kahe to ON) |
| Windows wala asli GOKU | sirf parhna, kabhi chalana/badalna nahi |

## Hamesha mana
Paise lagne wali cheez, paid API/subscription, publish, delete (bina verified wajah), secrets/tokens repo ya chat mein, learning data ko chhoona, "AAA" ka dawa bina side-by-side evidence ke.

## Sachchai: GOKU khud kitna kar sakta hai (2026-11-23)
- Dekhna, naapna, flag karna, report/trend likhna: **haan** (online bhi, GitHub link hone ke baad — abhi UNVERIFIED).
- Code khud badalna: **NOT_IMPLEMENTED**. Abhi badlaav Claude chat mein karta hai (GOKU ki ijazat/rules ke andar). Online khud-ba-khud badalne ke 2 raaste: (a) pehle se tay "recipe" (deterministic, free) — pehla recipe: character rigid-skinning (neeche), (b) LLM driver CI mein — iske liye API key/paisa chahiye, **owner ki ijazat ke baghair nahi**.
- "Online ghante": GitHub link hone se pehle 0. Run #1 (2026-11-24, GitHub runner, LIVE): **15 min 33 s**, success. GOKU ne online abhi tak **0 fix khud kiye** — fix Claude ne likhe, GOKU ne verify kiya (khud code badalna NOT_IMPLEMENTED).

## Pehla asli fix (Step 4, OZ-001) — naap ke saath
| | Pehle | Baad |
|---|---|---|
| Draw calls (spawn, LOW tier, LIVE) | 964–969 | **681** |
| Geometries | 609 | 395 |
| Triangles | 1.175M | 1.02M |
Kya badla: `src/characters/CharacterBuilder.js` — (1) body-parts ki detail unki screen-size ke hisaab se (chhoti ungliyan/aankhein kam triangles), (2) har insaan ke ~31–61 mesh ab har material ka ek skinned mesh (rigid skinning, har vertex 100% apni purani bone se bandha) — shakal aur animation wahi.
