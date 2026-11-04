# VIDA 2D — testing-only release identity

**Only the `testing` branch owns this file and `testing-baseline.json`.**
Neither belongs on production `main`, including during feature promotion.

- Production: `https://smeagol44.github.io/vidAI/`, semantic version from `main`.
- Testing: `https://smeagol44.github.io/vidAI/testing/`, banner and document title identify the environment.
- Release: `main v<mainVersion> @ <mainCommit-short> · cycle <cycle> · iteration <n>`,
  abbreviated `T<cycle>.<n>`. The baseline SHA/version are pinned when testing
  is deliberately started from `main`; they do NOT change when `main` advances.
  The iteration is the number of testing commits since the pinned baseline,
  starting at **1** with this overlay. Rebuilding the same commit does not
  invent a new version. Both branches are rebuilt from their own latest HEAD
  on any deployment run, but production always comes from `main`.
- To begin a fresh cycle after promoting selected features: first preserve
  experimental work and cherry-pick only production-ready feature commits onto
  a clean branch based on `main`. Merge those reviewed PRs normally. Then
  intentionally reset/recreate `testing` from the new `main` using a guarded
  branch update, restore the testing-only overlay, update the pinned SHA/version,
  increment `cycle`, and commit. The first new overlay commit is iteration 1.
  This is an **explicit destructive reset** for testing history, not something
  triggered by every ordinary main update. Never reset without preserving work.
- A whole-branch merge of `testing` into `main` is forbidden; main CI checks
  for the testing-only manifest/banner and the PR source branch, and production
  assembly checks the real main checkout again. Never change `BUILD_VERSION`
  in `persistence.ts` to represent a testing release; save compatibility and
  simulation versioning stay independent.

Run `npm run test:testing-release` on testing to verify the pinned ancestry,
release identity and iteration counting.

## RGB-only vision deployment — issue139 (2026-11-04)

Owner requested deployment of reviewed PR140 to testing only. Source candidate
`23736d50f70b6768cf7624fb1acfa5dd7932def7` includes current production0.40.0 plus
the proposed0.41.0 RGB-only correction. The deployment retains the original
T1 baseline manifest and commit history; iteration advances according to the
existing commit-count rule, including integrated production ancestry. It does
not start a new cycle or count independent experiment runs.

New catalogue starters and manual archetypes use RGB-only brain v8. Existing
saved worlds/eggs/ancestry/Bank entries retain v7 until explicit upgrade. World
and Bank upgrades are separate. The inspection label and schema20 identify the
new format. PR140 remains a clean unmerged production candidate; production
continues from main0.40.0. No historical experiment is rerun by this deployment.
