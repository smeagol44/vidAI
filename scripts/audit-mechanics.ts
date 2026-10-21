import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {runMechanicalAudit} from '../mechanicalAudit';
const report = runMechanicalAudit();
for (const row of [...report.controls, ...report.starters]) {
  assert.ok(Math.abs(row.reconciliationErrorJ) < 1e-8, `${row.name}: incomplete kinetic accounting`);
  assert.ok(Math.abs(row.chemicalLedgerErrorJ) < 1e-6, `${row.name}: chemical ledger mismatch`);
}
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], json);
console.log(json);
