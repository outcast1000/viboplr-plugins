// Tiny no-deps test runner for lib.mjs. Run: node scripts/lib.test.mjs
import assert from "node:assert/strict";
import { parseIssueForm, compareVersions, isVersionString, isHttpsUrl, isCleanText, SERVICE_IDS, servicesOf } from "./lib.mjs";

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

// SERVICE_IDS / servicesOf are a wire format shared with the app
// (src/utils/extensionSummary.ts, pinned there by extensionSummary.test.ts).
t("SERVICE_IDS keeps the order the app expects", () => {
  assert.deepEqual(SERVICE_IDS, [
    "playback-fallback", "downloads", "web-search", "catalog-search", "images",
    "scrobbling", "home-shelves", "assistant-tools", "visualizers", "waveforms",
  ]);
});

t("servicesOf derives declared services in SERVICE_IDS order", () => {
  const manifest = {
    contributes: {
      webSearchProviders: [{ id: "web", name: "DuckDuckGo" }],
      imageProviders: [{ entity: "artist" }],
      streamResolvers: [{ id: "yt", name: "YouTube" }],
      eventHooks: ["track:scrobbled"],
      assistant: { tools: [{ name: "search_images", description: "d" }] },
    },
  };
  assert.deepEqual(servicesOf(manifest), [
    "playback-fallback", "web-search", "images", "scrobbling", "assistant-tools",
    "images:artist",
  ]);
});

t("servicesOf adds images:<entity> and info:<typeId>, deduped, in manifest order", () => {
  const manifest = {
    contributes: {
      imageProviders: [{ entity: "album" }, { entity: "artist", provider: "x" }, { entity: "album", provider: "y" }, { entity: "planet" }],
      informationTypes: [{ id: "lyrics" }, { id: "artist_bio" }, { id: "lyrics" }, { id: "bad id!" }],
    },
  };
  assert.deepEqual(servicesOf(manifest), ["images", "images:album", "images:artist", "info:lyrics", "info:artist_bio"]);
});

t("servicesOf tolerates missing or odd contributes", () => {
  assert.deepEqual(servicesOf({}), []);
  assert.deepEqual(servicesOf(null), []);
  assert.deepEqual(servicesOf({ contributes: { assistant: { instructions: "prose only" }, searchProviders: "x" } }), []);
});

console.log(`\n${pass} passed`);
