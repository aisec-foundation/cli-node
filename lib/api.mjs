import chalk from "chalk";

export async function request(apiUrl, path, token, opts = {}) {
  const url = `${apiUrl}${path}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });

  if (!res.ok) {
    if (res.status === 401) {
      console.error(chalk.red("Invalid API token."));
      process.exit(1);
    }
    const body = await res.text();
    if (res.status === 403) {
      try {
        const parsed = JSON.parse(body);
        const err = parsed?.detail || parsed;
        if (err?.error === "target_not_verified") {
          const root = err.root_domain || "your target";
          console.error(chalk.bold.red("\nTarget not verified"));
          console.error(`To scan ${chalk.bold(root)}, publish a DNS TXT record:`);
          console.error(`  ${chalk.cyan("Host")}:  _aisec-verify.${root}`);
          console.error(`  ${chalk.cyan("Type")}:  TXT`);
          console.error(`  ${chalk.cyan("Value")}: use the dashboard to get your per-user challenge token`);
          // Prefer the backend-provided per-project verification path; fall
          // back to /projects (verification is per-project — there is no
          // account-wide /verifications route).
          const vpath = err.verification_url || "/projects";
          console.error(`\nDashboard: ${chalk.cyan(`https://app.aisec.tools${vpath}`)}`);
          process.exit(3);
        }
      } catch {}
    }
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }

  return res.json();
}

export async function healthCheck(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
