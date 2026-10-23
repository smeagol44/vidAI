## Purpose
Authoritative *issue-backed* development and handoff index for **VIDA 2D only**, repository `smeagol44/vidAI`. GitHub Projects board: [VIDA 2D — Development](https://github.com/users/smeagol44/projects/1/views/1) (Project #1, URL supplied by owner). This board is the intended visual status dashboard for these repository issues and linked PRs; the Wiki remains the authoritative reference for *implemented* functionality.

## Verified starting state
- Production: [VIDA 2D](https://smeagol44.github.io/vidAI/) — `main`, `v0.37.0`.
- Experimental: [VIDA 2D Testing](https://smeagol44.github.io/vidAI/testing/) — `testing`, initially `T1.1` from main v0.37.0. Testing has separate provenance and never merges wholesale into main.
- Last environment PRs: [#54](https://github.com/smeagol44/vidAI/pull/54), [#55](https://github.com/smeagol44/vidAI/pull/55), [#56](https://github.com/smeagol44/vidAI/pull/56).
- **Owner decision:** retain `passive-work-v3`. Fluid/benchmark stack #79/#81/#82/#83 is closed unmerged; #61/#80 assessments complete. Controller #59/#72 remains independent/open; #84 preserves a future angular-stop correction candidate. Rejected candidate [PR #52](https://github.com/smeagol44/vidAI/pull/52) must not be treated as a shipped implementation.

## Management rules
1. One issue per bounded outcome. Link its work branch and PR before development; link tests, measured trade-offs, and deployment before closure.
2. Explicitly distinguish: **decided**, **needs decision**, **experimental**, **shipped**, **rejected**. Do not turn discussion into approval. **Workflow stage is separate from design decision state:** an issue becomes In progress as soon as substantive discussion, research or experimentation begins, not only when coding starts.
3. Prefer demonstrable physics, energy conservation, mutable hereditary traits, and emergent locomotion. Keep historical saves and Worker authority. Never edit `vidAI3D`.
4. Promote vetted changes via clean PRs based on main, not a wholesale `testing` merge. Disclose material swimming/ecology changes before production promotion.
5. Track blockers using direct issue references. Use checkboxes for independently verifiable subtasks; do **not** claim progress percentages without a defined denominator.
6. Keep the GitHub Wiki current-feature-only. This index and issue discussions hold *planning* and experiment decisions.

## Handoff (copy in a new chat)
"Continue VIDA 2D from [the GitHub Project](https://github.com/users/smeagol44/projects/1/views/1), [this issue](https://github.com/smeagol44/vidAI/issues/57), and its linked child issues. Read `AGENTS.md`, `docs/FEATURE_ROADMAP.md`, current GitHub Wiki and the latest production/testing branches. Identify the next unblocked issue, its decision state, work branch/PR, measured validation and rollout status; implement one bounded next step without modifying VIDA 3D."

## Tracked issues and decision state

| Track | Issue | State at setup | Prerequisites |
| --- | --- | --- | --- |
| Project board configuration and issue import | #68 | **Configured and verified** — roadmap imported, four views saved, intake/closure/reopening exercised via #71 | Projects UI for intermediate custom-field changes |
| Dual production/testing lanes | #58 | **Done**, PRs #54–#56 | None |
| Signed brain torque | #59 | **In progress** (four-controller Worker/discovery/ecology comparison; regression evidence, decisions open) | Testing lane #58 |
| Anatomical muscle strength + cost | #60 | **Needs decision** | #59, #61 |
| Physical units and coherent drag | #61 | **Done — assessment completed; retain v3, v4 not adopted** | Evidence preserved; future stop correction #84 |
| Brain-free matched swimmer comparison | #80 | **Done — all three bodies/report; stack closed unmerged** | Retain v3 |
| Unilateral angular-stop correction | #84 | **Backlog — future candidate only** | Separate authorization/version/save contract |
| Moving fluid, wake, drafting | #62 | **Backlog / research** | #59, #61, #67 |
| Motor exploration + evolution | #63 | **In progress — completed #85/#86 studies, review pending** | #59, #60, #61 |
| Nutrient-intake artificial selection | #87 | **In progress — completed bounded experiment, owner review pending (#88)** | #86/v3 |
| 8–10 new mutable starters | #64 | **Backlog** | #63 |
| Eye/sensory review | #65 | **Deferred; user report pending** | None |
| Full ecology loop | #66 | **Backlog** | #63, #64 |
| Worker/performance under new fluids | #67 | **Backlog** | Fluid candidate #62 |

### GitHub Projects board
[VIDA 2D — Development · Current Work](https://github.com/users/smeagol44/projects/1/views/1) (personal Project #1).

**Verified configuration**
- Default repository and intake source: only `smeagol44/vidAI`; automatic intake filter `is:issue,pr`.
- Imported all roadmap issues #57–#68 and environment PRs #54/#55/#56. Classified imported items by Track.
- Current Work: Board, grouped by Status, open items; seven visible columns Backlog, Needs decision, Ready, In progress, In review, Testing, Done.
- Roadmap: all items, table grouped by Track, with Priority, Track, Environment and Target cycle columns.
- Physics Refactor: table filtered to Physics, Fluids and Brain/behavior; currently #59–#63.
- Completed: closed issues and closed/merged PRs. Done remains available; no auto-archive was enabled.
- Fields: Priority (P0/P1/P2), Track (Physics, Brain/behavior, Fluids, Starters, Ecology, Senses, Performance, Infrastructure), Environment (Both/Main/Testing), Target cycle (plain text).
- New open items start in Backlog. Closed issues and merged PRs go to Done; reopened items return to Backlog.
- #71 was created after enabling intake, observed automatically in the Project, closed and observed as Done, reopened and observed in Backlog, then closed again. Imported merged PRs and #58 also show Done. The merged-PR workflow was inspected, without creating a dummy PR solely for a live merge test.

**Maintenance and handoff**
1. Read this index, the Project, the active source issue and `AGENTS.md` at the start of a development session.
2. Create/update repository issues and PRs normally. GitHub's Project workflows handle intake and completion; do not manually duplicate those items.
3. Set Status using the verified owner-only comment bridge below and verify its Actions field readback. Use Projects UI/scoped integration for custom fields; source-issue edits do not derive Track/Priority/Environment/Target cycle.
4. For blocked work retain its current stage and cite its blocking issues. **#59 is In progress** due to active discussion and draft PR #72, despite unfinished decisions; #60 remains Needs decision; #61/#80 are completed assessments: v3 retained, fluid stack closed unmerged; #84 remains separate. #87/#88 completed the bounded offline study and await owner review. No experimental refactor is approved for production.
5. Keep branches, PRs, validation and verified deployment links on source issues. Use the Wiki only for implemented functionality.
6. Two unused Status options (`P0`, `P2`) inherited from the initial setup are excluded from Current Work. They have no assigned items; actual priorities belong to the separate Priority field. Their optional permanent deletion was not performed.

The Project README also contains these maintenance rules. Setup evidence is in #68 and #71.


### Workflow semantics — accepted 2026-10-22
- **Backlog:** Not selected for active attention.
- **Needs decision:** A consequential question awaits a decision but is **not under active discussion**. The issue's decision flag remains separate from its Project workflow stage.
- **Ready:** Decision/scope sufficiently clear and queued to start. **This is not a completed-work status.**
- **In progress:** Move here at the **start of substantive discussion, analysis, planning, experiment design, implementation, or debugging**, not when the first line of code is written. An issue can simultaneously be In progress and have open design decisions, explicitly documented in its body.
- **In review:** Bounded PR/outcome is complete enough for evaluation/review; not necessarily merged.
- **Testing:** Integration/validation in the appropriate lane is underway.
- **Done:** A bounded task is verified and actually finished (normally merged or closed with evidence). A passing component test is not grounds to mark an unfinished larger PR Done.
- Project statuses are **not inferred by GitHub's existing automation from discussion**. When a task becomes active, use the verified owner-only `/vida status in-progress` issue/PR comment bridge (or Projects UI), then check the GitHub Actions status confirmation. Issue text alone does not move cards.
- **Synchronization verified (2026-10-22):** Existing #59 and draft PR #72 Project cards were each changed to **In progress**, confirmed through authoritative Projects GraphQL field-value readback in Actions ([#59](https://github.com/smeagol44/vidAI/actions/runs/39769255812), [#72](https://github.com/smeagol44/vidAI/actions/runs/39769309628)). Their remaining work is not Done; #74 alone records the completed isolated test milestone. Ready is queued; Done is verified completed.


### Project Status automation bridge (operational; verified 2026-10-22)
- [Issue #75](https://github.com/smeagol44/vidAI/issues/75) and [PR #76](https://github.com/smeagol44/vidAI/pull/76) introduce owner-authored issue/PR comment commands such as `/vida status in-progress` to change the **actual** GitHub Projects v2 Status field through a GitHub Action. This bridge preserves current intake/completion automation and avoids permanent status labels.
- **Operational:** owner installed the private `VIDA_PROJECT_TOKEN` Actions secret (classic PAT, `project` scope); workflow and both field updates passed. Instructions: `docs/PROJECT_STATUS_AUTOMATION.md`. Never paste tokens in chat.
- **Verified:** #59 and draft #72 both show `In progress` in the GitHub GraphQL write response/readback, with no duplicate items. Direct manual board UI inspection was unavailable in this chat; the native field update was authoritatively confirmed. Future chats should post exact owner-authored comment commands and verify Actions before reporting success.

### Latest checkpoint — nutrient-intake selection COMPLETE (#87 / draft #88)

**Stop for owner review.** Sole score was actually absorbed nutrient joules, never displacement. In one fresh paired run, legacy six-output intake **4800→16704J (+248%)**, neural Mode+Command hybrid **0→0J**, retaining its founder under strict zero ties. One starting brain per architecture does **not** establish general superiority.

**Branch/base/head/PR:** `experiment/nutrient-intake-87` → `experiment/neural-modes-food-63` (#86), base **211025a3f9d5144b3fafa8679ee882c426cee64a**, head **b64481eb02a4c253637cae3d91375a5051405fd1**, draft [#88](https://github.com/smeagol44/vidAI/pull/88), unmerged/undeployed. Protocol registered before coding at4919742bd0425519089b926f9c4b048e2ecaedc9. #86/#85/#72 unchanged independently. Local/remote trees identical, no unpushed work.

**Method:** EACH architecture15 generations×15 offspring×12s =225; **450 offspring +2 founders +12 held-outs =464 rows**. Entire fresh IH/HH/HO/biases, paired seed17 and recurrent trunk; counts2172 legacy/1972 neural hybrid. Eight ordinary scalar neural events/proposal, Gaussian sigma.15, same seeds but different output/parameter semantics. Original legacy six-output servo, not oscillator-only; hybrid two independent Mode/shared Command outputs/joint, exact #72 .06 hysteresis, no genetic selector/extra legacy head.8 proposals mutate Mode and Command together. No somatic inheritance, no score tie-break or neutral drift.

**Habitat/biology:** unchanged Darter/v3/capacity/eyes/mouth/normal learning/energy. Full world reset per trial:1000×800px, root500,400 heading.37, seed73, gravity0,viscosity.18;240 ordinary3000J nutrients using existing65%/35% abiotic bloom/uniform recipe,12 sites,96px halfspread; no respawn or food relocation. Normal finite10000J founder stock, no top-ups. Ephemeral bounded offline nonlethal request suppresses only final starvation/senescence marking AFTER ordinary spending/feeding; no reserve/age/force/PRNG edits and no save fields. Zero-energy verification stays0 with zero work and normal limiting; protection-off ticks restore normal death. No training candidate actually depleted or invoked protection. Normal reproduction intact (maturity18s >12s).

**Results/limitations:** legacy201/225 valid,224 fed/200 valid fed; five beneficial mutations retained. Hybrid120/225 valid,zero feeding; all1,296,000 training joint-substep samples DIRECT, no OFF/OSC discovery. Hybrid mostly transient/stop pressing. Legacy invalid24:23 conservative boundary-zone exclusions,1 guard; hybrid invalid105:joint-limit violations,including1 guard. Never selected invalid trajectories. Legacy final279.22px vs95.48 founder (diagnostic only); hybrid5.52px unchanged. Legacy actual intake ticks100→348, first297→130; normal learned motor/sensory L1.077885/.130214. Learning changes synapses but its functional benefit/direct food seeking is not isolated. Hybrid training sees food but has no contact/learning. #78 unchanged.

**Held-outs:** seed811/977/2301, headings−.7/2.3/pi/2, same12s/recipe. Legacy15168→22320,14208→14064,10224→12288J; all valid,2 improvements/1 slight regression. Hybrid4800/0/3984J, identical initial/final; feeding rows INVALID (guards/limits), only valid row0J. No withheld result influenced selection. Zero intake alone is not proof of failed seeking; these twelve seconds permit actual feeding for some, not every policy.

**Energy/performance:** final legacy/hybrid motor chemical15.43081/9.88673J; own chemical expenditure325.23967/319.59273J. Positive/braking work,4× prepayment and correct reserve limiting retained. Chemical error≤6.985e−10J; food/work partition≤6.731e−10J including discarded remnants. No artificial spendable energy. Instrumented12s Worker median112.26/109.60ms includes reset/IPC/vision/traces/export, not gameplay FPS or a controlled speed ranking. Existing guard/constraint limitations remain open; no solver study.

**Durable evidence:** [report](https://github.com/smeagol44/vidAI/blob/b64481eb02a4c253637cae3d91375a5051405fd1/docs/experiments/nutrient-intake-v1.md), [manifest/35 immutable gzip archives](https://github.com/smeagol44/vidAI/blob/b64481eb02a4c253637cae3d91375a5051405fd1/docs/experiments/nutrient-intake-v1.json), [summary](https://github.com/smeagol44/vidAI/blob/b64481eb02a4c253637cae3d91375a5051405fd1/docs/experiments/nutrient-intake-v1-summary.json). All450 mutations/genotypes/elitism decisions reconstruct exactly; full selected genomes, candidate COM/joint trajectories/contact/learning/work receipts, founders and both champions preserved. Append-only paths+fsync+readback, all30 summaries in runner log; no lost receipts or training repeats. Both final specimens replay exact metrics/serialized trajectories/full snapshots/PRNG, plus split360+360 reset forks. Initial verification failed only on undefined legacy mode versus JSON omission; serialization-normalized comparison fixed, no numerical mismatch/search rerun. All protected #72/#85/#86 evidence hashes unchanged; representative old snapshots exact.

**Checks:** local319/319 fast +1 metadata/typecheck/build; production/gated/retained/#85/#86/#87 actual-Worker sets;450-genotype audit and both final replay/forks passed. Physical feeding144J absorbed in3 ticks for both; residual-depletion test separates48J intake/12J assimilation/.5J discarded remainder. Remote final-head [CI39994646606](https://github.com/smeagol44/vidAI/actions/runs/39994646606) **succeeded**:319fast+metadata/build, all SIX actual-Worker sets,450-genotype audit, both final replays and reset forks. [Automatic browser39994646569](https://github.com/smeagol44/vidAI/actions/runs/39994646569) **succeeded**, with11/11 Chromium and11/11 Firefox (job120554893403 logs). Standing catalogue39994646583 succeeded (baseline reproduction, not new study evidence). Throughput39994646574 skipped; no manual browser campaign. Publication/Pages assembly/deploy jobs all **skipped**, verified job results.

**Status/environments:** #87/#88 actual Project Status **In progress** verified by runs39993005715/39993007686, job readbacks120549266921/120549274338. Main **194d70d1de2c4a31825e5f57d1d890a698fe4a5d**, productionv0.37.0/v3; testing **d7a68144b02225db37bb6a9583b057458ff47d52**,T1.1, unchanged. Both deployed URLs HTTP200; asset readbacks remain root index-6HCxDzEn.js/testing index-C91pGQj0.js. No merge/release/deployment/physics/starter/baseline/Wiki/3D changes.

**Precise next action:** review #88's one-run intake gain, held-out regression and hybrid zero-score plateau/constraint fragility. Do not promote any architecture or automatically run more. If owner wants additional evidence, preregister an independent paired starting-seed replication with equal budgets; no score substitution, coefficient/gain/food tuning or unrelated feature.

### Preserved prior checkpoints and owner decisions

[Exact pre-#87 #57 body](https://github.com/smeagol44/vidAI/blob/b64481eb02a4c253637cae3d91375a5051405fd1/docs/handoffs/issue-57-before-nutrient-intake.md) preserves the entire #86/#85/#72 findings, heads, CI/integrity notes, fluid closeout and older handoffs. Do not repeat completed experiments. #86 corrected neural-mode/food study5184 offspring remains at211025a3, #85 genetic-selector study at e09bf46, #72 retained-head/gated work at2ac6477, all independent drafts/unmerged. Do not relabel #85's genetic selector as a neural hybrid.

**V3 remains the accepted foundation.** #61/#80 complete, #79/#81/#82/#83 closed unmerged with evidence/branches retained. No reopening fluids, solver investigation, coefficient tuning or promotion. #84 is a separately deferred joint-stop defect candidate, not an implemented correction. #60 anatomical capacity/cost decisions remain separate.

**#78 remains separate/upcoming and unchanged:** inherited subjective reinforcement can assign positive,negative or zero teaching value to physically sensed contextual combinations (including stillness plus actual injury). Immediate within-life learning and intergenerational selection are distinct. No future-food prediction requirement and no substitute universal food-positive/injury-negative reward rule. No implementation authorized by #87.


