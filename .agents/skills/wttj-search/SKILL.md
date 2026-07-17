---
name: wttj-search
version: 1.0.0
description: >
  Use this skill to search live job listings in France on Welcome to the Jungle
  (welcometothejungle.com, "WTTJ") — CDI, CDD, stage, alternance, freelance,
  remote/télétravail — or to look up a specific WTTJ posting. Trigger phrases:
  jobs in France, find a job in Paris / Lyon / anywhere in France, French job
  search, Welcome to the Jungle, WTTJ; recherche d'emploi, offres d'emploi,
  trouver un emploi / un poste, emploi à <ville>, poste en CDI, télétravail,
  alternance, stage, "y a-t-il des postes de <rôle> à <ville>".
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/wttj-search/cli/src/cli.ts *)
---

# Welcome to the Jungle (France) Search Skill

Search live job listings from **[Welcome to the Jungle](https://www.welcometothejungle.com/fr)**,
one of France's largest job platforms (~90k live postings). The site is a React
client over a public Algolia search index; this skill queries that index
directly — no account, no API key, and **zero runtime dependencies** — it runs
with just `bun`. Job detail comes from WTTJ's unauthenticated REST API.

> This is a **France-market portal skill** (the `wttj_jobs_production_fr`
> index). Per this repo's policy, market-specific portals live in your fork and
> are not upstreamed. It follows the JSON-API portal pattern of
> `freehire-search` rather than the HTML-scraping pattern of `linkedin-search`.

## ⚠️ Personal use only / unofficial API

The Algolia application id and search-only key ship in WTTJ's public frontend
bundle — reads are unauthenticated, the same zero-signup bar as
`linkedin-search`. WTTJ publishes no official public API, so treat this as an
unofficial integration: keep volumes low (a handful of queries per `/scrape`
run), no bulk harvesting or commercial redistribution. The www robots.txt
restricts query-string crawling of the site itself; this skill deliberately
talks to the Algolia host and `api.welcometothejungle.com` instead of scraping
pages.

**If the public key rotates**, searches fail with a 403 and a pointed error
message. Fix without code changes via env vars — `WTTJ_ALGOLIA_APP_ID`,
`WTTJ_ALGOLIA_API_KEY`, `WTTJ_ALGOLIA_INDEX`, `WTTJ_API_URL` — after
re-extracting the values from the site (steps in `url-reference.md`).

## When to use this skill

- Search French job openings by keyword, city, contract type, remote policy, or recency
- Get the full description of a specific WTTJ posting (by id or URL)

## Commands

### Search job listings

```bash
bun run .agents/skills/wttj-search/cli/src/cli.ts search [-q "<keywords>"] [filter flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, company, role). Full-text; optional.
- `--location <cities>` / `-l <cities>` — city filter, comma = OR (`offices.city` facet).
  **Values are the site's exact spellings, accents included**: `Paris`,
  `"Aix-en-Provence"`, `"Saint-Étienne"`. A misspelled/unaccented city silently
  returns 0 hits.
- `--country <codes>` — ISO country code(s), e.g. `FR` (the index carries a few non-FR offices).
- `--contract <types>` — comma = OR: `full_time`, `temporary`, `freelance`, `internship`, `apprenticeship`, `vie`.
- `--remote <mode>` — `fulltime` | `partial` | `punctual` | `no` | `unknown`. Bare `--remote` means `fulltime`.
- `--company <orgSlug>` — organization slug (from a result's `org_slug`).
- `--jobage <days>` — posted within N days.
- `--page <n>` — 1-indexed page. Default 1.
- `--limit <n>` / `-n <n>` — results per page. Default 25.
- `--filter <expr>` — raw Algolia filter expression, repeatable, for the facet
  long tail (e.g. `--filter 'sectors.parent_reference:"tech-1"'`). Numeric
  comparisons (`--filter "salary_yearly_minimum>=50000"`) are routed to
  Algolia's `numericFilters` automatically.
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/wttj-search/cli/src/cli.ts detail <orgSlug/jobSlug|url|reference> [--format json|plain]
```

The reference is a search result's `id` (e.g. `skiils/ai-engineer-h-f`), a
full `welcometothejungle.com/.../companies/<org>/jobs/<slug>` URL in any
locale, or a bare WTTJ job reference — the WK-style value (`SKIIL_kyzZ6Qw`)
or the uuid form — which is resolved to the slugs via one extra Algolia
lookup. Returns the full description (the posting's description, "profil
recherché" and recruitment-process sections joined as readable text), contract
info, salary when published, offices, and the direct `apply_url`.

## Usage examples

```bash
# Data roles in Paris posted in the last 14 days, table view
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "data engineer" -l Paris --jobage 14 --format table

# Project-management CDI roles in Aix-en-Provence
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "chef de projet" -l "Aix-en-Provence" --contract full_time

# Fully remote Python roles
bun run .agents/skills/wttj-search/cli/src/cli.ts search -q "développeur python" --remote fulltime --format table

# Everything a specific company has open
bun run .agents/skills/wttj-search/cli/src/cli.ts search --company alan --format table

# Full details for one posting (id from a search result)
bun run .agents/skills/wttj-search/cli/src/cli.ts detail skiils/ai-engineer-data-scientist-ia-generative-search-h-f --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing a result's `id` to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

Search JSON is `{ "meta": { "count", "page", "total", "total_pages" }, "results": [...] }`;
each result carries at least `id`, `title`, `company`, `location`, `date`, and
`url` (missing values are `null`), plus `org_slug`, `contract_type`, `remote`,
`salary`, and `language`. All errors are written to **stderr** as
`{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Pages are 1-indexed at the CLI; the 0-indexed Algolia conversion is internal.
- Algolia caps reachable results at ~1000 (`meta.total` still reports the true
  count) — narrow with filters instead of paging deep.
- `location` is a summary of up to three offices (`"Paris, FR; Lyon, FR +10 more"`);
  `detail` exposes the full office list.
- `date` is the posting's `published_at`; `--jobage` filters on the matching
  epoch timestamp, so freshness is exact.
- Salary appears only when the employer publishes it — `null` is common.
- Fetches retry 429/5xx with exponential backoff; an unreachable API exits
  non-zero fast with a clear message, so an outage degrades this source rather
  than breaking the surrounding `/scrape` run.
