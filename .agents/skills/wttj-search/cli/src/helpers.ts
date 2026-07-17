// Data source: Welcome to the Jungle's public Algolia search index (the same
// one the welcometothejungle.com frontend queries — application id and
// search-only API key ship in the site's JS bundle, no account needed) plus the
// unauthenticated REST endpoint api.welcometothejungle.com for job detail.
// Every credential-ish constant is overridable by env var so a rotated public
// key is a one-line fix instead of a code change (see url-reference.md).

export const DEFAULTS = {
  appId: "CSEKHVMS53",
  apiKey: "4bd8f6215d0cc52b26430765769e65a0", // public search-only key, verified 2026-07-17
  index: "wttj_jobs_production_fr",
  apiBase: "https://api.welcometothejungle.com",
}

export const SITE_BASE = "https://www.welcometothejungle.com"

function envOr(name: string, fallback: string): string {
  const raw = (process.env[name] ?? "").trim()
  return raw || fallback
}

export function algoliaAppId(): string {
  return envOr("WTTJ_ALGOLIA_APP_ID", DEFAULTS.appId)
}
export function algoliaApiKey(): string {
  return envOr("WTTJ_ALGOLIA_API_KEY", DEFAULTS.apiKey)
}
export function algoliaIndex(): string {
  return envOr("WTTJ_ALGOLIA_INDEX", DEFAULTS.index)
}
export function apiBase(): string {
  return envOr("WTTJ_API_URL", DEFAULTS.apiBase).replace(/\/+$/, "")
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

/**
 * Fetch with the shared retry policy: 429/5xx (transient server states) retry
 * with exponential backoff + jitter; a connection failure fails fast with a
 * clear message — no retry, so an outage degrades this source quickly rather
 * than hanging the caller. Returns `null` on 404; any other non-2xx throws.
 */
async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response | null> {
  const maxRetries = 6
  let delay = 500

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetch(url, init)
    } catch (e) {
      throw new Error(`could not reach ${label} (${e instanceof Error ? e.message : String(e)})`)
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`${label} request failed: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (response.status === 401 || response.status === 403) {
      // The public search key rotated (or the app id changed). Point at the fix.
      throw new Error(
        `${label} rejected the request (${response.status}). The public Algolia key may have rotated — ` +
          `re-extract it from welcometothejungle.com (see url-reference.md) and set ` +
          `WTTJ_ALGOLIA_APP_ID / WTTJ_ALGOLIA_API_KEY.`,
      )
    }
    if (!response.ok) {
      throw new Error(`${label} request failed: ${response.status} ${response.statusText}`)
    }
    return response
  }
  // Unreachable in practice; the loop returns or throws on the last attempt.
  throw new Error(`${label} request failed after retries`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** The slice of an Algolia search response this skill reads. */
export interface AlgoliaResult {
  hits: WttjHit[]
  nbHits: number
  nbPages: number
  page: number // 0-indexed, as Algolia reports it
}

/**
 * Run one query against the jobs index via Algolia's multi-query endpoint.
 * The `content-type: application/x-www-form-urlencoded` header with a JSON
 * body is Algolia's documented client behavior — do not "fix" it.
 */
export async function algoliaSearch(params: URLSearchParams): Promise<AlgoliaResult> {
  const host = `${algoliaAppId().toLowerCase()}-dsn.algolia.net`
  const url = `https://${host}/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.20.0)%3B%20Browser`
  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "x-algolia-application-id": algoliaAppId(),
        "x-algolia-api-key": algoliaApiKey(),
        "content-type": "application/x-www-form-urlencoded",
        accept: "*/*",
        origin: SITE_BASE,
        referer: `${SITE_BASE}/`,
      },
      body: JSON.stringify({ requests: [{ indexName: algoliaIndex(), params: params.toString() }] }),
    },
    "the Welcome to the Jungle search API",
  )
  if (!response) throw new Error("the Welcome to the Jungle search API returned 404 — is WTTJ_ALGOLIA_INDEX valid?")

  const body = (await response.json().catch(() => null)) as { results?: AlgoliaResult[] } | null
  const result = body?.results?.[0]
  if (!result) throw new Error("the Welcome to the Jungle search API returned an unexpected response shape")
  return result
}

/** GET a JSON object from the WTTJ REST API; `null` on 404. */
export async function apiGet<T>(path: string): Promise<T | null> {
  const response = await fetchWithRetry(
    `${apiBase()}${path}`,
    { headers: { "User-Agent": UA, Accept: "application/json" }, redirect: "follow" },
    "the Welcome to the Jungle API",
  )
  if (!response) return null
  const body = (await response.json().catch(() => null)) as T | null
  if (!body) throw new Error("the Welcome to the Jungle API returned an unparseable response body")
  return body
}

/**
 * Quote a facet value for an Algolia `filters=` expression: always wrapped in
 * double quotes with `\` and `"` escaped, so spaces, hyphens, apostrophes and
 * accents ("Aix-en-Provence", "L'Oréal") pass through safely.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/**
 * Build an Algolia filters expression: OR within one facet's value list,
 * AND between facets, extra raw expressions ANDed on parenthesized.
 * `[["offices.city", ["Paris","Lyon"]], ["contract_type", ["full_time"]]]`
 * → `(offices.city:"Paris" OR offices.city:"Lyon") AND contract_type:"full_time"`
 */
export function buildFilters(groups: Array<[facet: string, values: string[]]>, extra: string[] = []): string {
  const clauses: string[] = []
  for (const [facet, values] of groups) {
    if (values.length === 0) continue
    const terms = values.map((v) => `${facet}:${quoteFilterValue(v)}`)
    clauses.push(terms.length === 1 ? terms[0] : `(${terms.join(" OR ")})`)
  }
  for (const expr of extra) clauses.push(`(${expr})`)
  return clauses.join(" AND ")
}

/** A parsed job reference: the two slugs the detail endpoint needs. */
export interface JobRef {
  org: string
  slug: string
}

/**
 * Parse a job reference from a composite `orgSlug/jobSlug` id (a search
 * result's `id`) or any full WTTJ job URL (any locale prefix, query strings
 * and fragments tolerated). Returns `null` for anything else.
 */
export function normalizeJobRef(input: string): JobRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const fromUrl = trimmed.match(/\/companies\/([^/?#]+)\/jobs\/([^/?#]+)/)
  if (fromUrl) return { org: fromUrl[1], slug: fromUrl[2] }
  const bare = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/)
  if (bare) return { org: bare[1], slug: bare[2] }
  return null
}

/** An office as both the search index and the detail endpoint shape it. */
export interface WttjOffice {
  city?: string | null
  country_code?: string | null
}

/** A jobs-index hit — the fields this skill reads (the wire shape carries more). */
export interface WttjHit {
  slug: string
  name: string
  reference?: string | null
  organization: { name?: string | null; slug?: string | null }
  offices?: WttjOffice[]
  published_at?: string | null
  contract_type?: string | null
  remote?: string | null
  salary_minimum?: number | null
  salary_maximum?: number | null
  salary_period?: string | null
  salary_currency?: string | null
  language?: string | null
}

/**
 * A search result in the portal-skill contract shape. `id` is the composite
 * `orgSlug/jobSlug` (what `detail` consumes); missing values are `null`,
 * never omitted. The extra fields are a permitted superset.
 */
export interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  org_slug: string | null
  contract_type: string | null
  remote: string | null
  salary: string | null
  language: string | null
}

/** A job detail: the search-result fields plus description and detail extras. */
export interface JobDetailResult extends JobResult {
  education_level: string | null
  experience_level: string | null
  apply_url: string | null
  offices: string[]
  description: string | null
}

/**
 * One office as display text: "City, CC" (or just the city when the country
 * code is absent). Used for both the location summary and the detail list.
 */
function formatOffice(office: WttjOffice): string | null {
  if (!office.city) return null
  return office.country_code ? `${office.city}, ${office.country_code}` : office.city
}

/**
 * A lossy one-line location summary: up to three distinct offices joined with
 * "; ", then "+N more". `null` when no office carries a city.
 */
export function formatOffices(offices: WttjOffice[] | undefined): string | null {
  const cities = [...new Set((offices ?? []).map(formatOffice).filter((c): c is string => c !== null))]
  if (cities.length === 0) return null
  const shown = cities.slice(0, 3).join("; ")
  return cities.length > 3 ? `${shown} +${cities.length - 3} more` : shown
}

/** Human-readable salary line, e.g. "EUR 50000–75000 / yearly"; null when unbounded. */
export function formatSalary(fields: {
  min?: number | null
  max?: number | null
  currency?: string | null
  period?: string | null
}): string | null {
  const { min, max, currency, period } = fields
  if (min == null && max == null) return null
  const cur = currency ? `${currency} ` : ""
  const range = min != null && max != null ? `${min}–${max}` : `${min ?? max}`
  return period ? `${cur}${range} / ${period}` : `${cur}${range}`
}

/** The canonical public job page for a posting. */
export function jobUrl(orgSlug: string, jobSlug: string): string {
  return `${SITE_BASE}/fr/companies/${orgSlug}/jobs/${jobSlug}`
}

/** Reshape an Algolia hit into the contract search-result fields. */
export function toResult(hit: WttjHit): JobResult {
  const orgSlug = hit.organization?.slug || null
  return {
    id: orgSlug ? `${orgSlug}/${hit.slug}` : hit.slug,
    title: hit.name || "(untitled)",
    company: hit.organization?.name || null,
    location: formatOffices(hit.offices),
    date: hit.published_at || null,
    url: orgSlug ? jobUrl(orgSlug, hit.slug) : `${SITE_BASE}/fr/jobs/${hit.slug}`,
    org_slug: orgSlug,
    contract_type: hit.contract_type || null,
    remote: hit.remote || null,
    salary: formatSalary({
      min: hit.salary_minimum,
      max: hit.salary_maximum,
      currency: hit.salary_currency,
      period: hit.salary_period,
    }),
    language: hit.language || null,
  }
}

/**
 * The detail endpoint's job payload — the fields this skill reads. Note the
 * naming drift vs the search index: `salary_min`/`salary_max` (not
 * `salary_minimum`), `experience_level`, and `organization.slug` is null here
 * (the org slug travels in the request path, not the payload).
 */
export interface WttjDetailJob {
  name: string
  slug: string
  description?: string | null
  profile?: string | null
  recruitment_process?: string | null
  contract_type?: string | null
  remote?: string | null
  published_at?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_period?: string | null
  salary_currency?: string | null
  education_level?: string | null
  experience_level?: string | null
  apply_url?: string | null
  urls?: Array<{ kind?: string; href?: string }>
  organization?: { name?: string | null }
  offices?: WttjOffice[]
  language?: string | null
}

/**
 * Reshape a detail payload. `ref` supplies the org slug (absent from the
 * payload); the description joins the posting's three HTML sections into
 * readable text.
 */
export function toDetail(job: WttjDetailJob, ref: JobRef): JobDetailResult {
  const canonical = job.urls?.find((u) => u.kind === "canonical")?.href
  const sections = [
    cleanHtml(job.description),
    withHeader("Profil recherché", cleanHtml(job.profile)),
    withHeader("Processus de recrutement", cleanHtml(job.recruitment_process)),
  ].filter((s): s is string => s !== null)

  return {
    id: `${ref.org}/${job.slug || ref.slug}`,
    title: job.name || "(untitled)",
    company: job.organization?.name || null,
    location: formatOffices(job.offices),
    date: job.published_at || null,
    url: canonical || jobUrl(ref.org, job.slug || ref.slug),
    org_slug: ref.org,
    contract_type: job.contract_type || null,
    remote: job.remote || null,
    salary: formatSalary({
      min: job.salary_min,
      max: job.salary_max,
      currency: job.salary_currency,
      period: job.salary_period,
    }),
    language: job.language || null,
    education_level: job.education_level || null,
    experience_level: job.experience_level || null,
    apply_url: job.apply_url || null,
    offices: (job.offices ?? []).map(formatOffice).filter((c): c is string => c !== null),
    description: sections.length ? sections.join("\n\n") : null,
  }
}

function withHeader(header: string, text: string | null): string | null {
  return text ? `${header}:\n${text}` : null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  // French text is full of these; the numeric-entity path covers the rest.
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&eacute;": "é",
  "&egrave;": "è",
  "&ecirc;": "ê",
  "&euml;": "ë",
  "&agrave;": "à",
  "&acirc;": "â",
  "&ccedil;": "ç",
  "&ocirc;": "ô",
  "&icirc;": "î",
  "&iuml;": "ï",
  "&ucirc;": "û",
  "&ugrave;": "ù",
  "&oelig;": "œ",
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&[a-zA-Z]+;|&#39;/g, (entity) => NAMED_ENTITIES[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
}

/**
 * Strip a WTTJ description's HTML into readable prose: block/line-break tags
 * become newlines, entities are decoded, tags removed. Null for empty input.
 */
export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    // Inline tags leave a stray space before sentence punctuation ("IA .");
    // French spacing before :;!? is left alone.
    .replace(/ +([.,])/g, "$1")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}
