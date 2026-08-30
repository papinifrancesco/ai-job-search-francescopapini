# Search Queries for Job Scraper

Personalized for Francesco Papini (Nice, France) - senior Linux system engineer /
Alfresco-ECM administrator. CV language: French; postings are mostly French.

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first.
Active portals for this fork:

- **wttj-search** (Welcome to the Jungle, FR) - the primary French board. Use exact accented
  city spellings. **Always add `--country FR` on remote queries** (the index carries non-FR
  offices). Salary is shown when published - compare against the 42k EUR baseline.
- **linkedin-search** - country-agnostic, filter to France / Nice area.
- **freehire-search** - country-agnostic.
- Danish demo portals (jobbank/jobdanmark/jobindex/jobnet) are installed but `enabled: false`.

The `site:` query templates below are the **WebSearch fallback** - for boards without a CLI
(APEC, Indeed France) or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

Primary (CLIs): Welcome to the Jungle, LinkedIn.
Fallback (WebSearch):
- **apec.fr** - the French cadres board; strong for ingénieur système roles
- **fr.indeed.com** - volume aggregator
- Company career pages of Sophia Antipolis employers via `site:` searches

## Query Categories

Combine every query with the location tiers below. Portal flags: `--jobage 14`, `--limit 20`.

**Organize by function, not job title.** The same underlying work carries different titles across companies and markets (an "Ingénieur Système Linux" role at one employer may be posted as "Administrateur Systèmes" or "SysOps" at another). Name each priority category after the function it covers, and list several plausible job titles as query variants within that category rather than betting an entire priority tier on one exact title string.

### Priority 1: Ingénieur Système Linux

The primary target role.

WTTJ CLI:
```
search -q "ingénieur système linux" -l "Nice,Sophia Antipolis" --jobage 14
search -q "administrateur système linux" -l "Nice,Sophia Antipolis,Antibes,Valbonne,Biot" --jobage 14
search -q "ingénieur système linux" --remote fulltime --country FR --jobage 14
```
WebSearch fallback:
```
site:apec.fr "ingénieur système linux" Nice OR "Sophia Antipolis"
site:fr.indeed.com "administrateur système" linux Nice
site:linkedin.com/jobs "ingénieur système linux" France Nice
```

### Priority 2: Alfresco / ECM / GED Administrator

The differentiating specialty - lower volume, much higher fit. Run without a location
filter first (Alfresco roles are rare; remote is plausible), then filter by location tier.

WTTJ CLI:
```
search -q "alfresco" --country FR --jobage 14
search -q "administrateur GED" --country FR --jobage 14
search -q "ECM gestion documentaire" --country FR --jobage 14
```
WebSearch fallback:
```
site:apec.fr alfresco OR "GED" administrateur
site:fr.indeed.com alfresco administrateur France
```

### Priority 3: Adjacent - Windows/AD, sécurité opérationnelle, DevOps-ops

Roles the 25-year profile could pivot into without container/cloud depth.

WTTJ CLI:
```
search -q "ingénieur systèmes et réseaux" -l "Nice,Sophia Antipolis" --jobage 14
search -q "administrateur windows active directory" -l "Nice,Sophia Antipolis" --jobage 14
search -q "sécurité systèmes durcissement" --country FR --jobage 14
```

### Priority 4: Broader - formation technique, support N3

Wider net; includes the teaching thread.

WTTJ CLI:
```
search -q "formateur technique informatique" -l "Nice,Sophia Antipolis" --jobage 14
search -q "support niveau 3 linux" --country FR --remote fulltime --jobage 14
```

## Location Filter

- **Ideal:** Nice, Sophia Antipolis (incl. Valbonne, Biot)
- **Acceptable:** commutable Côte d'Azur - Antibes, Cagnes-sur-Mer, Villeneuve-Loubet, Cannes, Monaco
- **Acceptable:** full remote (France or cross-border, as with the current Italian employer)
- **Too far / FAIL:** anything requiring relocation; any role with regular travel

WTTJ's `offices.city` facet needs the site's exact spellings (accents included); Sophia
Antipolis companies often list their office as Valbonne, Biot, or Antibes - include those
spellings when filtering by city.

## Hard Filters (apply when triaging results)

- **Nationality:** skip postings explicitly requiring French nationality (défense /
  souveraineté / habilitation Secret Défense clauses) - Francesco holds Italian nationality
  only. EU-citizen-eligible postings are fine.
- **Travel:** skip roles with regular travel ("déplacements fréquents").
- **Salary:** baseline 42 000 EUR/year gross - flag postings clearly below when salary is published.

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has
not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area (e.g. `/scrape alfresco`, `/scrape sécurité`), run that
category's queries plus 2-3 custom variations for the focus.
