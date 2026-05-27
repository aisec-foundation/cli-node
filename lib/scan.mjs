import chalk from "chalk";
import WebSocket from "ws";
import { readFileSync } from "fs";
import { resolveAuth, resolveApi, wsUrl } from "./config.mjs";
import { request, healthCheck } from "./api.mjs";

// Map a known API host to its dashboard host. Returns null for unknown
// hosts (staging/local/other tenant) so we never print a production URL
// for a scan that didn't run on production.
function dashboardUrl(apiUrl, scanId) {
  try {
    const host = new URL(apiUrl).hostname;
    if (host === "api.aisec.tools") return `https://app.aisec.tools/scans/${scanId}`;
    return null;
  } catch {
    return null;
  }
}

function resolveProfile(opts) {
  if (opts.full) return "full";
  if (opts.bounty) return "bounty";
  if (opts.aggressive) return "aggressive";
  if (opts.stealth) return "stealth";
  return undefined;
}

function parseHeaders(raw) {
  if (!raw) return undefined;
  if (raw.startsWith("@")) {
    raw = readFileSync(raw.slice(1), "utf-8").trim();
  }
  const headers = {};
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf(":");
    if (idx > 0) headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return headers;
}

function parseCookies(raw) {
  if (!raw) return undefined;
  if (raw.startsWith("@")) {
    return readFileSync(raw.slice(1), "utf-8").trim();
  }
  return raw;
}

function parseFileOrString(raw) {
  if (!raw) return undefined;
  if (raw.startsWith("@")) {
    return readFileSync(raw.slice(1), "utf-8").trim();
  }
  return raw;
}

function parseCommaSeparated(raw) {
  if (!raw) return undefined;
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function buildBody(target, opts) {
  const body = { target, source: opts.source || "cli" };
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
  if (opts.costCap != null) body.cost_cap = opts.costCap;
  if (opts.reviewModel) body.review_model = opts.reviewModel;
  if (opts.scanType && opts.scanType !== "web") body.scan_type = opts.scanType;
  const cookies = parseCookies(opts.cookies);
  if (cookies) body.cookies_json = cookies;
  const headers = parseHeaders(opts.headers);
  if (headers) body.custom_headers = headers;
  const ls = parseFileOrString(opts.localstorage);
  if (ls) body.localstorage_json = ls;
  if (opts.customInstructions) body.custom_instructions = opts.customInstructions;
  const disabledTools = parseCommaSeparated(opts.disableTools);
  if (disabledTools) body.disabled_tools = disabledTools;
  const disabledEnrichments = parseCommaSeparated(opts.disableEnrichments);
  if (disabledEnrichments) body.disabled_enrichments = disabledEnrichments;
  const outOfScope = parseCommaSeparated(opts.outOfScope);
  if (outOfScope) body.out_of_scope = outOfScope;
  if (opts.wordlist) body.wordlist = opts.wordlist;
  if (opts.autoCompact) body.auto_compact = true;
  if (opts.projectId) body.project_id = opts.projectId;
  return body;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function sevAboveThreshold(finding, threshold) {
  if (!threshold) return false;
  const fRank = SEV_RANK[(finding || "").toLowerCase()] ?? -1;
  const tRank = SEV_RANK[threshold.toLowerCase()] ?? 99;
  return fRank >= tRank;
}

const THINKING_VERBS = [
  "Thinking", "Analyzing", "Probing", "Investigating", "Evaluating",
  "Inspecting", "Scanning", "Crafting", "Assessing", "Examining",
  "Mapping", "Enumerating", "Fingerprinting", "Strategizing",
];
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function createThinkingSpinner() {
  let interval = null;
  let frame = 0;
  let verb = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
  let verbInterval = null;

  return {
    start() {
      this.stop();
      verb = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
      frame = 0;
      interval = setInterval(() => {
        const f = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
        process.stdout.write(`\r${chalk.cyan(f)} ${chalk.dim.italic(verb)}  `);
        frame++;
      }, 80);
      verbInterval = setInterval(() => {
        verb = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
      }, 3000 + Math.random() * 2000);
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
        process.stdout.write("\r" + " ".repeat(40) + "\r");
      }
      if (verbInterval) {
        clearInterval(verbInterval);
        verbInterval = null;
      }
    },
  };
}

export async function cmdScan(target, opts) {
  if (!/^https?:\/\//i.test(target)) {
    console.error(chalk.red(`Target must start with http:// or https://`));
    process.exit(1);
  }

  const token = resolveAuth(opts);
  const apiUrl = resolveApi(opts);

  const ok = await healthCheck(apiUrl);
  if (!ok) {
    console.error(chalk.red(`API unreachable at ${apiUrl}`));
    process.exit(1);
  }

  const body = buildBody(target, opts);
  const profile = resolveProfile(opts) || "default";

  // Fetch account info before scan
  let accountPlan = "?";
  let accountCredits = "?";
  try {
    const me = await request(apiUrl, "/api/v1/auth/me", token);
    accountPlan = me.plan || "free";
    accountCredits = parseFloat(me.credits_balance || 0).toFixed(1);
  } catch {}

  console.log(
    chalk.red("━".repeat(50)) + "\n" +
    chalk.bold.red(" aisec") + chalk.dim(" — AI security scanner\n") +
    chalk.dim(` Target:  `) + chalk.white(target) + "\n" +
    chalk.dim(` Account: `) + chalk.white(accountPlan) + chalk.dim(" · ") + chalk.yellow.bold(accountCredits) + chalk.dim(" credits") + "\n" +
    chalk.dim(` Profile: `) + chalk.cyan(profile) + "\n" +
    chalk.dim(` Engine:  `) + chalk.cyan(opts.engine || "claude") + "\n" +
    chalk.red("━".repeat(50))
  );

  let scan;
  try {
    scan = await request(apiUrl, "/api/v1/scans", token, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(chalk.red(`Failed to create scan: ${err.message}`));
    process.exit(1);
  }

  const scanId = scan.id;
  console.log(chalk.dim(`Scan ${scanId.slice(0, 8)}... created`));

  // Expose scan ID for CI (GitHub Actions, etc.)
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import("fs");
    appendFileSync(process.env.GITHUB_OUTPUT, `scan-id=${scanId}\n`);
  }

  if (scan.queue_position && scan.queue_position > 0) {
    console.log(chalk.yellow(`Queued at position ${scan.queue_position}`));
  }

  // WebSocket streaming
  const wsBase = wsUrl(apiUrl);
  const wsUrlFull = `${wsBase}/ws/scans/${scanId}`;

  // The API authenticates the socket via the `aisec-token` subprotocol
  // (same as the dashboard + Python CLI). It does NOT read ?token= from the
  // URL — passing it there both fails auth and risks leaking the token into
  // logs. The ws lib sends the second protocol entry as the token value.
  const ws = new WebSocket(wsUrlFull, ["aisec-token", token]);
  let cancelled = false;
  let completed = false;      // set true on scan_complete
  const foundFindings = [];   // track severities for --fail-on
  let exitCode = 0;

  const cancel = async () => {
    if (cancelled) process.exit(1);
    cancelled = true;
    console.log(chalk.yellow("\nCancelling scan..."));
    try {
      await request(apiUrl, `/api/v1/scans/${scanId}/cancel`, token, { method: "POST" });
    } catch {}
    setTimeout(() => process.exit(0), 2000);
  };

  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);

  ws.on("open", () => {
    // keepalive
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      } else {
        clearInterval(ping);
      }
    }, 30_000);
    ws.once("close", () => clearInterval(ping));
  });

  const spinner = createThinkingSpinner();

  ws.on("message", async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "thinking":
        if (msg.data?.status === "start") spinner.start();
        else spinner.stop();
        break;

      case "console":
        spinner.stop();
        if (msg.data?.text) process.stdout.write(msg.data.text + "\n");
        break;

      case "finding":
        spinner.stop();
        console.log(chalk.bold.yellow(`\n[FINDING] ${msg.data?.title || "Vulnerability found"}`));
        if (msg.data?.severity) {
          console.log(chalk.dim(`  Severity: ${msg.data.severity}`));
          foundFindings.push(msg.data.severity);
        }
        break;

      case "cost_update":
        {
          // Backend emits token counts now (cost/credits were removed).
          const ti = msg.data?.tokens_in;
          const to = msg.data?.tokens_out;
          if (ti != null || to != null) {
            process.stdout.write(chalk.dim(`  [tokens ${ti ?? 0} in · ${to ?? 0} out]\r`));
          }
        }
        break;

      case "error":
        spinner.stop();
        console.error(chalk.red(`\nError: ${msg.data?.message || "Unknown error"}`));
        break;

      case "scan_complete": {
        spinner.stop();
        completed = true;
        const d = msg.data || {};
        const tokensIn = d.tokens_in ?? 0;
        const tokensOut = d.tokens_out ?? 0;
        const reportUrl = dashboardUrl(apiUrl, scanId);
        console.log(
          "\n" + chalk.green("━".repeat(50)) + "\n" +
          chalk.bold.green(" Scan complete\n") +
          chalk.dim(` Findings: `) + chalk.white(d.findings ?? 0) + "\n" +
          chalk.dim(` Tokens:   `) + chalk.white(`${tokensIn} in · ${tokensOut} out`) + "\n" +
          (reportUrl
            ? chalk.dim(` Report:   `) + chalk.underline.cyan(reportUrl)
            : chalk.dim(` Scan ID:  `) + chalk.white(scanId)) + "\n" +
          chalk.green("━".repeat(50))
        );

        // CI outputs
        if (process.env.GITHUB_OUTPUT) {
          const { appendFileSync } = await import("fs");
          appendFileSync(process.env.GITHUB_OUTPUT, `findings=${d.findings ?? 0}\n`);
          if (reportUrl) appendFileSync(process.env.GITHUB_OUTPUT, `report-url=${reportUrl}\n`);
        }

        // --fail-on check
        if (opts.failOn) {
          const failed = foundFindings.some(s => sevAboveThreshold(s, opts.failOn));
          if (failed) {
            console.log(chalk.red(`\n✗ Findings at ${opts.failOn}+ severity detected — exiting with code 1`));
            exitCode = 1;
          } else {
            console.log(chalk.green(`\n✓ No findings at ${opts.failOn}+ severity`));
          }
        }

        ws.close();
        break;
      }

      case "scan_started":
        console.log(chalk.cyan("Scan started, streaming output...\n"));
        break;
    }
  });

  ws.on("error", (err) => {
    console.error(chalk.red(`WebSocket error: ${err.message}`));
  });

  ws.on("close", (code) => {
    spinner.stop();
    if (cancelled) return;
    // Closing before scan_complete means we never saw the result (auth
    // failure, network drop, server restart). Don't let CI read that as a
    // pass — exit non-zero so the pipeline surfaces it.
    if (!completed && exitCode === 0) {
      console.error(
        chalk.red(`\n✗ Stream closed before the scan completed (ws code ${code ?? "?"}). `) +
        chalk.dim("Check the dashboard for status; the scan may still be running.")
      );
      exitCode = 1;
    }
    process.exit(exitCode);
  });
}
