# @aisec-foundation/cli

CLI for **aisec** — AI-powered web security scanner.

## Quick Start

```bash
npx @aisec-foundation/cli scan https://target.com --token YOUR_TOKEN
```

Or install globally:

```bash
npm i -g @aisec-foundation/cli
```

## Authentication

Get your token at [app.aisec.tools/developer](https://app.aisec.tools/developer).

```bash
export AISEC_TOKEN=ask_...
aisec scan https://target.com
```

## Commands

### `aisec scan <target>`

```bash
aisec scan https://target.com              # Default balanced scan
aisec scan https://target.com --full       # Aggressive + subdomains
aisec scan https://target.com --aggressive # Full port scan, sqlmap
aisec scan https://target.com --stealth    # WAF evasion, slow
```

Options: `--engine`, `--model`, `--temperature`, `--max-iterations`, `--scope`, `--timeout`, `--skip-recon`, `--skip-browser`, `--username`, `--password`, `--cookies`, `--proxy`, `--headers`

### `aisec scans`

```bash
aisec scans           # Last 10 scans
aisec scans -l 20     # Last 20 scans
```

### `aisec status`

```bash
aisec status          # Check connection & auth
```

## License

MIT
