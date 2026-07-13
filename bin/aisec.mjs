#!/usr/bin/env node

import { program } from "commander";
import { createRequire } from "node:module";
import { cmdScan } from "../lib/scan.mjs";
import { cmdScans } from "../lib/scans.mjs";
import { cmdStatus } from "../lib/status.mjs";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

program
  .name("aisec")
  .description("AI-powered web security scanner")
  .version(version);

program
  .command("scan <target>")
  .description("Launch a security scan against a target URL")
  .option("--stealth", "Stealth profile — slower, WAF evasion")
  .option("--aggressive", "Aggressive — full port scan, brute force, sqlmap")
  .option("--full", "Full — aggressive + subdomain scope + 50 iterations")
  .option("--bounty", "Bug bounty — high-impact vulns, skip noise, PoC-ready output")
  .option("--scan-type <type>", "Scan type: web, network, crypto", "web")
  .option("-e, --engine <engine>", "AI engine: claude or ollama", "claude")
  .option("-m, --model <model>", "Model name")
  .option("--review-model <model>", "Review model (default: claude-sonnet-4-6)")
  .option("--temperature <temp>", "AI temperature 0.0-1.0", parseFloat)
  .option("-n, --max-iterations <n>", "Max AI iterations", parseInt)
  .option("--scope <scope>", "Scan scope: target, domain, subdomain")
  .option("-t, --timeout <minutes>", "Timeout in minutes, 0=unlimited", parseInt)
  .option("--cost-cap <credits>", "Max credits to spend (0=no limit)", parseFloat)
  .option("--skip-recon", "Skip infrastructure recon")
  .option("--skip-browser", "Skip browser-based recon")
  .option("-u, --username <user>", "Username for auth scanning")
  .option("-p, --password <pass>", "Password for auth scanning")
  .option("--cookies <json>", "Session cookies as JSON or @file")
  .option("--proxy <url>", "Proxy URL")
  .option("--headers <headers>", "Custom headers: 'Key:Val,Key2:Val2' or @file")
  .option("--localstorage <json>", "Browser localStorage as JSON or @file")
  .option("--custom-instructions <text>", "Free-text guidance for the AI agent (max 500 chars)")
  .option("--disable-tools <tools>", "Comma-separated tools to disable (e.g. sqlmap,hydra,nikto)")
  .option("--disable-enrichments <list>", "Comma-separated enrichments to disable (e.g. leak_check,shodan)")
  .option("--out-of-scope <list>", "Comma-separated domains/paths to exclude")
  .option("--wordlist <name>", "Wordlist: common, big, api-endpoints")
  .option("--auto-compact", "Auto-compact context for long scans (saves credits)")
  .option("--project-id <id>", "Assign scan to a project")
  .option("--fail-on <severity>", "Exit 1 if findings at this severity or above (critical, high, medium, low)")
  .option("--source <source>", "Scan source identifier (cli, ci, api)", "cli")
  .option("--token <token>", "API token (or AISEC_TOKEN env)")
  .option("--api <url>", "API URL override")
  .action(cmdScan);

program
  .command("scans")
  .description("List recent scans")
  .option("-l, --limit <n>", "Number of scans to show", parseInt, 10)
  .option("--token <token>", "API token (or AISEC_TOKEN env)")
  .option("--api <url>", "API URL override")
  .action(cmdScans);

program
  .command("status")
  .description("Check API connection and authentication")
  .option("--token <token>", "API token (or AISEC_TOKEN env)")
  .option("--api <url>", "API URL override")
  .action(cmdStatus);

program.parse();
