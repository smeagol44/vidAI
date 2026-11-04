# Completed fork-main contribution inventory — 2026-11-03

## Verified starting state

- Canonical upstream main: `041362eefa64971d9038f4ad7ec4fd59a747d3ec`.
- Contributor fork main: `772130b64fa665417a791471b75f01622b9cff86`.
- Merge-base: the exact canonical main above; no newer upstream commits need synchronization.
- Fork testing: `4bda30a269bd8650b6e12a99b99e4af5ef673d42`; not an input to this submission.
- Existing upstream PR [#134](https://github.com/smeagol44/vidAI/pull/134) is open, with no submitted reviews at inspection. Its clean head is `fe80e65e8afc1583c14f52a40eea46315eb88cbc`, two commits directly above canonical main.
- Account verified as `hernansgarro`. Hernan explicitly authorizes the consolidated submission, but no upstream merge, auto-merge, deployment or Wiki publication.

Upstream already integrated forward mouths (#127/source #108), egg reserve display
(#128/source #117), feeding/predation halos (#129/source #115), starting scenarios
(#130/source #120), x0/MAX and throughput (#131/source #113), local tubes and
parallel browser gates (#132/source #124), and current documentation (#133).
Their behavior is retained; old submission branches are not resubmitted wholesale.

## Inventory and disposition

| Change group | Decision | Reason and dependencies |
| --- | --- | --- |
| Nutrient lifecycle #125 | Include existing #134 implementation and original v1/v2 evidence | Completed fork PRs #47/#48, integration #51. New decay-v2: 1 J/s, radius floor 6, bounded remaining-energy mineralization at 60 s; schema19, saved v1/schema18 and omitted cycles retain their semantics. |
| Automatic selection/tracking #126 | Include existing #134 implementation | UI-only metadata; independent preferences, Default on/on and Harsh/Pipe off/off. Stale Worker spawn replies cannot select a replaced world. |
| Pipe World #135 | Include | Completed fork PR #53 / merge e9662a6. Independent4600x2100 preset depends on the reviewed nutrient cycle and preferences. No initial calls, openings or tubes. |
| Caustics visibility #137 | Include | Completed fork PR #68 / merge 3e7319e. Observer-only checkbox, Default on and Harsh/Pipe off, historical metadata fallback on. No state, PRNG, optical or Worker change. |
| Browser infrastructure #136 | Include selected workflow changes | Pinned Playwright 1.58.2 container; retain every Worker/browser shard and mandatory aggregate. Lockfile and release identity unchanged. |
| Renderer/toolbar integration corrections | Include approved fork-main behavior | Egg reserve sector in annotation pass, energy halos before entities, one-decimal actual-speed display with two-decimal title. No simulation arithmetic changes. |
| Test compatibility | Include selected causal fixtures and checks | Forward reach, actual legacy mouth migration, current schema rejection, funded toolbar fixture, authoritative import acknowledgement, controlled glow phase amplitudes, Pipe/caustics coverage. Preserve state/energy/path/width and pause guarantees. |
| Implementation reference docs/wiki | Include selected and reconciled text | Maintain canonical navigation/diagrams, document candidate formats and scenarios, label pending acceptance. Preserve original experiment reports without rewriting data. |
| Contributor workspace and personal priority/design records | Exclude | Fork-only ideas, planning, remote-aquarium/scent proposals, audit priorities and handoffs are not completed production features. Do not export the personal backlog. |
| Stage3 research branches and Stage4 proposals | Exclude | Draft/unmerged and research-only; no permanent cache, cadence change, redraw policy or remote tube implementation is authorized here. |
| Fork Pages workflow/action upgrades | Exclude entirely | Upstream requires main-only publication with testing dispatch and pinned testing provenance. Fork publication differences must not replace those safeguards. |
| General e2e anatomy/features edits | Exclude | Old schema expectations remain obsolete; some edits reduce specimen-specific assertions. They are not required by the maintained browser gate or suitable to carry as incidental fixes. Canonical files remain. |
| Duplicate old evidence and sync-only artifacts | Exclude | Already integrated feature reports and fork-sync copies do not represent new feature work. Existing #134 continuation receipts remain; new correctness checks are separately identified. |
| Testing overlays/baseline, unrelated experiments, VIDA3D | Exclude | Never part of the eligible completed fork-main scope. |

## Integration alternatives

| Alternative | Assessment |
| --- | --- |
| A. PR directly from fork/main | Rejected:71 differing files include personal workspace, fork hosting configuration and obsolete tests. |
| B. Clean upstream-based submission | Selected: extend the existing clean #134 branch additively, preserving both original commits, PR discussion and review identity. No duplicate PR. |
| C. Synchronize fork/main first | Unnecessary: canonical main is already its ancestor; no fork-main edits are needed. |
| D. Multiple focused PRs | Unnecessary: Pipe and caustics reuse the same observer metadata and food lifecycle; one bounded dependency stack can be reviewed with this inventory. |

Every runtime and selected test file is copied from verified fork main, with no
new functional development. Documentation reconciliation and selection of the
submission tree do not promote an experimental branch or change approved behavior.
The branch retains the original two clean #134 commits and adds only the selected
completed advances. No force-push or shared-history rewrite is used.

## Validation and limitations

Fresh `npm ci`, **385/385 fast tests**, typecheck/build and actual production
Worker checks pass locally. Complete snapshots also match upstream for **960 ticks** across 16 historical
physics/economy/contact combinations (zero stock difference), and verified fork
main for **720 ticks** across omitted/v1/v2 cycles in tank and tubes. Only the
independent build label is normalized; no simulation fields are excluded. New
correctness receipts are saved alongside this report. These are deterministic
integration regressions, not repetitions of historical ecological trials.

Worker checks include Pipe startup with zero topology,
editable controls/exact continuation, schema18/19 tank/tube lifecycle, funded x0
actions, MAX/pause/resume, physical local transfers, saved egg references and
observer-free optical/neural/PRNG continuation.

Existing #134 upstream fast/build 41460534414 and Worker/browser 41460534493 are
now verified successful, including all four browser shards and the aggregate.
They validate the original head, not the expanded candidate. New exact-head
CI links and conclusions must be read back and recorded in #57/#134.

The local Chromium installer received invalid/truncated archives; no local browser
pass is inferred. Use exact-candidate GitHub Actions browser results, retaining
all failures and disclosing any approval or execution barrier.

Original food-cycle ecological receipts remain unchanged. The v1 experiment
changed seed73 plant absorption by -25.9% and living count 11 to 10. The v1-to-v2
follow-up changed plant intake -1.2%/+24.0% for seeds 17/73 and prey intake
6816 to 9480 J / 0 to 336 J; both ended with 10 living, zero eggs and zero completed
deaths. These short registered comparisons do not demonstrate sustainable
ecology, general superiority or desktop FPS gains. They are not rerun here.

The caustics switch can reduce observer painting work; neither a universal
hardware-rendered FPS gain nor increased Worker throughput is established.
No physics, brain, starter, diet, capacity or frozen baseline is tuned.

## Review boundary and durable handoff

All related upstream issues remain open. Scope/authorization was recorded before
selection in [#57](https://github.com/smeagol44/vidAI/issues/57#issuecomment-6610391190)
and the existing PR discussion. Final pushed SHA, CI conclusions, publication
skips and native Project Status readback belong in additive English comments
there. No owner checkpoints are overwritten.

Next action after verification: maintainer review and any required workflow
approval. Submission does not authorize upstream merge, auto-merge, release,
Wiki publication, new experiments or Stage 4 implementation.
