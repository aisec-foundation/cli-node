# aisec-cli

CLI for [AISEC](https://aisec.tools) — AI-powered web application security scanner. Autonomous pentesting from your terminal.

## Quick Start

```bash
npx aisec-cli scan https://target.com --token YOUR_TOKEN
```

Or install globally:

```bash
npm i -g aisec-cli
```

Requires Node.js 18 or newer.

## Authentication

Get your token at the [AISEC Dashboard](https://app.aisec.tools/developer).

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

Run `aisec scan --help` for the complete option list, including authenticated scans, scope exclusions, tool controls, project assignment, and CI severity thresholds.

### `aisec scans`

```bash
aisec scans           # Last 10 scans
aisec scans -l 20     # Last 20 scans
```

### `aisec status`

```bash
aisec status          # Check connection & auth
```

## Links

- [AISEC Website](https://aisec.tools) — AI-powered penetration testing platform
- [Dashboard](https://app.aisec.tools) — manage scans and findings
- [How It Works](https://aisec.tools/how-it-works) — platform documentation
- [Pricing](https://aisec.tools/pricing) — plans and credits
- [Python CLI](https://github.com/aisec-foundation/cli-python) — alternative CLI

## License

MIT

## Release

Publishing is performed from a GitHub release whose tag matches `v<package version>`. The release workflow verifies the tagged code, then publishes to npm with trusted publishing and provenance.
