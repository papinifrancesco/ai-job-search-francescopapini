---
framework_version: 1.0.0
---

# Job Evaluation Framework

<!-- SETUP: Skill match areas and career goals are personalized by running /setup -->

## Scoring Dimensions

Evaluate each job posting against these five dimensions:

### 1. Technical Skills Match (0-100)
How well do the required/preferred skills align with the candidate's capabilities?

| Score | Meaning |
|-------|---------|
| 80-100 | Core requirements are primary skills |
| 60-79 | Most requirements match, 1-2 gaps that are learnable |
| 40-59 | Partial match, significant upskilling needed |
| 0-39 | Fundamental mismatch |

**Strong match areas:** Linux system administration (RHEL/CentOS/Oracle/Rocky), Alfresco Content Services / ECM-GED, Windows Server, Active Directory, security hardening (CIS, SELinux, GPO, TLS), vulnerability/patch management, middleware (Tomcat, Jetty, Solr, ActiveMQ, httpd, Nginx), Wireshark/network troubleshooting, technical training
**Moderate match areas:** PostgreSQL/MySQL administration, PowerShell/shell scripting, Hyper-V/VMware virtualization, Alfresco Process Services, monitoring
**Weak match areas:** Docker/Kubernetes (novice), public cloud (AWS/Azure/GCP — no professional experience), software development (operates Java platforms, is not a developer), CI/CD tooling, native-level written French

### 2. Experience Match (0-100)
Does work history align with what they're looking for?

| Score | Meaning |
|-------|---------|
| 80-100 | Direct experience in the same domain and role type |
| 60-79 | Related experience, transferable skills clear |
| 40-59 | Adjacent experience, would need to make the case |
| 0-39 | Unrelated experience |

**Strong:** senior Linux/Windows system engineering, ECM platform administration (Alfresco), embedded client-facing support in regulated environments (banking, defense clients), IT training/instruction
**Moderate:** DevOps-adjacent roles (strong ops, weak container/CI-CD side), infrastructure security roles (hardening/vuln management is proven; no SOC/pentest background), team lead (informal mentoring, no formal management title)
**Entry-level:** cloud engineering, Kubernetes platform roles, software development

### 3. Behavioral/Culture Fit (0-100)
Does the role and company culture match the behavioral profile?

| Score | Meaning |
|-------|---------|
| 80-100 | Culture strongly matches behavioral preferences |
| 60-79 | Mixed signals but mostly compatible |
| 40-59 | Some friction areas |
| 0-39 | Significant culture mismatch |

**Red flags to research:** Department disorganization, work dominated by maintenance over development, poor chemistry with leadership, culture mismatches. Check reviews, media coverage, LinkedIn connections, and network contacts for insider perspective.

### 4. Location & Logistics (Pass/Fail + Notes)
- Nice / Sophia Antipolis, or commutable Côte d'Azur: PASS
- Remote (France or cross-border, as with current TAI setup): PASS
- Requires relocation: FAIL (deal-breaker — "#notrelocating")
- Travel required (any regular travel): FAIL (deal-breaker)
- Posting explicitly requires French nationality (défense/souveraineté clauses): FAIL — Francesco holds Italian nationality only. EU-citizen-eligible postings are fine.

### 5. Career Alignment & Motivation (0-100)
Does this role advance career goals and contain tasks that energize?

| Score | Meaning |
|-------|---------|
| 80-100 | Strongly aligned with career direction, clear growth path |
| 60-79 | Good role but only partially aligned with long-term goals |
| 40-59 | Decent job but doesn't build toward career goals |
| 0-39 | Dead end or backwards step |

**Career goals:**
- A stable senior Linux system engineer or Alfresco/ECM administrator role anchored in Nice/Sophia Antipolis (or remote), replacing or improving on the current position
- Keep the security-hardening and platform-ownership profile central; no pivot into pure development or heavy travel consulting
- Continue modernizing (containers, AI-assisted operations with Claude Code) from a position of stability

**Motivation filter:** Evaluate not just whether you *can* do the tasks, but whether the tasks will *energize* you. Consider:
- Tasks that energize: no single declared passion — weight stability, autonomy, and learning opportunity over "exciting" tech (user's own words: nothing specific excites; treat inflated "passion" language in postings neutrally)
- Tasks that drain: travel (deal-breaker, scored in Location), likely also high-churn project rotation given the long-tenure history *(inferred)*
- Non-task factors: autonomy in how work is done, being trusted as the technical reference, stable long-term teams

**Life situation alignment:** Consider personal constraints:
- **Security**: employed — can afford to be selective; salary baseline 42 000 EUR/year gross (flag postings clearly below; French postings often omit salary — WTTJ carries it when published)
- **Flexibility**: remote-friendly arrangements preferred (current role is remote from Nice)
- **Professional development**: certifications matter to him — roles that fund/encourage them are a plus

### 6. Salary Benchmark (Optional)

If the salary lookup tool is configured (`salary_data.json` exists), look up the company:
```
python salary_lookup.py "<Company Name>" --json
```

If a city is known from the posting, add `--city "<City>"` to narrow results.

Present findings as:
```
### Salary Benchmark
| Metric | Value |
|--------|-------|
| [Category] index | XX.X (+/-X.X% vs baseline) |
| Overall index | XX.X (+/-X.X% vs baseline) |
```

Interpret results relative to the baseline defined in the data file's metadata. For index-based data, higher typically means above-market compensation.

If the salary tool is not configured, skip this section.

## Output Format

Present the evaluation as:

```
## Job Fit Evaluation: [Role] at [Company]

| Dimension | Score | Notes |
|-----------|-------|-------|
| Technical Skills | XX/100 | [brief note] |
| Experience Match | XX/100 | [brief note] |
| Behavioral Fit | XX/100 | [brief note] |
| Location | PASS/FAIL | [brief note] |
| Career Alignment | XX/100 | [brief note] |

**Overall Score: XX/100** (weighted average of scored dimensions)

### Verdict: [Strong Fit / Good Fit / Moderate Fit / Weak Fit / Poor Fit]

### Key Strengths for This Role
- [bullet points]

### Gaps to Address
- [bullet points]

### Recommendation
[1-2 sentences: apply/skip/apply with caveats]

### Company Research Checklist
- [ ] Checked company website (mission, values, recent news)
- [ ] Checked review sites (Glassdoor, Jobindex, etc.)
- [ ] Checked LinkedIn for team size, recent hires, connections
- [ ] Checked media for restructuring, growth, or workplace issues
- [ ] Identified network contacts who may know the team/manager
```

## Weighting
- Technical Skills: 30%
- Experience Match: 25%
- Behavioral Fit: 15%
- Career Alignment: 30%

(Location is pass/fail, not weighted)

## Thresholds
- **Strong Fit** (75+): Definitely apply, tailor everything
- **Good Fit** (60-74): Apply, address gaps in cover letter
- **Moderate Fit** (45-59): Consider carefully, discuss with user
- **Weak Fit** (30-44): Probably skip unless strategic reasons
- **Poor Fit** (<30): Skip

## Pre-Application: Call the Employer (Best Practice)

Before writing the application, consider whether the candidate should call the contact person listed in the posting. **Only call if there are substantive questions** - never call just to "be remembered."

### When to Suggest Calling
- The posting has unclear or ambiguous requirements
- It's unclear which competencies are essential vs. nice-to-have
- The role description is vague about day-to-day tasks
- There's a named contact person who invites questions

### Good Questions to Ask
- "What are the primary challenges in this role?"
- "How is time typically divided across the listed responsibilities?"
- "Which competencies are most critical for success in this position?"
- "What does success look like in the first 6-12 months?"

### Rules for the Call
- Prepare a 30-second "elevator pitch" about your background in case they ask
- The call's purpose is **gathering information**, not delivering a pitch
- Take notes - use what you learn to tailor the application
- Reference the conversation naturally in the cover letter ("After speaking with [name], I was especially drawn to...")
