import { afterEach, describe, expect, test } from "bun:test";
import { runSearch, type SearchOpts } from "../src/commands/search";
import { runDetail } from "../src/commands/detail";
import type { WttjDetailJob, WttjHit } from "../src/helpers";

const originalFetch = globalThis.fetch;
const originalStdoutWrite = process.stdout.write;

function captureStdout(): { get: () => string } {
  let buf = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    buf += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  return { get: () => buf };
}

function captureStderr(): { get: () => string; restore: () => void } {
  let buf = "";
  const orig = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    buf += chunk.toString();
    return true;
  }) as typeof process.stderr.write;
  return { get: () => buf, restore: () => (process.stderr.write = orig) };
}

function mockFetch(status: number, body: unknown): void {
  globalThis.fetch = (async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function hit(overrides: Partial<WttjHit> = {}): WttjHit {
  return {
    slug: "senior-data-engineer_paris",
    name: "Senior Data Engineer",
    organization: { name: "Algolia", slug: "algolia" },
    offices: [{ city: "Paris", country_code: "FR" }],
    published_at: "2026-07-10T08:12:00Z",
    contract_type: "full_time",
    remote: "partial",
    language: "fr",
    ...overrides,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.stdout.write = originalStdoutWrite;
});

const searchOpts: SearchOpts = {
  jobage: 9999,
  page: 1,
  limit: 25,
  format: "json",
  locations: [],
  countries: [],
  contracts: [],
  filters: [],
};

describe("runSearch (mocked fetch)", () => {
  test("emits the contract envelope with a 1-indexed meta.page", async () => {
    // Algolia reports page 0; the contract's meta must echo the user's page 1.
    mockFetch(200, { results: [{ hits: [hit()], nbHits: 42, nbPages: 2, page: 0 }] });
    const out = captureStdout();

    const code = await runSearch({ ...searchOpts, query: "data engineer" });
    expect(code).toBe(0);

    const parsed = JSON.parse(out.get());
    expect(parsed.meta).toEqual({ count: 1, page: 1, total: 42, total_pages: 2 });
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].id).toBe("algolia/senior-data-engineer_paris");
    expect(parsed.results[0].date).toBe("2026-07-10T08:12:00Z");
    expect(parsed.results[0].url).toBe(
      "https://www.welcometothejungle.com/fr/companies/algolia/jobs/senior-data-engineer_paris",
    );
  });

  test("empty result set yields an empty results array", async () => {
    mockFetch(200, { results: [{ hits: [], nbHits: 0, nbPages: 0, page: 0 }] });
    const out = captureStdout();

    const code = await runSearch({ ...searchOpts, query: "nothing-matches-xyz" });
    expect(code).toBe(0);
    expect(JSON.parse(out.get()).results).toHaveLength(0);
  });

  test("network failure exits 1 with SEARCH_FAILED", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const err = captureStderr();

    const code = await runSearch({ ...searchOpts, query: "data" });
    err.restore();

    expect(code).toBe(1);
    expect(JSON.parse(err.get()).code).toBe("SEARCH_FAILED");
  });

  test("a rotated key (403) fails with a hint at the env overrides", async () => {
    mockFetch(403, { message: "Invalid Application-ID or API key" });
    const err = captureStderr();

    const code = await runSearch({ ...searchOpts, query: "data" });
    err.restore();

    expect(code).toBe(1);
    const parsed = JSON.parse(err.get());
    expect(parsed.code).toBe("SEARCH_FAILED");
    expect(parsed.error).toMatch(/WTTJ_ALGOLIA_API_KEY/);
  });
});

describe("runDetail (mocked fetch)", () => {
  const detailJob: WttjDetailJob = {
    name: "IA Engineer H/F",
    slug: "ia-engineer-h-f",
    description: "<p>Construire des choses</p>",
    contract_type: "full_time",
    remote: "partial",
    published_at: "2026-07-16T07:59:06Z",
    organization: { name: "skiils" },
    offices: [{ city: "Suresnes", country_code: "FR" }],
    urls: [{ kind: "canonical", href: "https://www.welcometothejungle.com/fr/companies/skiils/jobs/ia-engineer-h-f" }],
  };

  test("prints the reshaped detail with a cleaned description", async () => {
    mockFetch(200, { job: detailJob });
    const out = captureStdout();

    const code = await runDetail({ id: "skiils/ia-engineer-h-f", format: "json" });
    expect(code).toBe(0);

    const parsed = JSON.parse(out.get());
    expect(parsed.id).toBe("skiils/ia-engineer-h-f");
    expect(parsed.description).toBe("Construire des choses");
    expect(parsed.offices).toEqual(["Suresnes, FR"]);
  });

  test("accepts a full job URL as the reference", async () => {
    mockFetch(200, { job: detailJob });
    const out = captureStdout();

    const code = await runDetail({
      id: "https://www.welcometothejungle.com/fr/companies/skiils/jobs/ia-engineer-h-f",
      format: "json",
    });
    expect(code).toBe(0);
    expect(JSON.parse(out.get()).org_slug).toBe("skiils");
  });

  test("404 exits 1 with NOT_FOUND", async () => {
    mockFetch(404, { error: "not found" });
    const err = captureStderr();

    const code = await runDetail({ id: "acme/does-not-exist", format: "json" });
    err.restore();

    expect(code).toBe(1);
    expect(JSON.parse(err.get()).code).toBe("NOT_FOUND");
  });
});
