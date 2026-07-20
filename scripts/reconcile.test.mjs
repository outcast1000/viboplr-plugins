// Tests for the version-reconcile logic. Run: node scripts/reconcile.test.mjs
import assert from "node:assert/strict";
import { planEntryUpdate, applyPlan } from "./reconcile.mjs";

let pass = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

t("plans a version bump and a minAppVersion bump", () => {
  const entry = { id: "x", version: "1.0.0", minAppVersion: "0.7.0" };
  const { changes, errors } = planEntryUpdate(entry, { version: "1.3.0", minAppVersion: "0.9.78", file: "u" });
  assert.deepEqual(errors, []);
  assert.deepEqual(changes, { version: "1.3.0", minAppVersion: "0.9.78" });
});

t("no changes when already in sync", () => {
  const entry = { id: "x", version: "1.3.0", minAppVersion: "0.9.0" };
  const { changes, errors } = planEntryUpdate(entry, { version: "1.3.0", minAppVersion: "0.9.0" });
  assert.deepEqual(errors, []);
  assert.deepEqual(changes, {});
});

t("plans adding version to an entry that lacks one", () => {
  const entry = { id: "x", minAppVersion: "0.9.0" };
  const { changes } = planEntryUpdate(entry, { version: "2.0.0", minAppVersion: "0.9.0" });
  assert.deepEqual(changes, { version: "2.0.0" });
});

t("leaves minAppVersion untouched when update.json omits it", () => {
  const entry = { id: "x", version: "1.0.0", minAppVersion: "0.7.0" };
  const { changes, errors } = planEntryUpdate(entry, { version: "1.1.0" });
  assert.deepEqual(errors, []);
  assert.deepEqual(changes, { version: "1.1.0" }); // minAppVersion not in changes
});

t("hard error on missing/non-numeric update.json version", () => {
  assert.equal(planEntryUpdate({ id: "x" }, {}).errors.length, 1);
  assert.equal(planEntryUpdate({ id: "x" }, { version: "beta" }).errors.length, 1);
});

t("hard error on non-numeric minAppVersion", () => {
  const { errors } = planEntryUpdate({ id: "x" }, { version: "1.0.0", minAppVersion: "latest" });
  assert.equal(errors.length, 1);
});

t("applyPlan inserts version right after description, preserving key order", () => {
  const entry = { id: "x", name: "X", author: "A", description: "d", minAppVersion: "0.7.0", updateUrl: "u" };
  const changed = applyPlan(entry, { version: "1.3.0", minAppVersion: "0.9.0" });
  assert.equal(changed, true);
  assert.deepEqual(Object.keys(entry), ["id", "name", "author", "description", "version", "minAppVersion", "updateUrl"]);
  assert.equal(entry.version, "1.3.0");
  assert.equal(entry.minAppVersion, "0.9.0");
});

t("applyPlan updates an existing version in place", () => {
  const entry = { id: "x", version: "1.0.0" };
  applyPlan(entry, { version: "1.1.0" });
  assert.equal(entry.version, "1.1.0");
  assert.deepEqual(Object.keys(entry), ["id", "version"]);
});

t("applyPlan returns false when there is nothing to change", () => {
  assert.equal(applyPlan({ id: "x", version: "1.0.0" }, {}), false);
});

console.log(`\n${pass} passed`);
