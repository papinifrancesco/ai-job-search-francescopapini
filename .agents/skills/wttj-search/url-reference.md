# Welcome to the Jungle API reference

The endpoints, parameters, and response shapes this skill depends on. This is
the file to update if WTTJ's frontend infrastructure changes. All values were
**verified live on 2026-07-17**.

## Authentication

None. The Algolia application id and search-only API key are public — they ship
in welcometothejungle.com's JS bundle and authorize read-only search, exactly as
the site's own frontend uses them. The REST detail endpoint is unauthenticated.

## Search — Algolia multi-query endpoint

```
POST https://csekhvms53-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.20.0)%3B%20Browser
```

Headers:

```
x-algolia-application-id: CSEKHVMS53
x-algolia-api-key: 4bd8f6215d0cc52b26430765769e65a0
content-type: application/x-www-form-urlencoded
origin: https://www.welcometothejungle.com
referer: https://www.welcometothejungle.com/
```

> The `content-type` header "lies": the body is JSON. That is Algolia's own
> client behavior — keep it exactly as is, do not "fix" it to `application/json`.

Body: `{"requests":[{"indexName":"wttj_jobs_production_fr","params":"<url-encoded param string>"}]}`

The response is `{ "results": [ { hits, nbHits, nbPages, page, ... } ] }` —
one entry per request. Algolia's `page` is **0-indexed**; the CLI converts from
the contract's 1-indexed `--page`. Deep paging is capped (`paginationLimitedTo`
≈ 1000 reachable hits); `nbHits` still reports the true count.

### Params used by the skill

| Param | Maps to CLI flag | Notes |
|-------|------------------|-------|
| `query` | `--query` / `-q` | Keyword full-text query. |
| `hitsPerPage` | `--limit` / `-n` | Page size. Default 25 in the CLI. |
| `page` | `--page` (minus 1) | 0-indexed. |
| `filters` | `-l`, `--country`, `--contract`, `--remote`, `--company`, facet `--filter`s | Boolean facet expression; values always double-quoted (`offices.city:"Aix-en-Provence"`), OR within a facet, AND between facets. |
| `numericFilters` | `--jobage`, numeric `--filter`s | `published_at_timestamp>=<epoch seconds>`; comma = AND. |
| `attributesToRetrieve` | (fixed) | Trimmed to the fields `toResult` reads. |

### Facets (confirmed live via `facets=["*"]`)

`offices.city`, `offices.country_code`, `contract_type`, `remote`,
`organization.slug`, `organization.name`, `sectors.reference`,
`sectors.parent_reference`, `language`, `salary_yearly_minimum`,
`experience_level_minimum`, `education_level`, `benefits`,
`new_profession.category_reference`, …

Vocabularies:
- `remote`: `fulltime` | `partial` | `punctual` | `no` | `unknown`
- `contract_type`: `full_time`, `temporary`, `freelance`, `internship`, `apprenticeship`, `vie`
- `offices.city`: the site's exact display spellings, accents included

### Hit object (fields the skill reads → result fields)

| Hit field | Result field |
|-----------|--------------|
| `organization.slug` + `slug` | `id` (`orgSlug/jobSlug`), `url` |
| `name` | `title` |
| `organization.name` | `company` |
| `offices[].city` + `country_code` | `location` (≤3 joined, `+N more`) |
| `published_at` (ISO; `published_at_timestamp` epoch **seconds**) | `date` |
| `contract_type`, `remote`, `language` | same names |
| `salary_minimum`/`salary_maximum`/`salary_currency`/`salary_period` | `salary` (formatted) |

## Detail — REST endpoint

```
GET https://api.welcometothejungle.com/api/v1/organizations/{orgSlug}/jobs/{jobSlug}
```

Returns `{ "job": { ... } }`; a missing posting is a plain 404 (→ `NOT_FOUND`
on stderr). **Field-name drift vs the search index**: the detail payload uses
`salary_min`/`salary_max` (not `salary_minimum`) and `experience_level` (not
`experience_level_minimum`), and its `organization.slug` is `null` — the org
slug travels in the request path, which is why `detail` needs the composite
`orgSlug/jobSlug` reference. Description content is split across three HTML
fields — `description`, `profile`, `recruitment_process` — which the CLI cleans
and joins. `urls[]` carries the canonical job-page URL; `apply_url` is the
direct ATS link when present.

## Job page URL pattern

```
https://www.welcometothejungle.com/fr/companies/{orgSlug}/jobs/{jobSlug}
```

`detail` accepts this URL in any locale (`/fr/`, `/en/`, …) as input.

## If the public key rotates

Searches will fail with a 403 and an error message naming the env vars. To fix:

1. Open https://www.welcometothejungle.com/fr/jobs in a browser with DevTools → Network.
2. Type any search; filter requests by `algolia`.
3. Copy the `x-algolia-application-id` and `x-algolia-api-key` request headers
   and the `indexName` from the request body.
4. Export them: `WTTJ_ALGOLIA_APP_ID`, `WTTJ_ALGOLIA_API_KEY`,
   `WTTJ_ALGOLIA_INDEX` (and `WTTJ_API_URL` if the REST host ever moves).
5. Update the defaults in `cli/src/helpers.ts` and this file when convenient.

## robots.txt / usage posture

`www.welcometothejungle.com/robots.txt` disallows crawling query-string URLs of
the **site**; this skill does not fetch site pages at all — it queries the
Algolia DSN host and `api.welcometothejungle.com` (no robots restrictions),
the same channels the site's own frontend uses. WTTJ publishes no official
public API, so this is an unofficial, personal-use integration: low volume,
no bulk harvesting, no redistribution. Tests never hit the live services
(mocked fetch / offline validation only).
