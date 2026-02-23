import chalk from "chalk";
import { resolveAuth, resolveApi } from "./config.mjs";
import { request, healthCheck } from "./api.mjs";

export async function cmdStatus(opts) {
  const token = resolveAuth(opts);
  const apiUrl = resolveApi(opts);

  const ok = await healthCheck(apiUrl);
  if (!ok) {
    console.error(chalk.red(`API unreachable at ${apiUrl}`));
    process.exit(1);
  }
  console.log(chalk.green(`✓ API reachable at ${apiUrl}`));

  try {
    const stats = await request(apiUrl, "/api/v1/stats", token);
    console.log(chalk.green("✓ Authenticated"));
    const scans = stats.total_scans ?? "?";
    const findings = stats.total_findings ?? "?";
    const cost = stats.total_cost != null ? `$${stats.total_cost.toFixed(2)}` : "?";
    console.log(chalk.dim(`Scans: ${scans} | Findings: ${findings} | Cost: ${cost}`));
  } catch (err) {
    console.error(chalk.red(`Auth check failed: ${err.message}`));
    process.exit(1);
  }
}
