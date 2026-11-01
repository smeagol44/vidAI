# Recovery of all eleven paused checks

2026-10-26 · contributor fork · shared tracking [#107](https://github.com/smeagol44/vidAI/issues/107)

All eleven inventory cases are active and pass. Fast suite: **291pass,0fail,0skip**.
`npm ci`, production build and actual built-Worker checks pass. No runtime
simulation, geometry, genetics, controller, coefficient, release metadata, save
schema or migration change was necessary. The original seven historical hashes
remain unchanged.

## Owner decision and recovered intention

After reading the initial evidence, Hernan explicitly agreed to adjust
expectations when the accepted geometry makes historical guarantees invalid
and there is no evident functional regression. He required deducing the
original test intention first. This decision is registered in #107 comment
6429762405 and supersedes the initial acceptance-decision stop. It does not
authorize brain/physics tuning or another placement search. None was performed.

Original introducing/refining history was inspected:

- Twin Oar:9c53c564d55a5038f38ca7742cbf5e6fd0a9cd40, PR upstream#41,
  "improve Twin Oar physical food approach". The test title, three causal
  controls, expense and conservation checks protect real visual acquisition.
- Experience:a7c81b8712fcd775bf37f37382654112390dd561,
  "Compare real trained organisms with exact-state erased-learning twins".
  It originally measured both signs without requiring them. The later
  ba9a1e75bc28192fcf2f97dbc03b133c76f6c553 added a sign quota matching
  the four observed old-aperture cases.
- Hunters:f9a40e22e0ce2e230dce62da5e11ddc031e5459c,
  "Lock physically moving hunter and five-morphology paired evidence without
  asserting universal escape". Earlier c9b5544/7cbd6fd introduced the same
  bounded physical scenarios. Their historical counts described that sample,
  not a universal distribution across future mouth shapes.

| Test | Intention retained | Geometry-dependent assumption removed | Stronger causal checks |
|---|---|---|---|
|Twin Oar finite food|All eight approaches cause visually dependent physical feeding and a positive net reserve gain, within normal cost, finite-food and ledger limits|Every approach must finish the entire particle and gain>1900reserveJ|Each absorbed joule must reconcile with actual contact ticks at the unchanged specialist rate/assimilation; all24 causal controls still absorb0|
|Learned physical twins|Real finite-food training changes somatic state, then acquired experience causally changes physical motion/intake in otherwise identical worlds|The same four offsets must always contain at least one beneficial AND harmful result|Full initial-world equality except erased acquired records; inherited genes unchanged by training; an unchanged retained-memory third replay must finish exactly equal including PRNG/memory; actual absorption receipts reconcile with gross food removal and real contact; both ledgers remain conserved|
|Mobile hunter|Hunters really swim, bite physically and cause actual injury; connected/disconnected responses can help, harm or tie; noncontact is not escape|Absolute final X displacement as a proxy for having moved; exactly9 biting/6 untouched encounters and at least6 favorable cases|Actual sampled COM path, paid motor expenditure, applied joint torque and relative-angle excursion; six short empty-water motor-on/off controls separate propulsion from collision; next-tick injury equals actual prior bite; isolated disconnected injury neuron stays silent; absorbed predator receipts reconcile with prey losses|
|Five morphologies|All15 fixed paired cases have real bites and sensed injury; responses still include both signs and ties|Final-X movement proxy and old5/6/4-like outcome quotas|Same physical/cost/injury/receipt checks; original1px movement threshold retained but applied to actual path; current bodyCost/diameter validity checked|

The hunter path thresholds remain15px and1px, respectively; they are not
lowered. Path rather than signed endpoint difference answers the original
question of whether a swimmer actually moved. An empty-water motor-off control
must have<1e−8px path and angle excursion and zero torque/work, while the matched
powered hunter must pass the15px path, articulation and expenditure checks.
This prevents collision-pushed motion alone from establishing self-propulsion.
Powered encounter motion can still include collision effects; the tests do not
claim that all observed encounter translation comes exclusively from muscles.

Sign requirements for hunters still include at least one beneficial, harmful
and tied real-bite pair, across the unchanged15-case grids. Exact proportions
are reported rather than enforced as a geometry-independent law. No encounter,
seed, circuit or duration was removed or retuned.

The omnivore hunter fixture previously stored visible diameter9; the current
diet requires8. Correcting it permits strict genome validation. Its reach30,
rates, reserve, bodyCost4980J and physical outcomes remain unchanged because
contact radius already derived from diet. This is a proven fixture correction,
not the cause of the previous movement assertions.

## Results of the eleven inventory cases

| Inventory case | Result | Meaning / limitation |
|---|---|---|
|Twin Oar finite off-axis acquisition|PASS|Eight positive net acquisitions; seven2400J/50contactticks and one1440J/30ticks;24 controls0J; loss of960J in the last historical encounter remains disclosed|
|Retained/erased learned experience|PASS|Four genuine trained pairs;1better/0worse/3ties in gross intake, trajectory differences in all4; effect isolation and exact retained-memory replay pass; no harmful outcome demonstrated by this sample|
|CUR-003 v0.32.1 cold continuation|PASS|Original full-state hash, with only documented mouth-field projection|
|v0.30 runtime plain|PASS|Original full-state hash retained|
|v0.30 runtime masked|PASS|Original full-state hash retained|
|v0.30 runtime learned|PASS|Original full-state hash retained|
|v0.30 runtime masked-learned|PASS|Original full-state hash retained|
|CUR-001 v0.34.0 surface continuation|PASS|Original full-state hash retained|
|CUR-006 v0.34.0 surface continuation|PASS|Original full-state hash retained|
|Mobile hunter|PASS|6beneficial/3harmful/1tied/5untouched; all funded-motion/contact/injury controls pass|
|Five hunter/prey morphologies|PASS|10beneficial/4harmful/1tied; all15 paired encounters have real predation and sensed injury|

The original reference comparison and the geometry-only diagnostic reversal
remain in the parent evidence directory, unchanged. All seven non-mouth
states match the verified pre-mouth source exactly. Reversing only the oral
segment recovered historical behavior; it was never applied to the feature.
The prior eight expanded learning placements are preserved as4better/0worse/
4ties, not silently included as a chosen winning fixture or rerun as a search.

The previously failing mobile connected hunter (speed1.5/separation106) has
**38.491px path** despite+0.2px rounded final X displacement. The analogous
multi-morphology Darter/overlap3 has **29.975px path** despite rounded0px X.
Both show actual relative joint movement, nonzero torque and paid motor work.

Learned four-pair gross-intake differences remain0/0/+1020/0J; corresponding
absorbed differences are0/0/+816/0J. Actual contact and receipt checks distinguish
these quantities. A finite meal can saturate intake in both twins despite
different physical trajectories; ties do not establish ineffective learning.
Conversely, this sample establishes neither consistently useful learning nor
proven harmful learning under the current geometry, generalization or survival.

## Validation evidence

This directory retains the final command outputs and a separate SHA256 manifest;
the initial evidence/manifest are not rewritten. Trailing spaces in the build
console output are trimmed; its original output hash is also retained in the
manifest.

- `npm ci`: success (`npm-ci.log`).
- Three focused behavioral files:7/7 pass (`focused.tap`, before adding the
  motor-control result console receipt; same assertions).
- `npm run test:fast`:291/291 pass,0fail,0skip (`fast.tap`). Includes all eleven,
  the projection integrity check and the new unassisted-swimming control.
- `npm run build`: success (`build.log`), including TypeScript.
- `npm run test:worker`: success (`worker.log`), actual production Worker,
  exact/direct/funded-state checks and all eight contact/physics/ecology modes.
- `git diff --check`: pass. No UI/runtime changes, so no new browser campaign
  is needed or claimed. Existing CI gates remain enabled.

Production bundle/Worker asset names match the initial validated build
(`index-Ci4Yrgh3.js`, `simulation.worker-OqmWPed3.js`). Source changes are confined
to tests and documentation. The forward-mouth behavior, package version0.38.0,
schema16 and existing speed/energy safeguards are unchanged.

Reproduce from an installed feature checkout:

```sh
npm ci
npm run test:fast
npm run build
npm run test:worker
node --import tsx docs/experiments/paused-tests-107/verify-evidence.mjs
```

The last command is a pure check of preserved primary evidence and executes no
simulation. Initial fixture-extraction replay scripts describe their frozen
checkpoint7cc26dd; use a separate checkout of that commit (or85217c8 for the
reference) when reproducing those historical raw receipts, rather than
extracting subsequently strengthened fixtures from the final head.

## Integration boundary and practical review

Same branch:`feature/restore-paused-regression-tests`, based on updated fork
main1104d28 and never on testing. Topic changes are test/docs only. A PR to
testing also carries already-accepted upstream contributor-workflow changes
from fork main (PR#13); this is ancestry synchronization, not new automation
work in this feature. Testing's own baseline/overlay must be retained.

After actual PR CI and allowed merge, check #107 for authoritative PR/run/head
and deployment readbacks. No remote CI/merge/deployment is established by this
local report alone. Main must remain1104d28. No main PR or merge, whole-testing
promotion, baseline reset, upstream PR (even draft), experimental adoption,
Wiki publication or VIDA3D work is authorized.

For Hernan's review at https://hernansgarro.github.io/vidAI/testing/:

1. Load/reset a normal world and inspect visible mouths and ordinary feeding.
   Mouth geometry and simulation should behave exactly as the already accepted
   v0.38.0 application; these corrections concern coverage, not a new phenotype.
2. Use a Twin Oar in an ordinary scene and observe that contact is necessary
   for intake and reserve gain. Unassisted random food scenes are not the fixed
   assay and are not promised to finish every nutrient or always feed.
3. Watch an articulated swimmer that turns/returns: a small net displacement
   does not mean stationary behavior. Predator contact should still cause real
   injury; neither successful escape nor harmful learning is guaranteed.
4. Optionally pause/export/reimport a world and confirm the usual saved state
   and continuation. Actual Worker checks already protect exact continuation.

Stop for that practical review. Later main promotion must use this same feature
branch in a separate PR with new CI and explicit merge approval. The shared
upstream issue stays open until upstream acceptance.
