import { describe, test, expect } from "bun:test";
import {
  buildFilters,
  cleanHtml,
  formatOffices,
  formatSalary,
  looksLikeReference,
  normalizeJobRef,
  quoteFilterValue,
  toDetail,
  toResult,
  type WttjDetailJob,
  type WttjHit,
} from "../src/helpers";
import { buildParams, type SearchOpts } from "../src/commands/search";

function hit(overrides: Partial<WttjHit> = {}): WttjHit {
  return {
    slug: "senior-data-engineer_paris",
    name: "Senior Data Engineer",
    reference: "f6750-uuid",
    organization: { name: "Algolia", slug: "algolia" },
    offices: [{ city: "Paris", country_code: "FR" }],
    published_at: "2026-07-10T08:12:00Z",
    contract_type: "full_time",
    remote: "partial",
    salary_minimum: 55000,
    salary_maximum: 70000,
    salary_period: "yearly",
    salary_currency: "EUR",
    language: "fr",
    ...overrides,
  };
}

const baseOpts: SearchOpts = {
  jobage: 9999,
  page: 1,
  limit: 25,
  format: "json",
  locations: [],
  countries: [],
  contracts: [],
  filters: [],
};

describe("toResult — reshape into the portal-skill contract", () => {
  test("composes the orgSlug/jobSlug id and the public job URL", () => {
    const r = toResult(hit());
    expect(r.id).toBe("algolia/senior-data-engineer_paris");
    expect(r.url).toBe("https://www.welcometothejungle.com/fr/companies/algolia/jobs/senior-data-engineer_paris");
  });

  test("carries the required contract fields", () => {
    const r = toResult(hit());
    expect(r).toMatchObject({
      title: "Senior Data Engineer",
      company: "Algolia",
      location: "Paris, FR",
      date: "2026-07-10T08:12:00Z",
      org_slug: "algolia",
      contract_type: "full_time",
      remote: "partial",
      salary: "EUR 55000–70000 / yearly",
    });
  });

  test("missing values are null, not omitted", () => {
    const r = toResult(
      hit({
        organization: { name: "", slug: "acme" },
        offices: [],
        published_at: null,
        contract_type: null,
        remote: undefined,
        salary_minimum: null,
        salary_maximum: null,
      }),
    );
    expect(r.company).toBeNull();
    expect(r.location).toBeNull();
    expect(r.date).toBeNull();
    expect(r.contract_type).toBeNull();
    expect(r.remote).toBeNull();
    expect(r.salary).toBeNull();
  });

  test("joins multiple offices and summarizes past three", () => {
    const offices = [
      { city: "Paris", country_code: "FR" },
      { city: "Lyon", country_code: "FR" },
      { city: "Nantes", country_code: "FR" },
      { city: "Lille", country_code: "FR" },
    ];
    expect(formatOffices(offices)).toBe("Paris, FR; Lyon, FR; Nantes, FR +1 more");
    expect(formatOffices([{ city: "Paris", country_code: "FR" }, { city: "Paris", country_code: "FR" }])).toBe(
      "Paris, FR",
    );
  });
});

describe("formatSalary", () => {
  test("formats a range with currency and period", () => {
    expect(formatSalary({ min: 50000, max: 75000, currency: "EUR", period: "yearly" })).toBe(
      "EUR 50000–75000 / yearly",
    );
  });
  test("formats a single bound", () => {
    expect(formatSalary({ min: 50000, max: null, currency: "EUR", period: null })).toBe("EUR 50000");
  });
  test("null when both bounds are absent", () => {
    expect(formatSalary({ min: null, max: null, currency: "EUR", period: "yearly" })).toBeNull();
  });
});

describe("quoteFilterValue / buildFilters — Algolia filter expressions", () => {
  test("quotes values with spaces, hyphens and accents", () => {
    expect(quoteFilterValue("Aix-en-Provence")).toBe('"Aix-en-Provence"');
    expect(quoteFilterValue("Saint-Étienne")).toBe('"Saint-Étienne"');
  });

  test("escapes embedded quotes and backslashes", () => {
    expect(quoteFilterValue('L"Oréal\\')).toBe('"L\\"Oréal\\\\"');
  });

  test("ORs within a facet group and ANDs between groups", () => {
    const expr = buildFilters([
      ["offices.city", ["Paris", "Lyon"]],
      ["contract_type", ["full_time"]],
      ["remote", []],
    ]);
    expect(expr).toBe('(offices.city:"Paris" OR offices.city:"Lyon") AND contract_type:"full_time"');
  });

  test("appends extra raw expressions parenthesized", () => {
    const expr = buildFilters([["contract_type", ["full_time"]]], ['sectors.parent_reference:"tech-1"']);
    expect(expr).toBe('contract_type:"full_time" AND (sectors.parent_reference:"tech-1")');
  });
});

describe("buildParams — Algolia query construction", () => {
  test("converts the contract's 1-indexed page to Algolia's 0-indexed page", () => {
    const p = buildParams({ ...baseOpts, page: 3 });
    expect(p.get("page")).toBe("2");
  });

  test("maps --jobage to an epoch-seconds published_at_timestamp floor", () => {
    const now = Date.UTC(2026, 6, 17); // 2026-07-17T00:00:00Z
    const p = buildParams({ ...baseOpts, jobage: 14 }, now);
    expect(p.get("numericFilters")).toBe(`published_at_timestamp>=${Math.floor(now / 1000) - 14 * 86400}`);
  });

  test("omits numericFilters when jobage is the unset sentinel", () => {
    const p = buildParams({ ...baseOpts });
    expect(p.get("numericFilters")).toBeNull();
    expect(p.get("filters")).toBeNull();
  });

  test("routes numeric --filter expressions to numericFilters, facet ones to filters", () => {
    const p = buildParams({
      ...baseOpts,
      locations: ["Paris"],
      filters: ["salary_yearly_minimum>=50000", 'sectors.parent_reference:"tech-1"'],
    });
    expect(p.get("numericFilters")).toBe("salary_yearly_minimum>=50000");
    expect(p.get("filters")).toBe('offices.city:"Paris" AND (sectors.parent_reference:"tech-1")');
  });
});

describe("normalizeJobRef", () => {
  test("accepts a bare orgSlug/jobSlug composite", () => {
    expect(normalizeJobRef("skiils/ai-engineer-h-f_paris")).toEqual({ org: "skiils", slug: "ai-engineer-h-f_paris" });
  });
  test("extracts the slugs from a full /fr/ job URL", () => {
    expect(normalizeJobRef("https://www.welcometothejungle.com/fr/companies/algolia/jobs/senior-data-engineer")).toEqual(
      { org: "algolia", slug: "senior-data-engineer" },
    );
  });
  test("tolerates other locales and query strings", () => {
    expect(normalizeJobRef("https://www.welcometothejungle.com/en/companies/alan/jobs/dev_paris?q=x#apply")).toEqual({
      org: "alan",
      slug: "dev_paris",
    });
  });
  test("rejects a single segment, garbage, and empty input", () => {
    expect(normalizeJobRef("just-one-slug")).toBeNull();
    expect(normalizeJobRef("not a job ref!")).toBeNull();
    expect(normalizeJobRef("")).toBeNull();
  });
});

describe("looksLikeReference", () => {
  test("accepts WK-style references", () => {
    expect(looksLikeReference("SKIIL_kyzZ6Qw")).toBe(true);
    expect(looksLikeReference("JOKO_K6yZbxR")).toBe(true);
  });
  test("accepts uuid references", () => {
    expect(looksLikeReference("f67501c9-8263-4329-99c6-46d2fd9710f0")).toBe(true);
  });
  test("rejects slugs, composites, and garbage", () => {
    expect(looksLikeReference("just-one-slug")).toBe(false);
    expect(looksLikeReference("skiils/ai-engineer-h-f")).toBe(false);
    expect(looksLikeReference("not a ref!")).toBe(false);
    expect(looksLikeReference("lowercase_ref")).toBe(false);
  });
});

describe("toDetail — reshape the REST detail payload", () => {
  function detailJob(overrides: Partial<WttjDetailJob> = {}): WttjDetailJob {
    return {
      name: "IA Engineer H/F",
      slug: "ia-engineer-h-f",
      description: "<p>Tu construiras des <strong>syst&egrave;mes IA</strong>.</p>",
      profile: "<p>Curieux(se) et passionn&eacute;(e).</p>",
      recruitment_process: null,
      contract_type: "full_time",
      remote: "partial",
      published_at: "2026-07-16T07:59:06Z",
      salary_min: 50000,
      salary_max: 75000,
      salary_period: "yearly",
      salary_currency: "EUR",
      education_level: "bac_5",
      experience_level: "5_TO_7_YEARS",
      apply_url: null,
      urls: [{ kind: "canonical", href: "https://www.welcometothejungle.com/fr/companies/skiils/jobs/ia-engineer-h-f" }],
      organization: { name: "skiils" },
      offices: [{ city: "Suresnes", country_code: "FR" }],
      language: "fr",
      ...overrides,
    };
  }
  const ref = { org: "skiils", slug: "ia-engineer-h-f" };

  test("takes the org slug from the ref (the payload's organization.slug is null)", () => {
    const d = toDetail(detailJob(), ref);
    expect(d.id).toBe("skiils/ia-engineer-h-f");
    expect(d.org_slug).toBe("skiils");
  });

  test("prefers the canonical URL and joins description sections with headers", () => {
    const d = toDetail(detailJob(), ref);
    expect(d.url).toBe("https://www.welcometothejungle.com/fr/companies/skiils/jobs/ia-engineer-h-f");
    expect(d.description).toBe("Tu construiras des systèmes IA.\n\nProfil recherché:\nCurieux(se) et passionné(e).");
  });

  test("maps the detail-endpoint salary field names (salary_min/salary_max)", () => {
    const d = toDetail(detailJob(), ref);
    expect(d.salary).toBe("EUR 50000–75000 / yearly");
    expect(d.education_level).toBe("bac_5");
    expect(d.experience_level).toBe("5_TO_7_YEARS");
  });

  test("falls back to the composed URL when no canonical URL is present", () => {
    const d = toDetail(detailJob({ urls: [] }), ref);
    expect(d.url).toBe("https://www.welcometothejungle.com/fr/companies/skiils/jobs/ia-engineer-h-f");
  });
});

describe("cleanHtml", () => {
  test("preserves paragraph breaks between blocks", () => {
    expect(cleanHtml("<p>One</p><p>Two</p>")).toBe("One\nTwo");
  });
  test("decodes French named and numeric entities", () => {
    expect(cleanHtml("Caf&eacute; &agrave; c&ocirc;t&eacute;")).toBe("Café à côté");
    expect(cleanHtml("Caf&#xE9; d&rsquo;&#233;t&#233;")).toBe("Café d’été");
  });
  test("returns null for empty input", () => {
    expect(cleanHtml("")).toBeNull();
    expect(cleanHtml(null)).toBeNull();
  });
});
