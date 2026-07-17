#!/usr/bin/env bun
// Self-contained CLI for searching Welcome to the Jungle (France) via the
// site's public Algolia search index and unauthenticated REST detail endpoint.
// No external CLI framework and zero runtime dependencies, so it runs anywhere
// `bun` is available with nothing installed beyond the repo clone.
//
// Unofficial-API dependency: the Algolia application id / search-only key ship
// in WTTJ's frontend bundle and can rotate. All of them are overridable:
// WTTJ_ALGOLIA_APP_ID, WTTJ_ALGOLIA_API_KEY, WTTJ_ALGOLIA_INDEX, WTTJ_API_URL.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { algoliaIndex } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

// Short-flag aliases.
const ALIAS: Record<string, string> = { q: "query", l: "location", n: "limit" }

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("-")) {
      ;(flags._ as string[]).push(a)
      continue
    }
    const name = a.replace(/^-+/, "")
    const key = ALIAS[name] ?? name
    const next = argv[i + 1]
    // A flag with no following value (or another flag next) is a boolean.
    let value: string | boolean = true
    if (next !== undefined && !next.startsWith("-")) {
      value = next
      i++
    }
    // --filter repeats; collect into an array. Everything else is last-wins.
    // A bare --filter records an empty entry so validation can reject it.
    if (key === "filter") {
      const acc = Array.isArray(flags.filter) ? flags.filter : []
      acc.push(typeof value === "string" ? value : "")
      flags.filter = acc
    } else {
      flags[key] = value
    }
  }
  return flags
}

type FlagValue = string | boolean | string[] | undefined

/**
 * A flag's string value. A bare flag (set without a value, i.e. `true`) yields
 * `whenBare` — e.g. `--remote` alone means the `fulltime` remote facet.
 */
function stringFlag(raw: FlagValue, whenBare?: string): string | undefined {
  if (typeof raw === "string") return raw
  if (raw === true) return whenBare
  return undefined
}

/** Split a comma-separated facet value ("Paris,Lyon") into a trimmed value list. */
function commaList(raw: FlagValue): string[] {
  if (typeof raw !== "string") return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

const HELP = `wttj-cli — search Welcome to the Jungle (France) job listings

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [filter flags] [--format json|table|plain]
  bun run src/cli.ts detail <orgSlug/jobSlug|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (title, company, role). Full-text; optional.
  --location, -l <cities> City filter, comma = OR (offices.city facet). Values are
                          the site's EXACT spellings, accents included:
                          "Paris", "Aix-en-Provence", "Saint-Étienne".
  --country <codes>       ISO country code(s), e.g. --country FR (offices.country_code).
  --contract <types>      Contract type(s), comma = OR: full_time, temporary,
                          freelance, internship, apprenticeship, vie.
  --remote <mode>         fulltime | partial | punctual | no | unknown.
                          Bare --remote means fulltime (fully remote).
  --company <orgSlug>     Organization slug (from a result's org_slug).
  --jobage <days>         Posted within N days (published_at_timestamp filter).
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Results per page. Default 25.
  --filter <expr>         Raw Algolia filter expression (repeatable), e.g.
                          --filter 'sectors.parent_reference:"tech-1"' or
                          --filter "salary_yearly_minimum>=50000" (numeric
                          comparisons are routed to numericFilters).
  --format <fmt>          json (default) | table | plain.

DETAIL
  <orgSlug/jobSlug|url>   A search result's id (e.g. algolia/senior-data-engineer)
                          or a full welcometothejungle.com job URL.

EXAMPLES
  bun run src/cli.ts search -q "data engineer" -l Paris --jobage 14 --limit 10 --format table
  bun run src/cli.ts search -q "chef de projet" -l "Aix-en-Provence" --contract full_time
  bun run src/cli.ts search -q développeur --remote fulltime --format table
  bun run src/cli.ts search --company alan --format table
  bun run src/cli.ts detail skiils/ai-engineer-data-scientist-ia-generative-search-h-f --format plain

Reads are public (no account, no API key) against the ${algoliaIndex()} index.
Pagination is capped by Algolia at ~1000 reachable hits — narrow with filters
instead of paging deep.
`

function parseIntFlag(name: string, raw: string | boolean | string[]): number | null {
  const val = parseInt(raw as string, 10)
  if (isNaN(val)) {
    process.stderr.write(JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n")
    return null
  }
  return val
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    for (const name of ["jobage", "page", "limit"] as const) {
      if (flags[name] !== undefined) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }

    // --filter values are raw Algolia expressions; only emptiness is invalid.
    const rawFilters = Array.isArray(flags.filter) ? flags.filter : []
    if (rawFilters.some((f) => !f.trim())) {
      process.stderr.write(JSON.stringify({ error: "--filter requires a non-empty expression", code: "BAD_ARG" }) + "\n")
      return 1
    }

    const opts: SearchOpts = {
      query: stringFlag(flags.query),
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : 9999,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? Math.max(1, parseInt(flags.limit as string, 10)) : 25,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
      locations: commaList(flags.location),
      countries: commaList(flags.country),
      contracts: commaList(flags.contract),
      // --remote <mode> takes the given facet value; a bare --remote means fully remote.
      remote: stringFlag(flags.remote, "fulltime"),
      company: stringFlag(flags.company),
      filters: rawFilters.map((f) => f.trim()),
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires an <orgSlug/jobSlug|url>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { id, format: fmt === "plain" ? "plain" : "json" }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
