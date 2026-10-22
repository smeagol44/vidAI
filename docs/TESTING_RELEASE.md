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
