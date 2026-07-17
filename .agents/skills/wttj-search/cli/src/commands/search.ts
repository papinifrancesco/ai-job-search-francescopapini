import { algoliaSearch, buildFilters, toResult, writeError, type JobResult } from "../helpers.js"

export interface SearchOpts {
  query?: string
  jobage: number
  page: number // 1-indexed (the portal-skill contract)
  limit: number
  format: "json" | "table" | "plain"
  // Facet filters (already parsed into value lists; empty means unset).
  locations: string[] // offices.city — exact facet spellings, accents included
  countries: string[] // offices.country_code
  contracts: string[] // contract_type
  remote?: string // remote facet: fulltime | partial | punctual | no | unknown
  company?: string // organization.slug
  // Raw Algolia filter expressions (--filter), the escape hatch for the long tail.
  filters: string[]
}

// Keep the payload to what toResult reads; "organization" comes whole because
// attributesToRetrieve selects top-level attributes.
const RETRIEVED_ATTRIBUTES = [
  "slug",
  "name",
  "reference",
  "organization",
  "offices",
  "published_at",
  "contract_type",
  "remote",
  "salary_minimum",
  "salary_maximum",
  "salary_period",
  "salary_currency",
  "language",
].join(",")

/** A raw --filter expression that is a numeric comparison belongs in numericFilters. */
function isNumericExpression(expr: string): boolean {
  return /[<>]/.test(expr) || /^[\w.]+\s*=\s*[\d.]+$/.test(expr.trim())
}

export function buildParams(opts: SearchOpts, nowMs: number = Date.now()): URLSearchParams {
  const p = new URLSearchParams()
  p.set("query", opts.query ?? "")
  p.set("hitsPerPage", String(opts.limit))
  // The contract's pages are 1-indexed; Algolia's are 0-indexed. Converted here only.
  p.set("page", String(opts.page - 1))
  p.set("attributesToRetrieve", RETRIEVED_ATTRIBUTES)

  const extraFacet = opts.filters.filter((f) => !isNumericExpression(f))
  const numeric = opts.filters.filter(isNumericExpression).map((f) => f.trim())

  const filters = buildFilters(
    [
      ["offices.city", opts.locations],
      ["offices.country_code", opts.countries],
      ["contract_type", opts.contracts],
      ["remote", opts.remote ? [opts.remote] : []],
      ["organization.slug", opts.company ? [opts.company] : []],
    ],
    extraFacet,
  )
  if (filters) p.set("filters", filters)

  if (opts.jobage > 0 && opts.jobage < 9999) {
    const cutoff = Math.floor(nowMs / 1000) - opts.jobage * 86400
    numeric.push(`published_at_timestamp>=${cutoff}`)
  }
  if (numeric.length) p.set("numericFilters", numeric.join(","))

  return p
}

/** The date portion (YYYY-MM-DD) of an ISO timestamp, or "—" when absent. */
function shortDate(date: string | null): string {
  return date ? date.slice(0, 10) : "—"
}

// Table columns: header, width, and the cell value. The ID column is sized to
// the longest id so it is never truncated — a cut id can't be looked up in
// `detail`; the fixed-width columns truncate for scanning.
interface Column {
  header: string
  width: number
  cell: (r: JobResult) => string
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const columns: Column[] = [
    { header: "ID", width: Math.max(2, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
    { header: "TITLE", width: 38, cell: (r) => r.title },
    { header: "COMPANY", width: 22, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 20, cell: (r) => r.location ?? "—" },
    { header: "CONTRACT", width: 10, cell: (r) => r.contract_type ?? "—" },
    { header: "DATE", width: 10, cell: (r) => shortDate(r.date) },
  ]
  const row = (cells: string[]) => cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ")

  const header = row(columns.map((c) => c.header))
  const body = rows.map((r) => row(columns.map((c) => c.cell(r))))
  return [header, "-".repeat(header.length), ...body].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const block = (r: JobResult) =>
    [
      r.title,
      `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${shortDate(r.date)}`,
      `  id: ${r.id}`,
      `  ${r.url}`,
    ].join("\n")
  return rows.map(block).join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const result = await algoliaSearch(buildParams(opts))
    const rows = result.hits.map(toResult)

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            // meta.page echoes the contract's 1-indexed page, not Algolia's 0-indexed one.
            meta: { count: rows.length, page: opts.page, total: result.nbHits, total_pages: result.nbPages },
            results: rows,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
