#!/usr/bin/env node

import { program } from "commander";
import { cmdScan } from "../lib/scan.mjs";
import { cmdScans } from "../lib/scans.mjs";
import { cmdStatus } from "../lib/status.mjs";

program
  .name("aisec")
  .description("AI-powered web security scanner")
  .version("0.1.0");

program
  .command("scan <target>")
  .description("Launch a security scan against a target URL")
  .option("--stealth", "Stealth profile — slower, WAF evasion")
  .option("--aggressive", "Aggressive — full port scan, brute force, sqlmap")
  .option("--full", "Full — aggressive + subdomain scope + 50 iterations")
  .option("-e, --engine <engine>", "AI engine: claude or ollama", "claude")
  .option("-m, --model <model>", "Model name")
  .option("--temperature <temp>", "AI temperature 0.0-1.0", parseFloat)
  .option("-n, --max-iterations <n>", "Max AI iterations", parseInt)
  .option("--scope <scope>", "Scan scope: target, domain, subdomain")
  .option("-t, --timeout <minutes>", "Timeout in minutes, 0=unlimited", parseInt)
  .option("--skip-recon", "Skip infrastructure recon")
  .option("--skip-browser", "Skip browser-based recon")
  .option("-u, --username <user>", "Username for auth scanning")
  .option("-p, --password <pass>", "Password for auth scanning")
  .option("--cookies <json>", "Session cookies as JSON or @file")
  .option("--proxy <url>", "Proxy URL")
  .option("--headers <headers>", "Custom headers: 'Key:Val,Key2:Val2' or @file")
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
