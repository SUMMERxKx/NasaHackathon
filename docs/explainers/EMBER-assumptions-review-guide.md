d# EMBER assumed values: a review guide

This guide is for the person who signs off EMBER's assumed atmosphere values. It assumes you know full-stack web work and nothing about combustion, NASA hardware or this data.

- **Live site:** https://ember-two-eta.vercel.app
- **Code:** the `flame-in-freefall` repo at `main`, commit `073d369`. The live site serves the same data build (`14278e63`).
- **Every count** below was recounted from `public/data/snapshot.json` at that commit on 15 November 2026.
- **The checks behind it:** an independent check by Claude Opus (finished, summarised here) and a second one by Codex Astra (not finished yet, so each section has an empty "Astra check" slot).
- **Time needed:** about 10 minutes for Part 1, then a few minutes per section. If you trust the recommendations, you can go straight to the decision sheet at the end and reply in one message.

## Contents

1. [Part 1. The context](#part-1-the-context)
2. [Part 2. How to review](#part-2-how-to-review)
3. [Part 3. The 12 assumptions and 2 flame gates](#part-3-the-12-assumptions-and-2-flame-gates)
4. [Part 4. Other hidden issues](#part-4-other-hidden-issues)
5. [Decision sheet](#decision-sheet)

---

## Part 1. The context

### NASA PSI, in database terms

PSI (Physical Sciences Informatics, https://psi.nasa.gov) is NASA's public library of physical science experiments, most of them flown on the International Space Station (ISS).

- **An investigation** is one experiment campaign, such as FLEX or BASS. It has a record with a primary key like `PSI-26` (called the accession). The record holds text fields (objective, approach, hardware), a list of published papers and some attached data files.
- **An experimental table** is a CSV summary attached to the record. One investigation can have zero, one or several tables.
- **A test** is one row of a table: one burn, one sample or one test day. EMBER splits a row that lists several oxygen levels into one test per level. For example, an ACME BRE row that says "21, 26.5 and 40" becomes three tests.
- **EMBER's copy:** 24 combustion investigations, 22 tables, 2,009 table rows, 2,031 tests. The raw records are in `data/raw/investigations/PSI-NN.json` and the raw tables in `data/raw/tables/`. The build turns them into one file, `public/data/snapshot.json`, which the site loads.

The tables were written by each science team for its own use. Columns, units and notes differ from table to table, and some columns are missing.

### The ISS hardware, one line each

- **Microgravity Science Glovebox (MSG):** a sealed box with glove ports, built into a station rack. Experiments run inside it in station cabin air, held at slightly lower pressure than the cabin so smoke cannot leak out. BASS, BASS-II, SPICE, SLICE, SAME and SAME-R ran here.
- **Combustion Integrated Rack (CIR) and its chamber:** a rack with a sealed steel combustion chamber of about 90 to 100 litres. For each test the crew fill it with a chosen gas mix at a chosen pressure, then vent it. The ACME gas flame experiments (BRE, s-Flame, Flame Design, CFI-G) and FLEX droplets ran here. Because the gas is chosen per test, a CIR test is never safely "just cabin air".
- **Cygnus:** an uncrewed cargo spacecraft. After it leaves the ISS, the Saffire experiments burned large fabric samples inside its cabin, which was filled with station air when the hatch closed. Then Cygnus burned up on re-entry.
- **EXPRESS rack:** a general purpose rack in the open cabin. DAFT was mounted on the front of one.

### Why oxygen and pressure matter for fire

A fire needs fuel, heat and oxygen. Two numbers describe the "air" a fire sees:

- **Oxygen fraction:** what share of the gas is oxygen. Normal air is about 21%. A higher share makes materials catch fire more easily, burn hotter and spread faster.
- **Total pressure:** how much gas there is. Sea level and the ISS are about 14.7 psi, also written 1 atm, 101.3 kPa or 1.013 bar.

Future Moon and Mars habitats plan to lower the pressure and raise the oxygen share, so astronauts can start spacewalks faster while breathing the same amount of oxygen. NASA's "exploration atmosphere" is 34% oxygen at 8.2 psi. A spacesuit prep atmosphere is 26.5% at 10.2 psi. The worry is that air richer in oxygen burns more fiercely, and few fire tests were run in it. That gap is what the NASA Space Apps challenge asks about.

Unit cheat sheet for this guide:

| Written as | In atm | In psi |
|---|---|---|
| 1 atm, 101.3 kPa, 1.013 bar | 1.0 | 14.7 |
| 0.7 bar | 0.69 | 10.2 |
| 0.565 bar | 0.56 | 8.2 |
| 99 kPa | 0.98 | 14.4 |

EMBER stores oxygen as a fraction (0.21) and pressure in atm (1.0). The site shows percent and psi.

### What EMBER does with each test

Think of every test as a row with two coordinates, `o2` and `pressureAtm`.

1. **The map** (Dashboard) is a scatter plot: oxygen up the side, pressure along the bottom. Each test is a mark.
2. **A habitat** is a point on that map, such as the ISS cabin (21%, 14.7 psi) or the Exploration atmosphere (34%, 8.2 psi).
3. **Nearby:** EMBER measures the distance from each test to the habitat. One unit is 4 oxygen points or about 25% in pressure. A test within one unit is "nearby", and the site counts nearby tests by fuel type.
4. **Coverage:** a 0 to 100 score that adds up the nearby tests, closer ones counting more. It measures how much evidence exists in similar air, not how safe that air is.

The full maths is in `EMBER-calculations-explained.md`, in the same folder as this guide.

### Why some tables lack oxygen or pressure

When every test ran in the station's normal air, the science team often left that column out because it never changed. When the gas was changed per test (the CIR chamber), the table usually lists it, but not always. The ACME BRE table lists oxygen and says in its own note that pressure varied but is not given.

### What an "assumed value" is

It is a default value filled in when a column is null. The defaults live in one lookup file, keyed by investigation: `data/manual/atmosphere-defaults.json`. The build step (`scripts/lib/normalize.mjs:464-473`) does this for each test:

```
if test.o2 is null and the default has an o2:                  test.o2 = default, test.o2Source = "assumed"
if test.pressureAtm is null and the default has a pressureAtm:  same for pressure
```

A default never overwrites a value the table states. A test with either value assumed is an "assumed test". EMBER then treats it differently in these places:

| Where | What happens to an assumed test |
|---|---|
| Map | Drawn as a **hollow** mark instead of a filled one |
| Coverage score | Counts at **half weight** |
| Nearby counts | Counted in full, with a separate "assumed" count. If half or more of the nearby tests are assumed, the site adds "Most of these rows use assumed coordinates." |
| Moon Base region count | Never counted. Only tests whose table states both values count |
| About page and row drawer | Listed with its reason and the status "needs human check" |

Today **930 of 2,031** tests rest on at least one assumed value, and **722** of them have an assumed oxygen. They matter most for the ISS cabin: of its **1,093** nearby tests, **849** are assumed. They do not touch the low pressure habitats at all today, which is itself part of the ACME BRE problem below.

---

## Part 2. How to review

### Where the values live

`data/manual/atmosphere-defaults.json` has 12 entries. One looks like this:

```json
{ "accession": "PSI-100", "o2": null, "pressureAtm": 1.0, "reason": "Saffire-III ran in a Cygnus cargo vehicle cabin, near one atmosphere. Its table has no oxygen column.", "status": "needs human check" }
```

| Field | Meaning |
|---|---|
| `accession` | The investigation, such as `PSI-100` |
| `o2` | The default oxygen fraction. `null` means "do not fill", so a test whose table has no oxygen stays without one and is left off the map |
| `pressureAtm` | The default pressure in atm. `null` works the same way |
| `reason` | One or two sentences. The site shows this text word for word |
| `status` | `needs human check`, `confirmed` or `changed` |

### What "confirmed" and "changed" do

- `confirmed` means "I checked this entry and agree with it". Use it even if you only reworded the `reason`.
- `changed` means "I corrected `o2` or `pressureAtm`".
- **The status is a label only.** The build never reads it. It changes the Status column on the About page and nothing else. A confirmed value still draws hollow and still counts at half weight, because it is still not a value from NASA's table. (Decision X1 in the sheet asks whether you want that.)
- **Changing a value** moves the marks, the nearby counts and the coverage scores. Setting a value to `null` takes those tests off the map. They stay in the site's lists and appear under About, Data and methods, "Tests that are not on the map".

### How to record your decisions

The easy way: reply with the decision sheet filled in. Firstmate will get the edits made and tested as one pull request.

The hands-on way, from `REVIEW-CHECKLIST.md`:

1. Edit `data/manual/atmosphere-defaults.json`.
2. Run `npm run build:data` and then `npm run build:embeddings`.
3. Run `npm run ci`. Tests pin some headline numbers (722 assumed oxygen, and the ISS row of 1,093 nearby with 849 assumed, in `src/lib/app.test.ts`). If a value change moves them, the failing test names the number. Update the expected number when the move is the one you intended.
4. Commit the JSON together with the regenerated `public/data` files and open a pull request.

### How to see an assumption on the live site

- **The full list:** https://ember-two-eta.vercel.app/about?section=assumptions opens About, tab "Data and methods", section "Declared assumptions". It shows each entry's oxygen, pressure, reason and status.
- **One test:** open the Dashboard (https://ember-two-eta.vercel.app/dashboard) and click a hollow mark on the map. A drawer lists the tests at that point. Click one. A box at the top reads "Assumed. The table for this test does not state an atmosphere. EMBER uses a declared assumption and counts this test at half weight." followed by the reason and a link to all assumptions.
- **One investigation:** https://ember-two-eta.vercel.app/investigations/PSI-20 (swap in any accession) lists its tests. An assumed value has the word "assumed" next to it.

### How to check one against a source

1. **Read the PSI record:** `https://psi.nasa.gov/physci/repo/data/investigations/PSI-NN`. Look at Objective, Approach, Experiment Hardware and the table notes. Words that matter: "cabin air", "glovebox", "chamber", "pressure", "psia", "kPa", "atm", "O2". The same text is in the repo at `data/raw/investigations/PSI-NN.json`.
2. **Read the table:** in the repo at `data/raw/tables/PSI-NN_*.csv`. Check which columns exist and read any note row.
3. **Read a paper:** the record lists publications. Search a paper's PDF for "kPa", "atm", "O2" or "oxygen". The Claude check already found the key paper for each entry, linked in Part 3.
4. **Compare:** convert units with the cheat sheet in Part 1. A difference of a few percent in pressure, or under one oxygen point, does not change anything on the map in practice.
5. **Decide** and record it.

### A fully worked example: Saffire-III (PSI-100)

1. **What EMBER says.** About lists Saffire-III with oxygen "from the table", pressure "1 atm assumed", and the reason "Saffire-III ran in a Cygnus cargo vehicle cabin, near one atmosphere. Its table has no oxygen column." Its 2 tests are not on the map, because a test needs both values to be plotted.
2. **The PSI record.** https://psi.nasa.gov/physci/repo/data/investigations/PSI-100 says the burn happened in the Cygnus vehicle. The table (`data/raw/tables/PSI-100_*.csv`) has columns for sample, size, air flow and direction, and none for oxygen or pressure. So both values are genuinely missing.
3. **A paper.** Olson and co-authors, "The effect of duct size, sample size, and fuel composition on concurrent flame spread over large cellulose samples in microgravity", accepted manuscript at https://discovery.ucl.ac.uk/id/eprint/10164340/1/SIBAL-cotton%20revised%20Sept%20per%20review%20track%20changes%20accepted.pdf. Table 1 has the row "III 1 25 SIBAL 94x40.6 ... 21.2 99", which is 21.2% oxygen at 99 kPa. Its footnote says the Cygnus vehicle "was originally filled with the ISS atmosphere, which at hatch closing was recorded as listed in Table 1".
4. **Compare.** 99 kPa is 0.977 atm. The assumed 1 atm is 2.3% off, which is fine. The oxygen is not unknown after all: 21.2% is published.
5. **Decide.** Keep the pressure, add the oxygen, and the 2 tests join the map:

```json
{ "accession": "PSI-100", "o2": 0.212, "pressureAtm": 1.0, "reason": "Saffire-III ran in the Cygnus cargo vehicle cabin, filled with station air at hatch closing. Olson and co-authors, Table 1, record 21.2 percent oxygen at 99 kPa. The PSI table has no oxygen column.", "status": "changed" }
```

6. **Effect.** Saffire-III's 2 tests appear as hollow marks near the ISS cabin, and the ISS nearby count grows by 2.

---

## Part 3. The 12 assumptions and 2 flame gates

How to read each section:

- **Tests affected** is the number of snapshot tests that use the assumed value, and how many of them are in the ISS cabin's nearby count.
- **Plain verdict** sums up the Claude check in one phrase.
- **Your decision** lists the options. The recommended one is first and marked.
- Each section ends with an empty "Astra check" slot and a checkbox.

Overview:

| Key | Investigation | EMBER assumes | Tests | Claude verdict |
|---|---|---|---|---|
| A1 | BASS (PSI-26) | 21%, 1 atm | 122 | Partly wrong |
| A2 | SAME (PSI-102) | 21%, 1 atm | 8 | Plausible, no source states it |
| A3 | SAME-R (PSI-101) | 21%, 1 atm | 109 | Plausible, no source states it |
| A4 | DAFT (PSI-47) | 21%, 1 atm | 2 | Partly wrong |
| A5 | SPICE (PSI-107) | 21%, 1 atm | 469 | Holds |
| A6 | SLICE (PSI-106) | 21%, 1 atm | 12 | Holds |
| A7 | Saffire-I (PSI-98) | 1 atm | 2 | Holds |
| A8 | Saffire-II (PSI-99) | 1 atm | 9 | Holds |
| A9 | Saffire-III (PSI-100) | 1 atm, no oxygen | 2 | Pressure holds, oxygen is published |
| A10 | BASS-II (PSI-25) | 1 atm | 129 | Holds |
| A11 | ACME BRE (PSI-20) | 1 atm | 43 | **Wrong for many tests** |
| A12 | ACME s-Flame (PSI-23) | 1 atm | 23 | Holds as a starting value |
| G1 | Gate: ACME "Tad (K)" | adiabatic flame temperature | 587 | Holds |
| G2 | Gate: FLEX burning rate unit | mm² per second | 274 | Holds |

### A1. BASS (PSI-26): 21% oxygen, 1 atm

- **What EMBER assumes and why:** 21% and 1 atm, because BASS burned solid samples (plastics and fabrics) in the glovebox, whose air is station cabin air. Reason on the site: "BASS ran in the Microgravity Science Glovebox in cabin air. Some tests used nitrogen to suppress the flame."
- **Tests affected:** 122, all solid material burns. Both values assumed. All 122 are in the ISS nearby count.
- **What the Claude check found:** the pressure is right. The oxygen was not always 21%. A NASA presentation by the BASS team says some burns ran at about 17% oxygen after nitrogen was added to the glovebox air. The PSI table does not say which rows those were.
- **Key source:** Ferkul and co-authors, "Thickness and Fuel Preheating Effects on Material Flammability in Microgravity from the BASS Experiment", 2013, listed in the PSI-26 record. https://ntrs.nasa.gov/api/citations/20140011099/downloads/20140011099.pdf. Quotes: "Ambient oxygen atmospheres 17% to 21.5% (cabin air)." and sample images captioned "17% O2/N2, 1 atm". A second paper (Olson and co-authors, UCL link in Part 2) lists two BASS tests at 21.5 and 21.6% oxygen and 101 kPa.
- **Plain verdict:** pressure right, oxygen right for most burns but too high for an unknown few.
- **Your decision (A1):**
  - **a. Recommended.** Keep 21%, replace the reason with: "BASS ran in the Microgravity Science Glovebox at about 1 atm. Most burns used cabin air at about 21 to 22 percent oxygen. A NASA presentation shows some burns at about 17 percent after nitrogen was added, and the table does not say which. A nitrogen jet was also tested as an extinguisher." Set `confirmed`. Nothing moves on the map.
  - b. Leave it as `needs human check` until per-test oxygen is found in the BASS data files on PSI.
  - c. Set `o2` to `null`. All 122 BASS tests leave the map and the ISS loses 122 of its 229 nearby solid material tests. Too drastic for a problem that affects a few rows.
- **Astra check: pending.**

- [ ] A1 decided: ____

### A2. SAME (PSI-102): 21% oxygen, 1 atm

- **What EMBER assumes and why:** 21% and 1 atm, because SAME made smoke in the glovebox in cabin air. Reason on the site: "SAME generated and measured smoke in cabin air on the ISS."
- **Tests affected:** 8 smoke tests. Both values assumed. All 8 are in the ISS nearby count.
- **What the Claude check found:** SAME ran in the glovebox, which holds cabin air at a pressure just under the cabin's (1.3 to 7 millibar lower, under 1% of an atmosphere). No source it could reach states the oxygen or pressure outright. The samples were overheated to make smoke, not set on fire.
- **Key source:** NASA's SAME fact sheet, https://www.nasa.gov/wp-content/uploads/2025/07/smoke-aerosol-measurement-experiment-same.pdf: "The Smoke and Aerosol Measurement Experiment (SAME) was conducted in the Microgravity Science Glovebox (MSG) on the International Space Station (ISS) during Expedition 15." And the MSG overview, https://ntrs.nasa.gov/api/citations/20080013594/downloads/20080013594.pdf: "The facility has an enclosed working volume that is held at a negative pressure with respect to the crew living area."
- **Plain verdict:** almost certainly right, but nothing states it in words. The bigger point is that nothing burned (see H1).
- **Your decision (A2):**
  - **a. Recommended.** Confirm, with the reason: "SAME heated spacecraft materials below their ignition point in the Microgravity Science Glovebox, in cabin air at about 1 atm. Nothing burned. It is a smoke test for fire detectors." Set `confirmed`.
  - b. Leave it as `needs human check` until the SAME final report is found.
- **Astra check: pending.**

- [ ] A2 decided: ____

### A3. SAME-R (PSI-101): 21% oxygen, 1 atm

- **What EMBER assumes and why:** 21% and 1 atm, because SAME-R reused the SAME hardware in the glovebox. Reason on the site: "SAME-R used the SAME hardware in cabin air on the ISS."
- **Tests affected:** 109 smoke tests. Both values assumed. All 109 are in the ISS nearby count.
- **What the Claude check found:** same situation as SAME. The paper confirms the glovebox and that nothing ignited. It does not state the oxygen. The nitrogen it mentions only diluted the smoke sample on its way to the meter, not the air around the sample.
- **Key source:** Urban and co-authors, "Particle Morphology and Size Results from the Smoke Aerosol Measurement Experiment-2", AIAA 2012-3536, https://ntrs.nasa.gov/api/citations/20130000422/downloads/20130000422.pdf: "Five different materials representative of those found in spacecraft (Teflon, Kapton, cotton, silicone rubber and Pyrell) were heated to temperatures below the ignition point" and "The system was installed in the Microgravity Science Glovebox (MSG)".
- **Plain verdict:** almost certainly right, not stated in words, nothing burned.
- **Your decision (A3):**
  - **a. Recommended.** Confirm, with the reason: "SAME-R reused the SAME hardware in the Microgravity Science Glovebox, in cabin air at about 1 atm. Samples were heated below their ignition point, so nothing burned. It is a smoke test for fire detectors." Set `confirmed`.
  - b. Leave it as `needs human check`.
- **Astra check: pending.**

- [ ] A3 decided: ____

### A4. DAFT (PSI-47): 21% oxygen, 1 atm

- **What EMBER assumes and why:** 21% and 1 atm, because DAFT sampled cabin air. Reason on the site: "DAFT sampled ISS cabin air. Nothing was burned."
- **Tests affected:** 2 rows. Both values assumed. Both are in the ISS nearby count.
- **What the Claude check found:** DAFT tested dust counters (instruments a smoke detector could use). Both table rows name the sample as test dust blown into bags of pure nitrogen from the station's supply. So the gas around that sample had almost no oxygen. DAFT also took readings of cabin air. It was mounted on an EXPRESS rack in the open cabin, not in the glovebox.
- **Key source:** the PSI-47 table, both rows: "Arizona Road Dust (ARD Fine) in combination with ISS GN2 to create an aerosol for measurement purposes." (GN2 is gaseous nitrogen.) And the NASA Glenn article linked from the record, https://ntrs.nasa.gov/api/citations/20050215648/downloads/20050215648.pdf: "gaseous nitrogen provided by the rack will be used to fill 15-liter sample bags."
- **Plain verdict:** the pressure is right. The 21% oxygen is wrong for the sample each row describes.
- **Your decision (A4):**
  - **a. Recommended.** Set `o2` to `null`, keep `pressureAtm` 1.0, with the reason: "DAFT tested dust counters on a test dust carried in bags of pure nitrogen, and on cabin air. Nothing burned. The dust had almost no oxygen around it, so EMBER does not plot these rows." Set `changed`. The 2 rows leave the map. ISS nearby smoke tests go from 119 to 117.
  - b. Keep 21% and only reword the reason to mention the nitrogen.
- **Astra check: pending.**

- [ ] A4 decided: ____

### A5. SPICE (PSI-107): 21% oxygen, 1 atm

- **What EMBER assumes and why:** 21% and 1 atm, because SPICE burned small gas jet flames in the glovebox with a fan blowing glovebox air past them. Reason on the site: "SPICE burned gas jet flames in a coflow of cabin air in the glovebox."
- **Tests affected:** 469 gas flame tests, the largest group. Both values assumed. All 469 are in the ISS nearby count.
- **What the Claude check found:** confirmed by two papers. Cabin oxygen ran at about 20 to 23%, so 21% is a fair centre.
- **Key source:** Dotson and co-authors, Fire Safety Journal 2011, listed in the PSI-107 record, https://www.grace.umd.edu/~pbs/2011%20Dotson%20et%20al.%20FSJ.pdf: "after each burn the glovebox was flushed with cabin air" and "The oxygen mole fraction of ISS cabin air was maintained within an estimated range of 20–23%." Stocker and co-authors 2014, https://ntrs.nasa.gov/api/citations/20140009169/downloads/20140009169.pdf, on SPICE and SLICE: "The pressure was consistently ~100 kPa" and "the atmosphere consisted of ~21% oxygen (by volume) with a balance of nitrogen."
- **Plain verdict:** right.
- **Your decision (A5):**
  - **a. Recommended.** Set `confirmed`, reason unchanged.
  - b. Confirm and add "Cabin oxygen then ran at about 20 to 23 percent." to the reason.
- **Astra check: pending.**

- [ ] A5 decided: ____

### A6. SLICE (PSI-106): 21% oxygen, 1 atm

- **What EMBER assumes and why:** 21% and 1 atm, because SLICE used the SPICE hardware. Reason on the site: "SLICE used the same flow duct as SPICE, in cabin air."
- **Tests affected:** 12 gas flame test days. Both values assumed. All 12 are in the ISS nearby count. One of the 12 is really a SPICE day (see H4).
- **What the Claude check found:** confirmed by the same Stocker 2014 paper as SPICE.
- **Key source:** Stocker and co-authors 2014 (link under A5): "The SPICE and SLICE experiments were both conducted in the Microgravity Science Glovebox (MSG) using common hardware".
- **Plain verdict:** right.
- **Your decision (A6):**
  - **a. Recommended.** Set `confirmed`, reason unchanged.
  - b. Leave it as `needs human check`.
- **Astra check: pending.**

- [ ] A6 decided: ____

### A7. Saffire-I (PSI-98): 1 atm, oxygen from the table

- **What EMBER assumes and why:** 1 atm, because Saffire-I burned in the Cygnus cabin. Reason on the site: "Saffire-I ran in a Cygnus cargo vehicle cabin, near one atmosphere. Oxygen comes from the table."
- **Tests affected:** 2. Pressure assumed, oxygen from the table. Both are in the ISS nearby count.
- **What the Claude check found:** a paper records the cabin at hatch closing as 21.7% oxygen and 102 kPa, which is 1.007 atm. The pressure did not change noticeably during the burns.
- **Key source:** Olson and co-authors, Table 1 (UCL link in Part 2): row "I 1 20 SIBAL 94x40.6 ... 21.7 102", and the footnote that Cygnus "was originally filled with the ISS atmosphere, which at hatch closing was recorded as listed in Table 1".
- **Plain verdict:** right.
- **Your decision (A7):**
  - **a. Recommended.** Confirm, with the reason: "Saffire-I ran in the Cygnus cargo vehicle cabin, filled with station air at hatch closing. Olson and co-authors, Table 1, record 102 kPa. Oxygen comes from the table." Set `confirmed`.
  - b. Confirm with the reason unchanged.
- **Astra check: pending.**

- [ ] A7 decided: ____

### A8. Saffire-II (PSI-99): 1 atm, oxygen from the table

- **What EMBER assumes and why:** 1 atm, same reason as Saffire-I.
- **Tests affected:** 9. Pressure assumed, oxygen from the table. All 9 are in the ISS nearby count.
- **What the Claude check found:** the same paper gives 22.1% oxygen and 103 kPa (1.017 atm). The 22.1% matches the PSI table.
- **Key source:** Olson and co-authors, Table 1, rows "II 5" and "II 6".
- **Plain verdict:** right.
- **Your decision (A8):**
  - **a. Recommended.** Confirm, with the reason: "Saffire-II ran in the Cygnus cargo vehicle cabin, filled with station air at hatch closing. Olson and co-authors, Table 1, record 103 kPa. Oxygen comes from the table." Set `confirmed`.
  - b. Confirm with the reason unchanged.
- **Astra check: pending.**

- [ ] A8 decided: ____

### A9. Saffire-III (PSI-100): 1 atm, no oxygen

- **What EMBER assumes and why:** 1 atm, same reason as Saffire-I. The table has no oxygen column, so the tests are not on the map.
- **Tests affected:** 2. Pressure assumed, no oxygen. Neither is plotted.
- **What the Claude check found:** the paper gives 21.2% oxygen and 99 kPa. This is the worked example in Part 2.
- **Key source:** Olson and co-authors, Table 1, row "III 1 25 SIBAL 94x40.6 ... 21.2 99".
- **Plain verdict:** pressure right, and the missing oxygen is published.
- **Your decision (A9):**
  - **a. Recommended.** Set `o2` to 0.212 with the reason in the worked example. Set `changed`. The 2 tests join the map near the ISS, hollow.
  - b. Confirm the pressure only and leave the tests off the map.
- **Astra check: pending.**

- [ ] A9 decided: ____

### A10. BASS-II (PSI-25): 1 atm, oxygen from the table

- **What EMBER assumes and why:** 1 atm, because BASS-II ran in the glovebox at cabin pressure. Its oxygen was lowered with nitrogen and the table states it. Reason on the site: "BASS-II ran in the Microgravity Science Glovebox at cabin pressure. Oxygen comes from the table."
- **Tests affected:** 129 solid material burns. Pressure assumed, oxygen from the table. 96 are in the ISS nearby count. The other 33 ran at lower oxygen.
- **What the Claude check found:** confirmed in three NASA papers.
- **Key source:** Zhao and co-authors, 2015, https://ntrs.nasa.gov/api/citations/20150008962/downloads/20150008962.pdf: "Ambient pressure was 1 atm." and "Ambient oxygen was varied from 21% down to 16%".
- **Plain verdict:** right.
- **Your decision (A10):**
  - **a. Recommended.** Set `confirmed`, reason unchanged.
  - b. Leave it as `needs human check`.
- **Astra check: pending.**

- [ ] A10 decided: ____

### A11. ACME BRE (PSI-20): 1 atm, oxygen from the table. The important one.

- **What EMBER assumes and why:** 1 atm for every test, only to place the tests on the map. The reason on the site already warns: "The ACME BRE table lists oxygen levels for each test day and no pressure. Its own note says: "The chamber pressures were also varied but are not identified in this summary table." One atmosphere is assumed only to place the tests on the map, so a plotted BRE pressure may not be the pressure that test ran at." The nearby panel for the Shuttle EVA prep, Exploration and Mars habitats also says BRE "targeted this atmosphere" but is plotted at 14.7 psi.
- **Tests affected:** 43, from 18 test days split by oxygen level: 5 at 21%, 6 at 25%, 9 at 26.5%, 13 at 34% and 10 at 40%. Pressure assumed for all 43. 5 (the 21% ones) are in the ISS nearby count.
- **What the Claude check found:** BRE ran in the sealed CIR chamber, filled per test to NASA's planned habitat atmospheres. Most 2019 tests ran well below 1 atm: the 26.5% tests near 0.7 bar (10.2 psi) and most 34% tests near 0.565 to 0.61 bar (8.2 to 8.8 psi). Across all tests the pressure ran from 0.565 to about 1.07 bar. So EMBER draws these flames at 14.7 psi when many burned at the exact low pressure habitats the challenge is about.
- **Key sources:**
  - The PSI-20 record, objective: "NASA - considered atmosphere for human space missions will be examined: 14.7 psia, 21 % oxygen: 10.2 psia, 26.5 %" and "8.2 psia, 34 % oxygen." https://psi.nasa.gov/physci/repo/data/investigations/PSI-20
  - Dehghani and co-authors, Combustion and Flame 228 (2021), a PSI-20 listed paper, abstract: "Nominal ambient conditions range from 40% to 21% oxygen and pressures of 1 to about 0.56 bar. NASA human habitat atmospheres have been used."
  - Dehghani, PhD thesis, University of Maryland 2022, https://drum.lib.umd.edu/bitstream/1903/29303/2/Dehghani_umd_0117E_22750.pdf: "21 % oxygen and 1 bar, 26.5% and 0.7 bar and 34 % and 0.565 bar". Its Table 6.1 lists the pressure of each test.
- **Pressure per test day,** as matched by the Claude check from Dehghani's Table 6.1:

| PSI table date | Oxygen levels in the PSI table | Pressure in Dehghani Table 6.1 |
|---|---|---|
| 2019 Feb 8 | 21, 26.5, 40 | 26.5% at 0.707 bar, 40% at 1.05 bar |
| 2019 Feb 20 | 26.5, 34 | 0.565 to 0.57 bar |
| 2019 Feb 25 | 21, 26.5, 34, 40 | 0.565 bar (33%) and 1.055 bar (39 to 40%) |
| 2019 Mar 4 | 26.5, 40 | 0.71 bar (26 to 27%), 1.055 to 1.06 bar (36 to 39%) |
| 2019 Mar 7 | 34 | 0.605 bar |
| 2019 Mar 11 | 26.5, 34 | 0.565 to 0.605 bar |
| 2019 Mar 28 | 26.5, 34 | 0.74, 0.707 and 0.604 bar |
| 2019 Apr 4 | 21, 26.5, 34 | 0.707 to 0.74 bar and 0.57 bar |
| 2020 Dec 11, 17, 23 | 25, 34, 40 | 1.04 to 1.07 bar |
| 2021 Jan 20 | 21, 26.5, 34 | 0.595 to 0.615 bar |

  Some 2020 and 2021 days (for example 2020 Sept 3) could not be matched to the thesis.
- **Plain verdict:** wrong for a large share of the tests, and these are the most valuable tests in the set for the challenge.
- **Your decision (A11):**
  - **a. Recommended now.** Set `pressureAtm` to `null` with the reason: "The ACME BRE chamber was filled to a chosen pressure for each test, from about 0.56 to 1.06 atm. Tests at 26.5 percent oxygen ran near 0.7 atm and many at 34 percent near 0.56 atm (Dehghani 2021 and 2022). The PSI summary table does not say which test ran at which pressure, so EMBER does not plot these tests." Set `changed`. All 43 leave the map instead of sitting in the wrong place. Tests with an assumed value drop from 930 to 887. One sentence of code also changes: the nearby note in `src/lib/nearby.ts:44` says BRE is plotted at 14.7 psi and would need to say it is not plotted.
  - b. Better, but more work. Give each matched test day its pressure from Dehghani's table, cited, and leave unmatched days off the map. About 4 of the 26.5% tests would land near the Shuttle EVA prep habitat and about 7 of the 34% tests near Exploration and Mars, where today there are 0 assumed tests. This needs a per-day rule in `scripts/lib/normalize.mjs`, because the defaults file holds one value per investigation. It can follow (a) later.
  - c. Keep 1 atm with the current warning.
- **Astra check: pending.**

- [ ] A11 decided: ____

### A12. ACME s-Flame (PSI-23): 1 atm, oxygen from the table

- **What EMBER assumes and why:** 1 atm, because NASA's own table note says so. Reason on the site: "A note in the ACME s-Flame table says the atmosphere is about 1 atm. Oxygen comes from the table."
- **Tests affected:** 23, from 18 test days. Pressure assumed, oxygen from the table. 15 are in the ISS nearby count.
- **What the Claude check found:** the note is the only primary statement, and it is right as a starting value. In a sealed chamber the pressure rises and the oxygen falls as each test day goes on. Also, 14 of the 23 tests used helium instead of nitrogen as the other gas (see H2).
- **Key source:** the PSI-23 table note: "*Atmosphere is ~1 atm but pressure increases and O2% drops with vitiation." (Vitiation means the chamber gas filling up with combustion products.)
- **Plain verdict:** right as a starting value.
- **Your decision (A12):**
  - **a. Recommended.** Confirm, with the reason: "A note in the ACME s-Flame table says the atmosphere is about 1 atm at the start. Pressure rises and oxygen falls during a test day as the sealed chamber fills with products. Oxygen comes from the table. Some days used helium instead of nitrogen." Set `confirmed`.
  - b. Confirm with the reason unchanged.
- **Astra check: pending.**

- [ ] A12 decided: ____

### G1. Flame gate: is the ACME column "Tad (K)" the adiabatic flame temperature?

- **What it is:** the habitat screen shows an animated flame with a "Flame temp" tile. The tile value is the median of the "Tad (K)" column of nearby ACME tests. A switch in `src/three/flameParams.ts:16`, `tadConfirmed: false`, keeps the mark on the temperature scale from moving until someone confirms what the column means. The adiabatic flame temperature is the hottest a flame could get in theory, calculated from the gas mix, not measured.
- **Tests affected:** 587 ACME tests have the column: 256 from Flame Design (PSI-10) and 331 from CFI-G (PSI-159).
- **What the Claude check found:** the Flame Design paper says the team varied "adiabatic flame temperature" by changing the gas mix, and the table lists it right beside its partner design variable. The values (1,397 to 2,978 K, rising with oxygen) fit calculated values, not measured ones.
- **Key source:** Irace and co-authors, Combustion and Flame 229 (2021), abstract: "The stoichiometric mixture fraction and adiabatic flame temperature are varied by diluting the fuel with nitrogen and varying the oxygen concentration in the ambient." Same team, Santa and co-authors 2007, https://www.grace.umd.edu/~pbs/2007%20Santa%20et%20al.%20CTM.pdf.
- **Caveat:** for a "cool flame" (a faint, low temperature flame) the column describes a hot flame that never happened. 7 of the 587 rows are marked as cool flames, too few to move the median.
- **Plain verdict:** right. Safe to switch on.
- **Your decision (G1):**
  - **a. Recommended.** Set `tadConfirmed: true` and make the tile say the value is calculated (for example the note "calculated, from N ACME tests").
  - b. Set `tadConfirmed: true` and change nothing else.
  - c. Leave it off.
- **Astra check: pending.**

- [ ] G1 decided: ____

### G2. Flame gate: is the FLEX burning rate in mm² per second?

- **What it is:** the FLEX droplet table's "Burning rate" header carries only "mm" as its unit. EMBER relabels it mm² per second. A switch in `src/three/flameParams.ts:19`, `burningRateUnitConfirmed: false`, keeps the Lab's droplet from animating until someone confirms it. A burning droplet's diameter squared shrinks at a steady rate, which is why the unit is area per second.
- **Tests affected:** all 274 FLEX tests carry the column.
- **What the Claude check found:** the FLEX investigators' paper defines the rate as the rate of decrease of the diameter squared and quotes "around 0.5 mm2/s". EMBER's own data agrees: over 196 rows, (start diameter² minus end diameter²) divided by burn time comes out at 0.95 times the listed rate on median. The table median is 0.50.
- **Key source:** Williams and Nayagam, Combustion Theory and Modelling 23 (2019), https://par.nsf.gov/servlets/purl/10111319: "the burning-rate constant around 0.5 mm2/s".
- **Plain verdict:** right. Safe to switch on.
- **Your decision (G2):**
  - **a. Recommended.** Set `burningRateUnitConfirmed: true`.
  - b. Leave it off.
- **Astra check: pending.**

- [ ] G2 decided: ____

---

## Part 4. Other hidden issues

These are not entries in the defaults file, but the Claude check found them in the same data path.

### H1. Rows on the fire map where nothing burned

- **What:** SAME (8 tests), SAME-R (109) and DAFT (2) heated materials below ignition or measured dust. Nothing burned. They are on the map as "smoke and aerosol" tests (square marks), because they count toward the detection side of fire safety. The About page does not say that nothing burned.
- **How much it matters:** all 119 are in the ISS nearby count, and they are every smoke test near the ISS. Removing them would make the ISS panel say there are no nearby smoke tests.
- **Your decision (H1):**
  - **a. Recommended.** Keep them on the map, and say "nothing burned, smoke test" in their reasons (A2, A3, A4 already do) and in one line of About.
  - b. Take them off the map into a separate non-fire list. This is a code change and drops all smoke evidence near the ISS.

- [ ] H1 decided: ____

### H2. Helium days shown as air

- **What:** 14 of the 23 ACME s-Flame tests used helium instead of nitrogen as the other gas (7 at 21% oxygen, 7 at 30%). The map shows oxygen only, so they look like air. Helium carries heat away far better than nitrogen, so a flame in it behaves differently. 7 of them are in the ISS nearby count. The row drawer does not mention helium, because the build does not record the diluent for this table.
- **Your decision (H2):**
  - **a. Recommended.** Record helium for these 14 rows so the drawer shows "Other gases: helium", and add a line to the s-Flame reason (A12 does). Small code change in the s-Flame rule of `scripts/lib/normalize.mjs`.
  - b. Take the 14 helium rows off the map.
  - c. Leave as is.

- [ ] H2 decided: ____

### H3. Rows that are not tests

- **What:** two rows get an atmosphere and a mark although nothing was tested.
  - BASS row 66 (2012-08-03) reads "SOOT Cleaning". It is maintenance.
  - ACME BRE "2019 April 1" lists 0 flames ignited.
- SAME rows 5 to 8 only say "same conditions as 1-4". The Claude check listed them too, but they are real samples (Kapton, silicone rubber, lampwick, dibutyl phthalate), so they should stay.
- **Your decision (H3):**
  - **a. Recommended.** Drop the two non-test rows in the build and list them on About under the corrections. Keep SAME rows 5 to 8. Small code change.
  - b. Keep them and flag them in the drawer.
  - c. Leave as is.

- [ ] H3 decided: ____

### H4. A SPICE day filed under SLICE

- **What:** the last row of NASA's SLICE table reads "2012-MAR-23 Last day of testing: SPICE testing with 100% C3H8 and then 100%". It is a SPICE test day carrying the SLICE accession. SPICE and SLICE have the same assumed atmosphere, so its mark is in the right place. Only the investigation it is credited to is wrong.
- **Your decision (H4):**
  - **a. Recommended.** Keep it where NASA filed it and add it to About, "Source text kept as written".
  - b. Move it to SPICE in the build. Small code change.

- [ ] H4 decided: ____

### H5. Cabin air pinned at exactly 21.0%

- **What:** all 722 tests with an assumed oxygen get exactly 21.0%. Measured ISS cabin oxygen ran from 20 to 23%, and the recorded hatch closing and glovebox values were 21.2 to 22.2%. So the hollow marks sit about half a point to one point low.
- **How much it matters:** half a point is one eighth of a nearby unit (4 points). It changes no count that matters. 21.0% also matches the site's ISS cabin habitat, which is set at 21%.
- **Your decision (H5):**
  - **a. Recommended.** Keep 21.0% and add one sentence to About: "Measured ISS cabin oxygen ran from about 20 to 23 percent. EMBER uses 21 percent."
  - b. Move the cabin air default to 21.5%. All 722 marks shift up and the pinned test numbers need updating.
  - c. Show cabin air as a band from 20 to 23%. A design change to the map.

- [ ] H5 decided: ____

### Smaller notes, no decision needed

- The Saffire-I table swaps length and width (it lists 40.6 cm long and 94 cm wide). The paper and the PSI text say 94 cm long.
- The Saffire-III table gives a flow of 30 cm/s and Olson's Table 1 gives 25 cm/s.
- Saffire-II oxygen is derived from carbon dioxide readings, as its own table note says.
- Two ACME BRE oxygen cells read "3400%" and "2100%". EMBER reads them as 34% and 21% and flags them "typo-fixed". The Dehghani thesis supports the 34%.

---

## Decision sheet

Reply in one message. Either write "all recommended", with any exceptions, or one line per key, for example `A11 a, H2 c`.

"Code" in the last column means the change needs a small code edit as well as the JSON, which Firstmate can arrange.

| Key | Item | Options | Recommended | Code? |
|---|---|---|---|---|
| A1 | BASS oxygen | a. keep 21%, add the 17% caveat, confirm. b. leave unchecked. c. take oxygen off the map | **a** | No |
| A2 | SAME | a. confirm, say "nothing burned". b. leave unchecked | **a** | No |
| A3 | SAME-R | a. confirm, say "nothing burned". b. leave unchecked | **a** | No |
| A4 | DAFT | a. oxygen to null, off the map. b. keep 21%, reword | **a** | No |
| A5 | SPICE | a. confirm. b. confirm and add the 20 to 23% range | **a** | No |
| A6 | SLICE | a. confirm. b. leave unchecked | **a** | No |
| A7 | Saffire-I | a. confirm, cite 102 kPa. b. confirm as is | **a** | No |
| A8 | Saffire-II | a. confirm, cite 103 kPa. b. confirm as is | **a** | No |
| A9 | Saffire-III | a. add 21.2% oxygen, plot it. b. confirm pressure only | **a** | No |
| A10 | BASS-II | a. confirm. b. leave unchecked | **a** | No |
| A11 | ACME BRE pressure | a. pressure to null, off the map. b. per-day pressures from the thesis. c. keep 1 atm | **a now, b later** | a: one sentence. b: yes |
| A12 | ACME s-Flame | a. confirm, reword ("at the start", helium). b. confirm as is | **a** | No |
| G1 | Tad gate | a. on, and say "calculated". b. on only. c. off | **a** | Yes, one line |
| G2 | Burning rate gate | a. on. b. off | **a** | Yes, one line |
| H1 | Non-fire rows on the map | a. keep, say "nothing burned". b. move off the map | **a** | No |
| H2 | Helium days | a. record helium, keep on map. b. take off the map. c. leave | **a** | Yes |
| H3 | Non-test rows | a. drop the 2, keep SAME 5 to 8. b. flag them. c. leave | **a** | Yes |
| H4 | SPICE day under SLICE | a. keep, note it. b. move to SPICE | **a** | No |
| H5 | Cabin air at 21.0% | a. keep, add one sentence. b. 21.5%. c. a band | **a** | No |
| X1 | Should a value backed by a paper (A7, A8, A9, and A11 b) still draw hollow at half weight? | a. yes, keep it "assumed" and cite the paper in the reason. b. no, add a "from a paper" source type that draws solid | **a** | b: yes |

**What the recommended set changes, all together:** BRE's 43 and DAFT's 2 tests leave the map, Saffire-III's 2 join it, and 2 non-test rows go. Tests with an assumed value go from 930 to 886. Tests with an assumed oxygen go from 722 to 721. The ISS cabin's nearby count goes from 1,093 to 1,087, with 843 assumed. The low pressure habitats do not change until A11 b is done.

**Astra check:** when the second check lands, its verdict goes into each "Astra check: pending" slot. If it disagrees with a recommendation here, that item will be flagged before anything is changed.
