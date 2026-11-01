# Browser CI validation

Tracking: issue #123; integrated through #131 and #132. The workflow preserves
every accumulated canonical Worker/Chromium/Firefox case and its assertions.
It runs the production Worker independently and uses four browser groups on
separate GitHub-hosted runners: toolbar geometry, side-window/tube controls,
Chromium regressions, and Firefox regressions including tube scenarios. Tube controls and
the observer mask are therefore exercised in both engines. Each runner keeps one Playwright worker to
avoid software-rendering contention. `fail-fast: false` retains all results.

The required `browser-smoke` name remains an aggregate. It succeeds only when
the Worker and every browser shard succeed. No skipped/failed dependency can
make the aggregate green. Permissions, dependency installation, branch
protection, Pages publication and scientific baselines are unchanged.

Run fast tests and build while developing. Use focused browser checks for UI
changes and the actual built Worker for kernel/command/persistence changes.
Before merge, review all required checks on the exact candidate. A YAML edit
alone is not evidence of a speed improvement. Separate runners reduce serial
waiting but can increase total runner-minutes; do not claim better game FPS.
Do not repeat full campaigns after prose-only edits unless required checks or
new concerns call for them. Never shorten assertions or refresh baselines to
hide failures. Use recorded run links rather than repeatedly polling slow jobs.

The final v0.39.0 integration passed all 76 browser cases (16 toolbar, five
side-window, 25 Chromium and 30 Firefox), the actual Worker gate and the required
aggregate in run 41287349596. Fast/build and standing locomotion checks also
passed. Exact candidate, merge and publication receipts are maintained in #57.
Production main and independent testing remain separate checkouts; parallel CI
does not authorize promoting testing features or resetting its baseline.
