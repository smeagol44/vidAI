# Runtime loss after all500 offspring — held-outs unresolved

Scientific source f669e09a56e41a1b1c87ff5b8c6aaa5ec266d187;protocol d01d1fd1359b27ee4b8df6bd39356d0071717fb1;draft #104/issue #103.

All500 unique offspring+5 founders and50 strict decisions were independently archived and Git-readback verified through evidence commit5cefc73c3eecc22c0412319c620717be4d4ec3c7. No training outcome was re-executed or replaced.

Next,held-out intent48f75676257297be155f71454c7d2b6cfea47992 was published. In-memory evidenceHead advanced to that SHA,so its fresh ref readback passed. A later local command failed with `write_stdin failed: Unified exec process failed: exec-server transport disconnected; failed to resume exec-server session: recovery timed out after25s`. The runtime was declared unavailable,and a read-only pwd failed with `No usable execution environment is available`.

The error does not name the active local command. It could have been the intent-receipt write or the post/checkpoint subprocess. There is no completed056-held-outs archive in the remote tree. This does NOT prove that no held-out ran. Number started/completed is unknown (0–15). Do not re-execute any uncertain held-out or assign it0J.

Original scratch root was `/workspace/scratch/4b3e1fd14e68/vida-proximity`. Inspect `docs/experiments/proximity-targeting-v1/{requests,packets,received,champions}` and `../proximity-targeting-bundles/056-held-outs-run.log`,ZIP/parts if that original runtime returns. Received files were atomically saved before metric interpretation. Preserve every original receipt. Recoverable known packets can be finalized/archived by I/O only;unknown slots require an explicit owner recovery decision.

Source/analysis CI may restore and audit only the505 preserved training packets,derive curves,lineage/trajectories and replay final TRAINING specimens for verification. It must never invoke initial,generation or post actions. Full experiment completion and15 held-out deliverables remain blocked.

No merge,deployment,Wiki,production/testing release,extra experiment orVIDA3D changes.
