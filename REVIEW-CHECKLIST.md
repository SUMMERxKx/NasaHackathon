# Review checklist for the science lead

Everything below was drafted by SI or written by a live model. Items 3 and 4 were reviewed by the EMBER team on 15 November 2026. A combustion researcher should confirm them before they are used for design. The other items have not been approved by a person. Each item says what to read, where it lives, and what to set once you agree with it.

The site is at https://ember-two-eta.vercel.app. Nothing here blocks the site from working. Until an item is approved, the About screen keeps listing it as "needs human check" or "SI drafted".

## How to record an approval

1. Edit the file named in the item.
2. If the file is in `data/manual`, run `npm run build:data` and then `npm run build:embeddings`.
3. Run `npm run ci`. It must pass.
4. Commit the edited file together with the generated files in `public/data`, and open a pull request.

A status field takes one of three values: `needs human check`, `confirmed`, or `changed`. Use `changed` when you corrected the entry.

## 1. Pinned answers for the six example chips

- **File:** `public/data/pinned-answers.json`
- **What it is:** six answers written by Claude Haiku 5.5 on the production site on 14 November 2026. Each passed the answer checker, which proves that ids and numbers match the evidence. It cannot prove that a sentence means what its source means. That part is yours.
- **What to read:** every sentence of every answer, against the evidence cards named in its `cites` list. The text of each card is in `public/data/evidence.json`, under `items`, by its id.
- **What to set when approved:** on that answer, `"reviewed": true` and a short `"reviewNote"` with your name and the date. Do this one answer at a time. Leave `"reviewed": false` on any answer you do not agree with, or delete the answer.
- **What changes:** an example question in the chat panel shows its pinned answer at once. Until then it makes a live call.

| Chip | Question | Sentences |
|---|---|---|
| `chip-1-fire-at-34` | What do we know about fire at 34 percent oxygen? | 5 |
| `chip-2-fabrics` | Which investigations tested fabrics? | 5 |
| `chip-3-carbon-dioxide` | How was carbon dioxide tested as a suppressant? | 3 |
| `chip-4-cool-flame` | What is a cool flame? | 3 |
| `chip-5-missing-for-moon` | What is missing for the Moon? | 5 |
| `chip-6-shared-hardware` | Which experiments shared hardware? | 3 |

Two sentences to look at with extra care, because each joins two facts:

- `chip-3-carbon-dioxide`, sentence 2: "Carbon dioxide was tested as a gaseous suppressant by burning droplets in atmospheres with it added, to see how well it put out the flame."
- `chip-5-missing-for-moon`, sentence 5: "The ACME E-FIELD Flames experiment used an electric field to mimic partial gravity, but its table states no oxygen value."

## 2. The evaluation answers

- **Files:** `eval-results/eval-2026-11-15-02-13.json` (first choice) and `eval-results/eval-2026-11-15-02-20-backup.json` (backup). The file names carry the time in UTC.
- **What it is:** the full text of every answer from the two evaluation runs, with the checker's verdict on each sentence. The counts are on the About screen, under Live answers, and in `src/config/evaluation.ts`. Both models answered 11 of 12 real questions and passed 5 of 5 trick questions. Claude Haiku 5.5 had 34 verified answers and GPT-6 Luna had 32.
- **What to read:** every sentence with the status `kept` in every answer with the verdict `verified`. The pass bar for the Meaning measure is that no kept sentence misstates its source.
- **What to set when approved:** in `src/config/evaluation.ts`, set `MEANING_CHECK` to a sentence that says who read the answers, when, and what was found. The About screen prints it.
- **If a kept sentence is wrong:** note the question number and the sentence. That is a finding about the checker, and the team decides whether to tighten it.

## 3. Two gates on the fireball and the Lab

- **File:** `src/three/flameParams.ts`, the object `GATES`.

| Gate | What to confirm | Where to confirm it | What to set | What changes |
|---|---|---|---|---|
| `burningRateUnitConfirmed` | The burning rate column of the FLEX table is in mm² per second. | The FLEX record PSI-69 on psi.nasa.gov and its publication. | `true` | The droplet in the Lab is animated. |
| `tadConfirmed` | The ACME column headed `Tad (K)` is the adiabatic flame temperature. | The two ACME records whose tables have that column, PSI-10 and PSI-159, and their publications. | `true` | The mark on the temperature scale moves with the habitat. |

No data rebuild is needed for these two. Run `npm run ci`.

**Done on 15 November 2026.** Both gates are `true`. Sources: NASA/TP-2015-216046, Table IX, "Burning rate, mm2/s", whose first row matches the first FLEX row. Irace and co-authors, Combustion and Flame 2021, and the CFI-G investigator thesis (Kim, University of Maryland 2022, Table E.2), whose test 21088A1 lists the same Tad as the PSI table. The Lab labels the value "calculated adiabatic flame temperature" and leaves out inverse flames and cool flames.

## 4. Assumed atmospheres

- **File:** `data/manual/atmosphere-defaults.json`, 12 entries.
- **What it is:** for each investigation whose table does not state oxygen or pressure, the value EMBER assumes, one sentence saying why and the source it was checked against. 886 tests rest on at least one of these values, and 721 of them rest on an assumed oxygen value. They are hollow on the map and count at half weight.
- **What to read:** each `reason` against the PSI record of that investigation.
- **What to set when approved:** `"status": "confirmed"` on the entry. If you correct `o2` or `pressureAtm`, set `"status": "changed"`.

| Record | Assumed oxygen | Assumed pressure | Status after the review |
|---|---|---|---|
| PSI-26 BASS | 21% | 1 atm | confirmed, with the 17 percent caveat |
| PSI-102 SAME | 21% | 1 atm | confirmed, smoke test |
| PSI-101 SAME-R | 21% | 1 atm | confirmed, nothing burned |
| PSI-47 DAFT | none, off the map | 1 atm | changed |
| PSI-107 SPICE | 21% | 1 atm | confirmed |
| PSI-106 SLICE | 21% | 1 atm | confirmed |
| PSI-98 Saffire-I | from the table | 1 atm | confirmed, 102 kPa |
| PSI-99 Saffire-II | from the table | 1 atm | confirmed, 100 to 103 kPa |
| PSI-100 Saffire-III | 21.2%, Olson Table 1 | 1 atm | changed |
| PSI-25 BASS-II | from the table | 1 atm | confirmed |
| PSI-20 ACME BRE | from the table | none, off the map | changed |
| PSI-23 ACME s-Flame | from the table | 1 atm | confirmed, helium days recorded |

**Done on 15 November 2026.** Every entry is `confirmed` or `changed`, with its source. Also applied from the same review: the two rows that record no test are dropped and listed on About, the SPICE day under SLICE is listed under "Source text kept as written", and About says that EMBER uses 21.0 percent for cabin air.

## 5. Pillars, fuel classes and hardware families

- **File:** `data/manual/pillars.json`, 24 entries under `investigations` and 6 under `hardwareFamilies`.
- **What to read:** for each investigation, its `pillar` (prevention, detection, suppression or fundamentals), `secondaryPillars`, `fuelClass` and `hardwareFamily`, against the PSI record.
- **What to set when approved:** `"status": "confirmed"` on the entry, or `"changed"` if you corrected it.
- **Why it matters:** the pillar and the fuel class are two of the four parts of the ranking, and the pillar decides which coverage bar a test counts toward.

## 6. What each investigation informs

- **File:** `data/manual/equipment.json`, 17 entries under `informs`.
- **What to read:** each entry's `tags` and its `basis` sentence, against the PSI record. The basis should be something the record itself supports.
- **What to set when approved:** `"status": "confirmed"`, or `"changed"`.

## 7. Plain summaries

- **File:** `data/manual/summaries.json`, 24 entries, three short fields each: `burned`, `varied`, `matters`.
- **What to read:** each summary against the objective, approach and research impacts of its PSI record. The trimmed records are in `data/raw/investigations`.
- **What to set when approved:** this file has no status field. Correct the text where it is wrong. Then tick the item in the sign-off table at the end of this file.

## 8. Insight card wording

- **File:** `scripts/lib/insights.mjs`. The generated cards are in `public/data/insights.json`, 12 cards, I1 to I12.
- **What it is:** the numbers are computed by the build, and four cards are computed a second time from the raw NASA files. Only the wording around the numbers is an SI draft.
- **What to read:** the `headline` and `detail` of each card. Check that the words claim no more than the number shows.
- **What to set when approved:** there is no flag. Correct the wording in `scripts/lib/insights.mjs` where needed, rebuild, and tick the item in the sign-off table.

## 9. Glossary, context cards and the Artemis quote

- **Files:** `data/manual/glossary.json` (28 terms) and `data/manual/resources.json` (6 context cards under `context`, 2 quotes under `quotes`).
- **What to read:** every sentence of the six context cards against the NASA page in its `url`: Apollo 1, Apollo 13, the fire aboard Mir, and the three spinoff cards. Each quote against its `url`, word for word. Each glossary definition against NASA's Researcher's Guide to Combustion Science, the challenge statement and the PSI records.
- **What to set when approved:** there is no flag. Correct the text where needed, rebuild, and tick the item in the sign-off table.

## 10. The Exploration atmosphere preset

- **File:** `data/manual/habitats.json`, the entries `exploration`, `mars` and `shuttle-eva`.
- **What to read:** the two NTRS reports named in the `source` field, 20130013505 and 20150021491. Confirm 34% oxygen at 8.2 psi for the Exploration atmosphere and 26.5% at 10.2 psi for Shuttle EVA preparation, and settle how the preset should be named and sourced.
- **What to set when approved:** correct `o2`, `pressurePsi` or `source` where needed, rebuild, and tick the item in the sign-off table. A change here moves the coverage scores. The tests pin the headline numbers, so a test that fails after the change names the number that moved.

## 11. Saffire-II sample thickness "037 mm"

- **Where it shows:** the Lab gravity page, samples 2-4, 2-5 and 2-6, and About, Data and methods, "Source text kept as written".
- **What it is:** NASA's SAFFIRE-2 table (PSI-99, column `Samle Thickness`) gives `037 mm` for those three samples. EMBER keeps the text as written and marks it "likely 0.37 mm, unconfirmed". The detection is `ambiguousThickness` in `src/lib/lab.ts`.
- **What to read:** the Saffire-II record PSI-99 on psi.nasa.gov and its publication, for the thickness of each of the three samples.
- **What to set when confirmed:** add a disclosed cell correction for the three rows in `scripts/lib/normalize.mjs`, the same way the ACME BRE oxygen values are corrected: keep the raw cell, flag the test, and move the row in About from "Source text kept as written" to the corrected cells. Rebuild and tick the item in the sign-off table. If the thickness is something else, record what the source says instead.

## Sign-off table

Fill in a row when the item is done. This table is the record for the items that have no flag of their own.

| Item | Read by | Date | Result |
|---|---|---|---|
| 1. Pinned answers | | | |
| 2. Evaluation answers | | | |
| 3. Two gates | The EMBER team | 15 November 2026 | Both set to true. A combustion researcher should confirm before this is used for design. |
| 4. Assumed atmospheres | The EMBER team | 15 November 2026 | All 12 confirmed or changed, every recommended option applied. A combustion researcher should confirm before this is used for design. |
| 5. Pillars | | | |
| 6. What each investigation informs | | | |
| 7. Plain summaries | | | |
| 8. Insight card wording | | | |
| 9. Glossary, context cards, quotes | | | |
| 10. Exploration atmosphere preset | | | |
| 11. Saffire-II thickness "037 mm" | | | |

## Not for the science lead

These are still open and belong to whoever submits. They are listed in `SETUP.md`, section 9: the demo path in Safari and Firefox, a check on a real phone, and a look at the key's usage on OpenRouter.
