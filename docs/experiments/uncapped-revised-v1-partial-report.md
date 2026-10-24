# Revised #90 hybrid uncapped repeat — INTERRUPTED (#96 / draft #97)

**Not complete. Do not treat these as15-generation/final or held-out results.**
The execution environment became unavailable during generation13. The original
process is gone. No replacement training evaluation was started after detection.

Scientific base531e2d0b5fef6d6ce15fa6a83905b8c99f7606ee;protocol
4d81373e5bc4877aa26ef23da0adb8b322c875f9;frozen implementation
6276c79d6c2b517bcb4f3abf7597f9a0516766e5. Draft97 targets original #90.
Only neural-motor-v2,original four bands-.9/0/+.9,.06 hysteresis/latch,
original5seeds/body/brain/mutations/habitat/learning. Explicit saved uncapped
mode/schema96 bypasses only the two velocity clamps. Strict actual-founder
incumbent and absorbed-J-only elitism;all former physical screens diagnostic-only.

## Verified checkpoint

All five seeds have complete generation summaries0–12:900 offspring metadata,
5 founders,60 elite decisions. All900 recorded genotypes/mutations and60 choices
reconstruct exactly.873 raw offspring packets survive:863 from completed
generations and10 from incomplete seed1901 generation13.37 completed proposals
retain scores/mutations/genotype/final-state hashes but lack their full raw
packets. Generation13/o4 is also missing even though later records exist;its
score is unknown. The in-flight endpoint after recorded generation13/o10 is
unknown. Consequently exact-once completion cannot safely be claimed.
No held-outs,final champion replay/forks or full-budget audit were completed.

|Brain seed|Uncapped founder J|Selected at generation12 J|Selected specimen|Historical capped15-generation result|
| --- | ---: | ---: | --- | ---: |
|17|4032|12624|g4/o10|No valid champion|
|71|0|8496|g10/o12|0|
|1901|5472|7200|g1/o13|0|
|4099|240|336|g5/o11|432|
|8191|2160|8064|g11/o6|1152|

The historical column has a longer completed budget and different physics AND
selection policy. It is not a one-variable causal comparison. Historical null
means no valid champion;its founder/invalid feeding receipts are retained.
[Partial scores CSV](uncapped-revised-v1-partial-scores.csv) includes only actual
completed generations. [Joined comparison CSV](uncapped-revised-v1-partial-comparison.csv)
includes all0–15 rows with missing new generations blank and explicit completeness
flags. [Historical CSV](uncapped-revised-v1-historical-capped-scores.csv) retains
old missing-valid results as blank,not0.

The changed selection is demonstrated:seed1901 g1/o13 is the EXACT historical
rejected feeder(5520J capped) and becomes a7200J uncapped parent;seed8191 g1/o8
was a240J rejected feeder and becomes a5136J parent. Seed17 g1/o2 was an old
rejected NON-feeder0J and becomes7968J uncapped;do not relabel it as an old
feeding organism. Later selected descendants have their own recorded diagnostic
flags and must not be falsely identified with old same-index genotypes.

## Integrity and recovery evidence

The local file mirror is inconsistent:37 completed raw packets are missing,
mostly final members of append-only journals,although their later generation
summaries survived. Per-proposal fsync and close/readback succeeded in the original
process before those summaries were emitted;they did not ensure complete
recovery after the environment interruption. Every surviving byte is preserved.
The exact cause of the mirror loss is not established. No captured nonfinite
physics failure explains it,and old cap/joint/boundary flags never filtered a
candidate. Do not invent missing scores or quietly re-evaluate them.

An additional upload-verification bug accepted22 bad GitHub transport copies
while command output was unavailable:20 corrupt binary journals and2 empty
summaries. They are EXCLUDED,not scientific receipts. The previous immutable
commit9ccd70fb298b58dd512c38bfa566754f2bc6b410 retains all variants. The transfer
bridge now requires command success,exact encoded lengths and expected Git blob
SHA. [Excluded-transfer index](uncapped-revised-v1-excluded-transfers.json).
Those copies did not recover any missing raw receipt. Prior #90/#95 data and
production/testing branches were untouched.

The complete surviving archive set is durably preserved in six immutable ZIP
bundles with SHA256 and exact file inventories:
[recovery bundle index](uncapped-revised-v1-recovery-bundles.json).
Those bundles are authoritative for surviving raw files;the GitHub branch also
contains original-uploaded subsets,completed-generation summaries and source.
Extract the six bundles into one checkout before running the read-only partial
census `node --import tsx scripts/inspect-uncapped-revised-partial.mjs`.
[Partial manifest](uncapped-revised-v1-partial-manifest.json) enumerates every
raw hash,missing record,completed choice and partial generation13 observation.
No primary bytes were overwritten to hide a gap. No further simulation/search,
legacy/other-controller study,browser campaign,merge,deploy,Wiki or3D change.

Before interruption331fast+1metadata/build/typecheck and focused authoritative
v2 Worker checks passed:actual uncapped speeds>1270px/s/>58rad/s with zero clamp
loss,host/quiet/reset equivalence,four-band OFF persistence,independent physical
OSC/DIRECT torque,real144J food+learning,and lossless float64 receipt packing.
Standing search/browser jobs are excluded for this branch per owner scope.
The partial census's first in-memory version exceeded heap while retaining all
raw packets;it was corrected to retain hashes/metadata and then passed without
executing physics. This was post-run inspection,not a physics failure.

## Blocker and exact next action

**STOP pending owner decision.** To finish,an explicit recovery exception is
needed for deterministic replay of lost/uncertain trial receipts,then only the
remaining original budget and30 original held-outs.37 missing completed packets
have original final-state hashes/metrics for exact verification;generation13/o4
has no surviving measured score,and later in-flight completion is unknown.
Preserve the interrupted dataset and label any replacement measurements openly.
Do not restart the1125-offspring experiment or silently call recovered receipts
original. Current generation12 scores are checkpoints,not final champions.

Main v0.37.0/testing T1.1 remain unchanged. Exact final branch/checkpoint/CI and
administrative status are recorded in #96 and #57.
