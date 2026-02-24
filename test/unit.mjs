#!/usr/bin/env node

/**
 * Unit tests for cli-node logic — runs without API access.
 * Tests option parsing, body building, severity checking, helpers.
 */

import { strict as assert } from "node:assert";

// ── Inline copies of pure functions from lib/ (no side effects) ──

const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function sevAboveThreshold(finding, threshold) {
  if (!threshold) return false;
  const fRank = SEV_RANK[(finding || "").toLowerCase()] ?? -1;
  const tRank = SEV_RANK[threshold.toLowerCase()] ?? 99;
  return fRank >= tRank;
}

function resolveProfile(opts) {
  if (opts.full) return "full";
  if (opts.aggressive) return "aggressive";
  if (opts.stealth) return "stealth";
  return undefined;
}

function buildBody(target, opts) {
  const body = { target };
  const profile = resolveProfile(opts);
  if (profile) body.profile = profile;
  if (opts.engine !== "claude") body.engine = opts.engine;
  if (opts.model) body.model = opts.model;
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (opts.maxIterations) body.max_iterations = opts.maxIterations;
  if (opts.scope) body.scope = opts.scope;
  if (opts.timeout != null) body.timeout_minutes = opts.timeout;
  if (opts.skipRecon) body.skip_recon = true;
  if (opts.skipBrowser) body.skip_browser = true;
  if (opts.username) body.username = opts.username;
  if (opts.password) body.password = opts.password;
  if (opts.proxy) body.proxy = opts.proxy;
  return body;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function wsUrl(apiUrl) {
  return apiUrl.replace(/^http/, "ws");
}

// ── Tests ──

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log("\n── sevAboveThreshold ──");

test("critical >= high", () => {
  assert.equal(sevAboveThreshold("Critical", "high"), true);
});

test("high >= high", () => {
  assert.equal(sevAboveThreshold("High", "high"), true);
});

test("medium < high", () => {
  assert.equal(sevAboveThreshold("Medium", "high"), false);
});

test("low < high", () => {
  assert.equal(sevAboveThreshold("Low", "high"), false);
});

test("info < low", () => {
  assert.equal(sevAboveThreshold("Info", "low"), false);
});

test("critical >= critical", () => {
  assert.equal(sevAboveThreshold("Critical", "critical"), true);
});

test("high < critical", () => {
  assert.equal(sevAboveThreshold("High", "critical"), false);
});

test("medium >= medium", () => {
  assert.equal(sevAboveThreshold("Medium", "medium"), true);
});

test("medium >= low", () => {
  assert.equal(sevAboveThreshold("Medium", "low"), true);
});

test("null threshold always false", () => {
  assert.equal(sevAboveThreshold("Critical", null), false);
  assert.equal(sevAboveThreshold("Critical", undefined), false);
});

test("case insensitive", () => {
  assert.equal(sevAboveThreshold("CRITICAL", "HIGH"), true);
  assert.equal(sevAboveThreshold("high", "HIGH"), true);
});

console.log("\n── resolveProfile ──");

test("--full → full", () => {
  assert.equal(resolveProfile({ full: true }), "full");
});

test("--aggressive → aggressive", () => {
  assert.equal(resolveProfile({ aggressive: true }), "aggressive");
});

test("--stealth → stealth", () => {
  assert.equal(resolveProfile({ stealth: true }), "stealth");
});

test("no flags → undefined", () => {
  assert.equal(resolveProfile({}), undefined);
});

test("full takes priority over aggressive", () => {
  assert.equal(resolveProfile({ full: true, aggressive: true }), "full");
});

console.log("\n── buildBody ──");

test("minimal body", () => {
  const b = buildBody("https://example.com", { engine: "claude" });
  assert.deepEqual(b, { target: "https://example.com" });
});

test("all options", () => {
  const b = buildBody("https://t.com", {
    engine: "ollama",
    model: "qwen2.5:32b",
    temperature: 0.5,
    maxIterations: 30,
    scope: "domain",
    timeout: 60,
    skipRecon: true,
    skipBrowser: true,
    username: "admin",
    password: "pass",
    proxy: "http://127.0.0.1:8080",
    aggressive: true,
  });
  assert.equal(b.target, "https://t.com");
  assert.equal(b.profile, "aggressive");
  assert.equal(b.engine, "ollama");
  assert.equal(b.model, "qwen2.5:32b");
  assert.equal(b.temperature, 0.5);
  assert.equal(b.max_iterations, 30);
  assert.equal(b.scope, "domain");
  assert.equal(b.timeout_minutes, 60);
  assert.equal(b.skip_recon, true);
  assert.equal(b.skip_browser, true);
  assert.equal(b.username, "admin");
  assert.equal(b.password, "pass");
  assert.equal(b.proxy, "http://127.0.0.1:8080");
});

test("claude engine is not sent", () => {
  const b = buildBody("https://t.com", { engine: "claude" });
  assert.equal(b.engine, undefined);
});

test("profile from --full", () => {
  const b = buildBody("https://t.com", { engine: "claude", full: true });
  assert.equal(b.profile, "full");
});

console.log("\n── formatDuration ──");

test("seconds only", () => {
  assert.equal(formatDuration(45), "45s");
});

test("minutes + seconds", () => {
  assert.equal(formatDuration(125), "2m 5s");
});

test("zero", () => {
  assert.equal(formatDuration(0), "0s");
});

test("exact minute", () => {
  assert.equal(formatDuration(60), "1m 0s");
});

console.log("\n── wsUrl ──");

test("https → wss", () => {
  assert.equal(wsUrl("https://api.aisec.tools"), "wss://api.aisec.tools");
});

test("http → ws", () => {
  assert.equal(wsUrl("http://localhost:8000"), "ws://localhost:8000");
});

console.log("\n── fail-on integration logic ──");

test("findings list triggers exit code", () => {
  const findings = ["Medium", "High", "Low"];
  const failOn = "high";
  const shouldFail = findings.some(s => sevAboveThreshold(s, failOn));
  assert.equal(shouldFail, true);
});

test("no matching findings → no fail", () => {
  const findings = ["Medium", "Low", "Info"];
  const failOn = "high";
  const shouldFail = findings.some(s => sevAboveThreshold(s, failOn));
  assert.equal(shouldFail, false);
});

test("empty findings → no fail", () => {
  const findings = [];
  const failOn = "critical";
  const shouldFail = findings.some(s => sevAboveThreshold(s, failOn));
  assert.equal(shouldFail, false);
});

test("critical finding with --fail-on medium", () => {
  const findings = ["Critical"];
  const failOn = "medium";
  const shouldFail = findings.some(s => sevAboveThreshold(s, failOn));
  assert.equal(shouldFail, true);
});

// ── Summary ──

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
