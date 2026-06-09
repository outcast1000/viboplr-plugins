// Tests for the recommended single-source logic. Run: node scripts/recommended.test.mjs
import assert from "node:assert/strict";
import { applyRecommended, sortPlugins } from "./recommended.mjs";

let pass = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

const mk = () => ({
  version: 2,
  plugins: [
    { id: "auto-tagger", name: "Auto Tagger" },
    { id: "youtube", name: "YouTube" },
    { id: "genius", name: "Genius" },
  ],
});

t("applyRecommended flags listed ids and sorts them first", () => {
  const idx = mk();
  const { applied, unknown } = applyRecommended(idx, ["youtube"]);
  assert.deepEqual(applied, ["youtube"]);
  assert.deepEqual(unknown, []);
  assert.equal(idx.plugins[0].id, "youtube");            // recommended sorts first
  assert.equal(idx.plugins[0].recommended, true);
  assert.ok(!("recommended" in idx.plugins[1]));         // others have no flag at all
});

t("declarative: re-applying a different set clears the old flag", () => {
  const idx = mk();
  applyRecommended(idx, ["youtube"]);
  applyRecommended(idx, ["genius"]);                     // youtube no longer listed
  const yt = idx.plugins.find((p) => p.id === "youtube");
  const ge = idx.plugins.find((p) => p.id === "genius");
  assert.ok(!("recommended" in yt), "youtube flag should be removed");
  assert.equal(ge.recommended, true);
});

t("empty list = nothing recommended, alphabetical order", () => {
  const idx = mk();
  applyRecommended(idx, []);
  assert.deepEqual(idx.plugins.map((p) => p.id), ["auto-tagger", "genius", "youtube"]);
  assert.ok(idx.plugins.every((p) => !("recommended" in p)));
});

t("unknown ids are reported, not applied", () => {
  const idx = mk();
  const { applied, unknown } = applyRecommended(idx, ["youtube", "ghost"]);
  assert.deepEqual(applied, ["youtube"]);
  assert.deepEqual(unknown, ["ghost"]);
});

t("idempotent — applying same set twice is stable", () => {
  const a = mk(); applyRecommended(a, ["youtube", "genius"]);
  const b = mk(); applyRecommended(b, ["youtube", "genius"]); applyRecommended(b, ["youtube", "genius"]);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

t("sortPlugins: two recommended stay alphabetical among themselves", () => {
  const idx = mk();
  applyRecommended(idx, ["youtube", "genius"]);
  // recommended block first, alphabetical: Genius, YouTube; then Auto Tagger
  assert.deepEqual(idx.plugins.map((p) => p.id), ["genius", "youtube", "auto-tagger"]);
});

console.log(`\n${pass} passed`);
