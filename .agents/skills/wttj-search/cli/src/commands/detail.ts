import { apiGet, normalizeJobRef, toDetail, writeError, type JobDetailResult, type WttjDetailJob } from "../helpers.js"

export interface DetailOpts {
  id: string // an orgSlug/jobSlug composite (a search result's id) or a full WTTJ job URL
  format: "json" | "plain"
}

/** A human-readable rendering of one job: header, present fields, description. */
function renderPlain(job: JobDetailResult): string {
  const lines = [job.title, `${job.company ?? "—"} · ${job.location ?? "—"}`]

  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  field("Posted", job.date && job.date.slice(0, 10))
  field("Contract", job.contract_type)
  field("Remote", job.remote)
  field("Salary", job.salary)
  field("Education", job.education_level)
  field("Experience", job.experience_level)
  field("Offices", job.offices.length ? job.offices.join("; ") : null)

  lines.push("", job.description ?? "(no description)", "", `URL: ${job.url}`)
  if (job.apply_url) lines.push(`Apply: ${job.apply_url}`)
  lines.push(`id: ${job.id}`)
  return lines.join("\n")
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const ref = normalizeJobRef(opts.id)
  if (!ref) {
    writeError(
      `could not parse a job reference from "${opts.id}" — expected orgSlug/jobSlug or a full WTTJ job URL`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const body = await apiGet<{ job: WttjDetailJob }>(
      `/api/v1/organizations/${encodeURIComponent(ref.org)}/jobs/${encodeURIComponent(ref.slug)}`,
    )
    if (!body?.job) {
      writeError("job not found", "NOT_FOUND")
      return 1
    }
    const job = toDetail(body.job, ref)

    if (opts.format === "plain") {
      process.stdout.write(renderPlain(job) + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
