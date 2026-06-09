// Tiny no-deps test runner for lib.mjs. Run: node scripts/lib.test.mjs
import assert from "node:assert/strict";
import { parseIssueForm, compareVersions, isVersionString, isHttpsUrl, isCleanText } from "./lib.mjs";

let pass = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
}

t("parseIssueForm extracts labeled fields", () => {
  const body = "### Plugin update.json URL\n\nhttps://x.com/update.json\n\n### Notes\n\n_No response_";
  const f = parseIssueForm(body);
  assert.equal(f["plugin update.json url"], "https://x.com/update.json");
  assert.equal(f["notes"], "");
});

t("parseIssueForm handles CRLF and leading header", () => {
  const body = "### A\r\n\r\nfoo\r\n### B\r\n\r\nbar";
  const f = parseIssueForm(body);
  assert.equal(f["a"], "foo");
  assert.equal(f["b"], "bar");
});

t("compareVersions orders correctly", () => {
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
  assert.equal(compareVersions("1.2", "1.2.0"), 0);
  assert.equal(compareVersions("0.9.4", "0.9.108"), -1);
  assert.equal(compareVersions("1.0.0", "0.9.9"), 1);
});

t("isVersionString", () => {
  assert.ok(isVersionString("1"));
  assert.ok(isVersionString("0.9.108"));
  assert.ok(!isVersionString("1.0.0-beta"));
  assert.ok(!isVersionString("latest"));
});

t("isHttpsUrl rejects non-https", () => {
  assert.ok(isHttpsUrl("https://github.com/x"));
  assert.ok(!isHttpsUrl("http://github.com/x"));
  assert.ok(!isHttpsUrl("javascript:alert(1)"));
  assert.ok(!isHttpsUrl("not a url"));
});

t("isCleanText blocks markup but allows spaces/punctuation", () => {
  assert.ok(isCleanText("My Cool Plugin — v2 (fast)"));
  assert.ok(!isCleanText("<script>"));
  assert.ok(!isCleanText("a > b"));
});

console.log(`\n${pass} passed`);
