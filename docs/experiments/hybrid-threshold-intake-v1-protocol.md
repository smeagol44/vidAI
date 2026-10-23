# Revised hybrid threshold intake v1 — registered protocol

Owner-approved follow-up to #87 / draft #88 (b64481eb02a4c253637cae3d91375a5051405fd1).
Only smeagol44/vidAI; offline, draft/unmerged, no production/deployment changes.

- ONLY revised neural hybrid: FIVE independent fresh whole-brain seeds
  [17,71,1901,4099,8191], predetermined before any evaluation.
- EACH15 generations x15 offspring x12s;1125 offspring +5 founders.
  Eight random neural scalar mutations with replacement, Gaussian sigma.15,
  unchanged bounds and mutation streams; no targeted/bias initial connections.
- Reuse #88 initializer exactly, changing ONLY explicit controller version and
  threshold latch metadata. Fresh sensory, recurrent, motor weights/biases;
  same unchanged Darter anatomy/CPG/motor capacity/learning; no trained transfer.
- Mode nominal ranges: x<-.9 OFF, -.9<=x<=0 DIRECT, 0<x<=.9 OSCILLATOR,
  x>.9 OFF. Exactly-.9 DIRECT. Command retains signed torque or
  (command+1)/2 oscillator strength; no gain/strength/physics changes.
- Width.06 hysteresis at EVERY boundary -.9,0,.9. Four ordered band latches
  (negative OFF / DIRECT / OSCILLATOR / positive OFF), mapped to three modes.
  Rising crosses boundary+.06; falling crosses boundary-.06 (strict).
  Evaluate all crossed bands in ONE neural update; no dwell/ramp/cooldown.
  At zero width use exact nominal endpoint rules. Initial latch DIRECT,
  as #88. Save band state explicitly in a new testing-only controller/schema;
  never reinterpret old neural-motor-v1/.30 genes or snapshots.
- Exact #87 ecosystem:1000x800, root500,400 heading.37, environmental seed73,
  240 ordinary3000J nutrients using existing65% cluster/35% uniform recipe,
  12 sites and96px halfspread, gravity0, viscosity.18, v3/capsule-v1.
  Same positions/properties/PRNG and all environmental settings; full reset.
  Normal10000J founder reserve, no replenishment or relocated food.
- Reuse unchanged12s ephemeral nonlethal evaluation; no energy creation,
  normal insufficient-energy limits, feeding, metabolism and learning.
- Sole score actually absorbed nutrient J; strict elitism, stable parent on
  ties. Validity gates identical #87 (including conservative100px boundary
  zone, no guards, anchor<.5px, limit excess<.05rad, constraint gain<1e-12J,
  post-constraint/contact omega<=20.001, chemical<1e-5J, billing<1e-9J).
  No proxy score, neutral drift, gate weakening or organism/physics tuning.
- All225 proposals/run execute even if founder invalid or all intake zero.
  Invalid parent is only a mutation source until a valid specimen exists;
  no invalid winner; explicit no-champion slots if necessary.
- Preserve every proposal mutation/hash/intake/contact/motion/work/mode/guard
  receipt, full generation-selected genotypes, all five finals/failure slots.
  Add read-only substep mode transition receipts (DIRECT<->OSC and both OFF
  regions) and correlate with intake, without claiming causality.
- Three MATCHING held-outs/run: #87 seed811/977/2301, headings-.7/2.3/pi/2,
  same12s/recipe; initial and final/fallback each,30 rows, never training.
  Final champion saved/reset replay checks separate. Do NOT rerun legacy:
  compare ONLY preserved #87 legacy founder4800/final16704J/generation curve/
  held-outs, label its one-run limitation.
- Append-only uniquely named raw generation archives, fsync/readback/hash
  manifest, complete log; all #85/#86/#87 evidence protected byte-for-byte.
  Report all five distributions (not best specimen only), per-generation
  intake curves, meaningful mode use, accepted mutations, feeding, learning,
  work, stability, wall cost and held-out regressions/invalid rows.
- Focused boundary/hysteresis/any-mode one-update/applied torque tests,
  strict new save contract/continuation, old hybrid snapshot compatibility,
  built authoritative Worker/host/audit/quiet/fork and exact replay audit.

Stop after fixed experiment, checks, report and active-issue/#57 checkpoint.
No automatic extra search, merge, deployment, physics/strength/starter/baseline,
#78, solver, Wiki or VIDA3D work.
