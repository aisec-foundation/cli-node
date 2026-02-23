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
    const cr = stats.credits_used ?? stats.total_cost;
    const credits = cr != null ? cr.toFixed(1) : "?";
    console.log(chalk.dim(`Scans: ${scans} | Findings: ${findings} | Credits: ${credits}`));
  } catch (err) {
    console.error(chalk.red(`Auth check failed: ${err.message}`));
    process.exit(1);
  }
}
