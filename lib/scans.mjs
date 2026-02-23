import chalk from "chalk";
import { resolveAuth, resolveApi } from "./config.mjs";
import { request } from "./api.mjs";

const STATUS_COLORS = {
  running: chalk.green,
  completed: chalk.blue,
  failed: chalk.red,
  cancelled: chalk.dim,
  pending: chalk.yellow,
  queued: chalk.yellow,
};

export async function cmdScans(opts) {
  const token = resolveAuth(opts);
  const apiUrl = resolveApi(opts);
  const limit = opts.limit || 10;

  let data;
  try {
    data = await request(apiUrl, `/api/v1/scans?limit=${limit}`, token);
  } catch (err) {
    console.error(chalk.red(`Failed to fetch scans: ${err.message}`));
    process.exit(1);
  }

  const scans = Array.isArray(data) ? data : data.items || data.scans || [];

  if (scans.length === 0) {
    console.log(chalk.dim("No scans found."));
    return;
  }

  console.log(
    chalk.dim("Status".padEnd(12)) +
    chalk.dim("Domain".padEnd(30)) +
    chalk.dim("Finds".padStart(6)) +
    chalk.dim("Cost".padStart(9)) +
    chalk.dim("Date".padStart(13)) +
    chalk.dim("ID".padStart(11))
  );
  console.log(chalk.dim("─".repeat(81)));

  for (const s of scans) {
    const color = STATUS_COLORS[s.status] || chalk.white;
    const domain = (s.target || "").replace(/^https?:\/\//, "").slice(0, 28);
    const findings = String(s.findings_count ?? s.total_findings ?? 0);
    const cr = s.credits_used ?? s.total_cost;
    const cost = cr != null ? `${cr.toFixed(1)}` : "-";
    const date = s.created_at ? s.created_at.slice(0, 10) : "-";
    const id = (s.id || "").slice(0, 8);

    console.log(
      color(s.status.padEnd(12)) +
      chalk.white(domain.padEnd(30)) +
      chalk.white(findings.padStart(6)) +
      chalk.white(cost.padStart(9)) +
      chalk.dim(date.padStart(13)) +
      chalk.dim(id.padStart(11))
    );
  }
}
