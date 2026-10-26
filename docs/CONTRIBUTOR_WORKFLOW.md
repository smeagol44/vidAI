# VIDA 2D — Contributor Project Instructions

Develop VIDA 2D through fork https://github.com/hernansgarro/vidAI and upstream PRs.

Upstream: https://github.com/smeagol44/vidAI
Roadmap/handoffs: https://github.com/smeagol44/vidAI/issues/57
Shared board: https://github.com/users/smeagol44/projects/1/views/1
Wiki: https://github.com/smeagol44/vidAI/wiki
Production: https://smeagol44.github.io/vidAI/
Testing: https://smeagol44.github.io/vidAI/testing/

## Authority and startup

- Upstream is canonical; the fork is a contribution workspace. Verify fork URL/account and remotes before writes. Normally origin is the fork; upstream is smeagol44/vidAI. Never invent identities.
- At startup/resumption, read upstream AGENTS.md, #57's latest checkpoint, active issue/PR/discussion, docs/FEATURE_ROADMAP.md, docs/PROJECT_STATUS.md and relevant Wiki pages. Read applicable base/branch rules; verify relevant heads/publication.
- Code/tests establish implementation; issues/PRs hold decisions; the board tracks work; the Wiki describes features. Prefer current evidence and owner decisions. Surface conflicts.
- Contributor requests authorize scoped fork work/proposals, not upstream merges/deployments or reversed owner decisions. Ask about consequential unresolved design choices; handle routine choices autonomously. Respect task stop gates; continue the recorded next action.
- Do not modify smeagol44/vidAI3D.

## Simulation principles

- Live evolution uses inherited genetics, mutation, physical environments, survival and asexual reproduction through funded eggs. No live fitness scores. Offline selection requires a scoped protocol.
- Movement emerges from articulated bodies, hinges, forces and water resistance. No artificial propulsion, teleportation or scripted locomotion. Mutable starter bodies/brains/motor priors are allowed; preserve independent joints and non-rhythmic potential.
- Preserve energy conservation, physical feeding, ecological interactions, historical saves and deterministic continuation where supported. Never silently reinterpret genes, neural outputs, schemas or physics.
- Separate inherited genetics from lifetime learning. Reinforcement comes from actual feeding, injury or physically sensed experience; no hidden targets, calorie subsidies or guaranteed survival.
- Preserve authoritative Worker state, recurrent brains, lifetime learning, fixed ticks and render/simulation separation. Off-camera simulation continues. Exact snapshots, exports and mutations come from authoritative state.
- Respect current starter/body/brain/diet freezes and accepted physics unless upstream task authorization permits changes. Experiments never become production defaults implicitly.
- Fix causes without hiding failures through tuning, changed baselines or removed safeguards. Papers inform investigation; they do not establish VIDA's coefficients.

## Shared issues and coordination

- Use upstream issues/PRs. Search before creating one issue per bounded outcome. Do not mirror the backlog, duplicate cards or create a competing fork board. Fork issues/Wiki are not authoritative.
- Coordinate scope/ownership in the upstream issue. Record decisions, acceptance criteria, environment, base/head, fork branch, PR, blockers and evidence. Link work from #57; comment if its body cannot be edited.
- Record task/branch/base before implementation; link a draft cross-fork PR once a nonempty diff permits. Register experimental protocols/budgets/frozen controls before execution. Preserve evidence/uncertainty; no unauthorized lost-trial reruns.
- Preserve others' records/#57 checkpoints. Edit authorized sections only; otherwise add a dated handoff comment for owner integration.

## Branches and pull requests

- Fetch upstream first. Production work starts on bounded topic branches from current upstream/main. Use testing/stacked experimental bases only when explicitly recorded for the task.
- Push to the fork's topic branch. Open the PR in smeagol44/vidAI with the intended upstream base and head CONTRIBUTOR:topic-branch. Verify repositories, SHAs and diff. A fork-internal PR is not an upstream submission.
- Keep fork/main for synchronization; use topic branches for work. Fetch upstream updates as needed. Preserve shared commits; no destructive resets/force-pushes of shared branches without authorization.
- Main owns production; testing owns experiments. Main may merge into testing with its overlay preserved. Never merge testing wholesale into main, even indirectly. Promote selected approved changes/dependencies through a clean main-based PR.
- Keep testing-baseline.json, testing labels and cycle metadata out of main PRs. Ordinary sync does not reset pinned baseline/cycle. Deliberate rebaselining requires coordination and preserved experiments.
- PRs explain problem, resulting behavior, issue, target/base, validation, measured effects and limitations. Distinguish proposed/experimental/rejected/shipped. Use closing keywords only for appropriate upstream completion.
- Stop at a reviewable PR. Upstream merge/auto-merge/release/deployment/promotion remain with the owner/authorized maintainer. Fork merges grant no upstream release authority.

## Verification and documentation

- Run npm run test:fast and npm run build; use npm ci for installation. Include npm run test:worker for simulation/Worker changes and focused automated browser smoke for relevant UI integration.
- Keep release gates/target checks. Avoid repeated full suites, long searches/manual browser campaigns without a concrete concern or explicit request. Docs-only work needs no simulation tests.
- Compare established baselines for physics/feeding/brain/energy changes. Disclose material positive/negative movement/ecology/performance effects before promotion. Equations/ledger/CI alone cannot approve release. Never refresh baselines or retune organisms to mask regressions.
- Fork PR CI may await maintainer approval or lack upstream secrets. Report blocked/skipped checks accurately; do not bypass workflow protections or claim they passed.
- Edit docs/wiki/ in the scoped PR; preserve diagrams, Home and Sidebar. Describe implemented behavior, distinguishing testing-only features. Keep plans/history/experimental reports in issues/PRs and status records.
- The published Wiki is separate. Upstream main's publish-wiki workflow publishes docs/wiki/ after acceptance. Do not publish fork experiments upstream or claim actual publication without verification.
- Preserve dual Pages: independent main/testing builds, one complete site, publication through main/github-pages. Fork previews are not upstream releases. No incidental hosting/secrets/automation/release-identity changes.

## Project fields and handoffs

- Keep statuses: Backlog, Needs decision, Ready, In progress, In review, Testing, Done. Discussion/investigation is In progress; Done requires verified completion. Blocked work retains its stage and cites the blocker.
- Preserve Priority, Track, Environment (Both/Main/Testing), Target cycle and four views. Existing intake covers upstream issues/PRs only. Verify changes; avoid duplicates.
- Project/repo permissions are separate. Update actual fields only with suitable access/tools; otherwise record pending sync. Issue prose sets no fields. Use /vida status after upstream main authorizes your actual comment account; verify Actions/readback.
- On handoff/migration, stop safely, commit/push fork work, update upstream issue/PR and authorized #57 checkpoint/comment. Record objective, decisions, fork/base/head SHA, PR, main/testing state, checks/results, publication/Wiki, blockers, unpushed work and exact next action.
- Return a summary and continuation prompt linking #57, issue/PR and fork branch. Preserve work beyond chat/temporary files; identify access limitations.
- Be concise and rigorous. State what changed, why, validation, remaining work and review/deployment state. Never invent success or progress percentages.
