import chalk from "chalk";
import WebSocket from "ws";
import { readFileSync } from "fs";
import { resolveAuth, resolveApi, wsUrl } from "./config.mjs";
import { request, healthCheck } from "./api.mjs";

function resolveProfile(opts) {
  if (opts.full) return "full";
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
  const cookies = parseCookies(opts.cookies);
  if (cookies) body.cookies_json = cookies;
  const headers = parseHeaders(opts.headers);
  if (headers) body.custom_headers = headers;
  return body;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
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

  console.log(
    chalk.red("━".repeat(50)) + "\n" +
    chalk.bold.red(" aisec") + chalk.dim(" — AI security scanner\n") +
    chalk.dim(` Target:  `) + chalk.white(target) + "\n" +
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

  if (scan.queue_position && scan.queue_position > 0) {
    console.log(chalk.yellow(`Queued at position ${scan.queue_position}`));
  }

  // WebSocket streaming
  const wsBase = wsUrl(apiUrl);
  const wsUrlFull = `${wsBase}/ws/scans/${scanId}?token=${token}`;

  const ws = new WebSocket(wsUrlFull);
  let cancelled = false;

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

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "console":
        if (msg.data?.text) process.stdout.write(msg.data.text + "\n");
        break;

      case "finding":
        console.log(chalk.bold.yellow(`\n[FINDING] ${msg.data?.title || "Vulnerability found"}`));
        if (msg.data?.severity) console.log(chalk.dim(`  Severity: ${msg.data.severity}`));
        break;

      case "cost_update":
        if (msg.data?.cost != null) {
          process.stdout.write(chalk.dim(`  [$${msg.data.cost.toFixed(2)}]\r`));
        }
        break;

      case "error":
        console.error(chalk.red(`\nError: ${msg.data?.message || "Unknown error"}`));
        break;

      case "scan_complete": {
        const d = msg.data || {};
        const duration = d.duration ? formatDuration(d.duration) : "?";
        console.log(
          "\n" + chalk.green("━".repeat(50)) + "\n" +
          chalk.bold.green(" Scan complete\n") +
          chalk.dim(` Findings: `) + chalk.white(d.findings ?? 0) + "\n" +
          chalk.dim(` Cost:     `) + chalk.white(`$${(d.cost ?? 0).toFixed(2)}`) + "\n" +
          chalk.dim(` Duration: `) + chalk.white(duration) + "\n" +
          chalk.green("━".repeat(50))
        );
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

  ws.on("close", () => {
    if (!cancelled) process.exit(0);
  });
}
