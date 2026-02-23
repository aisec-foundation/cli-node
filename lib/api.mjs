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
