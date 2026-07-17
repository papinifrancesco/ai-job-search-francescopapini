# wttj-cli

CLI for searching **Welcome to the Jungle (France)** job listings via the
site's public Algolia search index, plus its unauthenticated REST endpoint for
job detail.

**Data source**: the `wttj_jobs_production_fr` Algolia index (~90k live French
postings) and `api.welcometothejungle.com/api/v1/organizations/{org}/jobs/{slug}`.
**Authentication**: None — the Algolia application id and search-only key are
public (they ship in WTTJ's frontend bundle).
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and
only pulls dev type defs.

> **Unofficial API.** WTTJ publishes no official public API; this CLI uses the
> same public search infrastructure the site's own frontend uses. If the public
> key ever rotates, set `WTTJ_ALGOLIA_APP_ID` / `WTTJ_ALGOLIA_API_KEY` /
> `WTTJ_ALGOLIA_INDEX` (and `WTTJ_API_URL`) — re-extraction steps are in
> `../url-reference.md`. Keep usage personal and low-volume.

## Installation

```bash
cd .agents/skills/wttj-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search jobs by keyword and facet filters |
| `detail` | Fetch full detail for a single job by `orgSlug/jobSlug` or URL |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Data roles in Paris posted in the last 14 days, table view
bun run src/cli.ts search -q "data engineer" -l Paris --jobage 14 --format table

# CDI project-management roles in Aix-en-Provence
bun run src/cli.ts search -q "chef de projet" -l "Aix-en-Provence" --contract full_time

# Fully remote Python roles
bun run src/cli.ts search -q "développeur python" --remote fulltime --format table

# Full detail for one job (id from a search result)
bun run src/cli.ts detail skiils/ai-engineer-data-scientist-ia-generative-search-h-f --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / company / role). Full-text; optional. |
| `--location` | `-l` | City filter, comma = OR. **Exact site spellings, accents included.** |
| `--country` | | ISO country code(s), e.g. `FR`. |
| `--contract` | | `full_time`, `temporary`, `freelance`, `internship`, `apprenticeship`, `vie` (comma = OR). |
| `--remote` | | `fulltime` \| `partial` \| `punctual` \| `no` \| `unknown`. Bare = `fulltime`. |
| `--company` | | Organization slug (from a result's `org_slug`). |
| `--jobage` | | Posted within N days. |
| `--page` | | 1-indexed page. Default 1. |
| `--limit` | `-n` | Results per page. Default 25. |
| `--filter` | | Raw Algolia filter expression (repeatable); numeric comparisons route to `numericFilters`. |
| `--format` | | `json` \| `table` \| `plain`. |

## Tests

```bash
bun test          # offline only — mocked fetch, no live portal requests
bun run typecheck
```
