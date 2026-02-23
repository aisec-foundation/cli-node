import chalk from "chalk";

const DEFAULT_API = "https://api.aisec.tools";

export function resolveAuth(opts) {
  const token = opts.token || process.env.AISEC_TOKEN;
  if (!token) {
    console.error(chalk.red("No API token provided."));
    console.error(
      `Set ${chalk.cyan("AISEC_TOKEN")} env var or pass ${chalk.cyan("--token")}\n` +
      `Get your token at ${chalk.underline("https://app.aisec.tools/developer")}`
    );
    process.exit(1);
  }
  return token;
}

export function resolveApi(opts) {
  return (opts.api || process.env.AISEC_API || DEFAULT_API).replace(/\/$/, "");
}

export function wsUrl(apiUrl) {
  return apiUrl.replace(/^http/, "ws");
}
