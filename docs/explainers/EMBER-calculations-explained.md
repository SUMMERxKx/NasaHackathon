# EMBER: every calculation, explained simply

This file explains every number EMBER works out, in plain words. You do not need any background in fire science or statistics to follow it.

Every example uses real numbers from EMBER's own data. They come from the snapshot on the live site (build `b85833d3`, NASA data fetched 2026-11-14), read from the code at `main` commit `0bf74bc`. Each section ends with a short "In the code" line for engineers. That line says where the calculation lives.

Each calculation answers the same six things:

- **Question.** What it answers.
- **Idea.** The idea in everyday words.
- **Formula.** Written simply, with every symbol explained.
- **Example.** One worked example with real EMBER numbers.
- **Careful.** What it does not mean, which is the common misreading.
- **In the code.** Where it lives.

A note on honesty. EMBER marks some things as assumed or unconfirmed. This file uses the same words the site uses. The assumed values and the two flame gates were reviewed by the EMBER team on 15 November 2026. The site still says: "A combustion researcher should confirm before this is used for design." Some things still "need a human check", such as the team's pillar choices and one Saffire-II thickness. When they do, this file says so too.

---

## Contents

0. [The big picture on one page](#0-the-big-picture-on-one-page)
1. [Getting the raw numbers ready](#1-getting-the-raw-numbers-ready)
2. [The Atmosphere Map](#2-the-atmosphere-map)
3. [Nearby, coverage and ranking](#3-nearby-coverage-and-ranking)
4. [The Lab: droplets and gravity](#4-the-lab-droplets-and-gravity)
5. [The habitat flame picture and its two gates](#5-the-habitat-flame-picture-and-its-two-gates)
6. [The twelve findings in insights.json](#6-the-twelve-findings-in-insightsjson)
7. [Search and CSV export](#7-search-and-csv-export)
8. [How the chat finds its evidence](#8-how-the-chat-finds-its-evidence)
9. [Glossary](#9-glossary)

---

## 0. The big picture on one page

NASA keeps a public library of space fire experiments called PSI (the Physical Sciences Informatics system). Each experiment, such as FLEX or BASS-II, is an **investigation**. Most investigations have one or more **tables**, and each row of a table is one **test**.

EMBER asks one main question: **"For the air a habitat plans to use, how many real NASA fire tests were run in similar air?"**

"Air" here means two numbers: how much of the gas is oxygen, and how much pressure the gas is at. Gravity matters too, but no PSI test was run at Moon or Mars gravity, so EMBER says so instead of guessing.

Here is how the pieces connect.

```
 NASA PSI records and CSV tables (24 investigations, 22 tables)
                     |
                     v
 [1] BUILD STEP (runs once, before the site is published)
     - read each table row as one test (2,029 tests)
     - leave out 2 rows that record no test
     - convert units: mmHg, bar, percent  ->  atm and oxygen fraction
     - fill a missing value with an ASSUMED one, and mark it
     - flag inverse flames, typo fixes, day-level rows
     - work out the 12 findings (insights.json) and check them twice
                     |
                     v
 snapshot.json + insights.json + evidence.json + search-index.json
                     |
                     v
 [2] THE SITE (runs in your browser, every time you change the habitat)

   You pick a habitat: oxygen %, pressure psi, gravity
                     |
        +------------+-------------+----------------+
        |                          |                |
        v                          v                v
  DISTANCE to every test     FLAME LOOKUP       LAB TOOLS
  (oxygen gap + pressure     (FLEX burn rate,   (d-squared law,
   ratio, in "units")        went-out share,    extinction ratio,
        |                    flame temperature) gravity pairs)
        |                          |
   +----+------+------------+      v
   |           |            |   FIREBALL PICTURE
   v           v            v   (two gates, both on
 NEARBY     COVERAGE     RANKING  since the team review)
 COUNTS     SCORE        of the 24
 (within    (0 to 100,   investigations
  1 unit)    by pillar)

 [3] SEARCH, CSV EXPORT and the CHAT read the same data.
     The chat finds evidence first, then checks every
     number in the answer against that evidence.
```

Three ideas carry most of the site:

1. **Distance.** How different a test's air is from your habitat's air, as one number.
2. **Nearby.** A test is "nearby" when that distance is 1 or less.
3. **Coverage.** Give every plotted test a weight that shrinks with its distance, so closer tests count more, add up the weights, and squeeze the total onto a 0 to 100 scale. Tests further than 1 unit still count a little, and for Exploration they supply about half of the total.

Everything else is either a unit conversion, a count, or a median.

---

## 1. Getting the raw numbers ready

### 1.1 Pressure units: psi, atm, bar, mmHg

**Question.** NASA's tables use different pressure units. How does EMBER put them all on one scale?

**Idea.** Like converting inches, feet and centimetres to one unit before you compare heights. EMBER stores every pressure in **atmospheres (atm)**. One atm is the air pressure at sea level. It shows pressure to people in **psi** (pounds per square inch), because NASA habitat plans use psi.

**Formula.**

```
atm  = psi  ÷ 14.696
psi  = atm  × 14.696
atm  = mmHg ÷ 760
atm  = bar  × 0.98692
kPa  = atm  × 101.325
```

- `psi` is pounds per square inch. Sea level is about 14.7 psi.
- `mmHg` is millimetres of mercury, an old pressure unit. Sea level is 760 mmHg.
- `bar` is a metric pressure unit. One bar is a little less than one atm.

**Example.**

- The FLEX test labelled 20CAL10 lists 762 mmHg. 762 ÷ 760 = **1.0026 atm**.
- An ACME CFI-G test lists 0.50665 bar. 0.50665 × 0.98692 = **0.5000 atm**, which is 0.5000 × 14.696 = **7.35 psi**.
- The ISS habitat is set at 14.7 psi. 14.7 ÷ 14.696 = **1.0003 atm**.

**Careful.** These are exact unit swaps. They do not change or correct the measurement. A pressure of 0 or less is never stored, so a FLEX row that lists 0 mmHg is kept but cannot go on the map.

**In the code.** `src/lib/units.ts:4-14`. Per table: FLEX mmHg at `scripts/lib/normalize.mjs:98-99`, CFI-G bar at `:142-143` and `:158-159`, a pressure must be above 0 at `:471-475`.

### 1.2 Oxygen: fraction and percent

**Question.** How does EMBER store how much oxygen is in the gas?

**Idea.** Oxygen is stored as a **fraction** from 0 to 1. 0.21 means 21 percent of the gas is oxygen, like normal air. On screen it is shown as a percent.

**Formula.**

```
fraction = percent ÷ 100
percent  = fraction × 100
```

Some tables already give a fraction (FLEX, ACME). Some give a percent (BASS-II, Saffire). A value is only kept if it lands between 0 and 1 after conversion.

**Example.**

- BASS-II test 1 lists "22.2" percent. 22.2 ÷ 100 = **0.222**.
- FLEX lists 0.21 directly, so it stays **0.21**.
- ACME BRE lists several oxygen levels for one test day, such as 21, 26.5 and 40. EMBER splits that day into three tests, one per level, and flags them as "day-level". One cell reads "3400%". EMBER reads it as a typo for 34, divides by 100, and flags it "typo-fixed". A second cell, "2100%", sits on a day with 0 flames ignited, and EMBER leaves that row out (see 1.3).

**Careful.** Oxygen fraction is not the same as how much oxygen you breathe. At lower pressure the same fraction gives you less oxygen per breath. That is why the map draws a separate "normoxic" curve (see 2.3).

**In the code.** `scripts/lib/normalize.mjs:115-116` (BASS-II percent), `:464-470` (kept only from 0 to 1), BRE split at `:200-202` with `src/lib/parse.ts:58-67`.

### 1.3 Assumed coordinates

**Question.** Some tables leave out oxygen or pressure. How can those tests appear on the map?

**Idea.** The team read each investigation's NASA record. When the record says the test ran in normal cabin air, EMBER fills the missing value with that air. It is like guessing a room was at room temperature because the report says "in the lab". The guess is always marked, and it counts for **half** in the coverage score.

**Formula.** No arithmetic. A rule:

```
if the table has no oxygen    and the team gave one:  oxygen   = that value,  source = "assumed"
if the table has no pressure  and the team gave one:  pressure = that value,  source = "assumed"
```

A test is "assumed" if **either** its oxygen or its pressure is assumed.

The team's assumed values. The team checked each one against the PSI record and the published papers, and the data file gives the source for each. The site says: "Reviewed by the EMBER team on 15 November 2026. A combustion researcher should confirm before this is used for design."

| Investigations | Assumed oxygen | Assumed pressure |
|---|---|---|
| BASS, SAME, SAME-R, SPICE, SLICE | 21% | 1 atm (14.7 psi) |
| Saffire-III | 21.2% (from a paper, Olson and co-authors, Table 1) | 1 atm (14.7 psi) |
| Saffire-I, Saffire-II, BASS-II, ACME s-Flame | from the table | 1 atm (14.7 psi) |
| DAFT | not stated, so not plotted | 1 atm (14.7 psi) |
| ACME BRE | from the table | not stated, so not plotted |

Each value is marked "confirmed" or "changed" in the data file. Three were changed in the review. DAFT lost its assumed 21%, because DAFT carried its test dust in bags filled with nitrogen and no source gives their oxygen. Saffire-III gained 21.2% from a paper. ACME BRE lost its assumed 1 atm (see below).

**Example.** In the whole snapshot, **886 of 2,029** tests use at least one assumed value. **721** of them have assumed oxygen. On the map, an assumed test is drawn as a **hollow** mark. A reviewed value still draws hollow and counts at half weight, because it is not a value from NASA's table.

ACME BRE needs extra care. Its own table note says: "The chamber pressures were also varied but are not identified in this summary table." The papers give pressures from about 0.56 to 1.07 atm, but not test by test. So EMBER states no pressure for BRE and does not plot its 42 tests.

Two table rows record no test, so EMBER leaves them out of the tests. One is a BASS row that reads "SOOT Cleaning", which records maintenance of the hardware. The other is the ACME BRE row for 1 April 2019, with 0 flames ignited. They still count as table rows (2,009 in all), and About lists them under "Rows that are not tests".

**Careful.** An assumed value is a placeholder, not a measurement, even after the review. It is never shown as measured, and the CSV export marks it in the `o2_source` and `pressure_source` columns.

**In the code.** `data/manual/atmosphere-defaults.json`, applied at `scripts/lib/normalize.mjs:493-502`. Rows left out at `:72-85`. "Assumed" test at `src/lib/coverage.ts:32`. Hollow mark at `src/lib/mapLayout.ts:146`.

### 1.4 Inverse flames

**Question.** Why do some gas flame tests come with a warning?

**Idea.** A normal gas flame burns fuel coming out of a nozzle into the surrounding air. An **inverse flame** is the opposite: oxygen-rich gas comes out of the nozzle into a room full of fuel. So the oxygen value in its row is the oxygen in the **nozzle stream**, not the oxygen in the room. It does not describe a cabin you could live in.

**Formula.** No arithmetic. ACME Flame Design and ACME CFI-G each have two tables, one for normal flames and one for inverse flames. Every row of the two inverse flame tables gets the flag `oxidizer-stream`. The normal flame tables do not. EMBER treats a test as an inverse flame when it has that flag.

**Example.** 274 tests carry the flag: 120 in the Flame Design inverse table and 154 in the CFI-G inverse table. The highest oxygen in all of PSI, 85%, is only found in inverse flames (finding I10).

**Careful.** An inverse flame at 85% oxygen does not mean anything burned in an 85% oxygen cabin. EMBER counts inverse flames and says how many of the gas tests they are, so they are never mistaken for cabin evidence.

**In the code.** Flag set at `scripts/lib/normalize.mjs:148` and `:193`. Test at `src/lib/nearby.ts:49`.

### 1.5 Two helpers used everywhere: median and quartiles

**Question.** When EMBER sums up many tests with one number, which number does it use?

**Idea.** EMBER mostly uses the **median**: line the values up from small to large and take the one in the middle. It is not pulled around by one odd value the way an average is. The **quartiles** are the values one quarter and three quarters of the way along the line. Half of all values sit between them.

**Formula.** Sort the n values. The position of quantile q is `(n − 1) × q`, counting from 0. If that lands between two values, EMBER takes the point the same share of the way between them.

- median: q = 0.5
- lower quartile (Q1): q = 0.25
- upper quartile (Q3): q = 0.75

**Example.** The nitrogen-only FLEX burning rates measured at the 21% oxygen level have a median of 0.52, from 27 tests. The ISS tile in section 5.1 uses a wider window, every test from 18% to 24%, and gets 0.51 from 39 tests. Five values 1, 2, 3, 4, 100 have a median of 3, while their average is 22.

**Careful.** A median says where the middle is. It says nothing about how far any single test is from it.

**In the code.** `src/lib/stats.ts:4-14`.

---

## 2. The Atmosphere Map

### 2.1 The oxygen and pressure map, and its log scale

**Question.** Where does each test sit compared with planned habitats?

**Idea.** The map is a scatter chart. Up and down is oxygen percent, from 10% to 100%, on a plain even scale. Left to right is pressure, from 3 psi to 80 psi, on a **log scale**. On a log scale each step to the right multiplies the pressure by the same amount, like the ruler on a camera zoom lens. Going from 4 to 8 psi takes the same width as going from 40 to 80 psi. This spreads out the low pressures, where the habitats are.

**Formula.** For a map of width W pixels starting at `left`:

```
x = left + W × ln(psi ÷ 3) ÷ ln(80 ÷ 3)
y = bottom − H × (oxygen% − 10) ÷ (100 − 10)
```

- `ln` is the natural logarithm, the button marked "ln" on a calculator.
- `W` and `H` are the map's width and height in pixels.

**Example.** On an 800 pixel wide map, 8.2 psi sits at 800 × ln(8.2 ÷ 3) ÷ ln(80 ÷ 3) = 800 × 1.006 ÷ 3.283 = **245 pixels** from the left. 14.7 psi sits at about 387 pixels. So the Exploration atmosphere is far left of the ISS, even though 8.2 is more than half of 14.7.

Tests that share exactly the same oxygen and pressure are drawn as a tight spiral of marks, within a 9 pixel radius. A badge shows the count when 20 or more share a point. Zooming in opens the spiral so you can point at each test. Of 2,029 tests, **1,893** have both an oxygen and a pressure and can be drawn. The other 136 are listed with the reason, such as oxygen written as "RAMP" in NASA's table, or no pressure value (the 42 ACME BRE tests).

**Careful.** The log scale makes equal ratios look equal, not equal differences. Two dots that look close on the right side of the map can be many psi apart.

**In the code.** `src/lib/mapLayout.ts:11` (ranges), `:49-53` (scales), `:106-170` (stacks), `:70-99` (why a test is not plotted).

### 2.2 The normoxic curve

**Question.** At each pressure, what oxygen percent gives the same oxygen partial pressure as sea level air?

**Idea.** At sea level, air is 20.95% oxygen at 14.696 psi. If you lower the pressure, you need a higher oxygen percent to keep the same oxygen partial pressure. The curve shows that trade.

**Formula.**

```
oxygen% on the curve = 20.95 × 14.696 ÷ psi
```

**Example.** At 8.2 psi the curve sits at 20.95 × 14.696 ÷ 8.2 = **37.5%**. At 10.2 psi it sits at **30.2%**.

**Careful.** The curve uses the dry gas. NASA's breathing standard, NASA-STD-3001 Volume 2, first takes away 47 mmHg for the water vapour in your lungs: inspired oxygen = (pressure in mmHg − 47) × oxygen fraction. On that measure, matching sea level takes about 39.6% oxygen at 8.2 psi and 31.1% at 10.2 psi, and NASA lists the 34% at 8.2 psi Exploration atmosphere as mild hypoxia. The curve is about breathing, not burning. It does not say where fires are safe or dangerous.

**In the code.** `src/lib/mapLayout.ts:181-191`.

### 2.3 The Moon Base region and its edge

**Question.** How many tests ran in air like a planned Moon Base?

**Idea.** The NASA challenge statement describes Moon Base air as **30% oxygen or more at 10.2 psi or less**. EMBER draws that box on the map and counts what is inside. It also counts tests that are just outside the pressure line, within 5%, as "on the edge".

**Formula.**

```
psi rounded = pressure in psi, rounded to 1 decimal place
inside = oxygen ≥ 0.30  and  psi rounded ≤ 10.2
edge   = oxygen ≥ 0.30  and  10.2 < psi rounded ≤ 10.71   (10.71 = 10.2 × 1.05)
```

Only tests whose table states **both** oxygen and pressure count. Assumed values never put a test inside the box. On the map, the edge count only includes droplet (liquid fuel) tests.

**Example.** Many FLEX tests ran at about 532 mmHg. 532 ÷ 760 = 0.700 atm = 10.29 psi, which rounds to **10.3 psi**. That is above 10.2, so those tests are on the edge, not inside. Today: **66** tests are inside, all gas flames, and **46** of those are inverse flames. **17** FLEX droplet tests sit on the edge, at 10.3 to 10.5 psi.

**Careful.** "Inside the region" means the air numbers match. It does not mean the test was about a Moon Base, and none ran at Moon gravity. 46 of the 66 are inverse flames, so their oxygen is the burner stream, not the chamber.

**In the code.** `src/lib/regions.ts:9-41`.

---

## 3. Nearby, coverage and ranking

### 3.1 Distance and the "nearby" rule

**Question.** How different is a test's air from my habitat's air?

**Idea.** EMBER turns two differences into one number, like measuring distance on a map where north and east use different rulers. Oxygen is measured in steps of **4 percentage points**. Pressure is measured by **ratio**, in steps of a factor of about 1.28. One step on either ruler is **one unit**. A test is **nearby** when it is within one unit, counting both rulers together.

**Formula.**

```
dx = (test oxygen − habitat oxygen) ÷ 0.04
dp = (ln(test pressure) − ln(habitat pressure)) ÷ 0.25
distance = √(dx² + dp²)
nearby  = distance ≤ 1
```

- Oxygen values are fractions, so 0.04 is 4 percentage points.
- `ln(a) − ln(b)` is the log of the ratio a ÷ b. Dividing by 0.25 means a pressure ratio of e^0.25 = 1.284 is one unit. That is about 28% higher or 22% lower. The site rounds this to "about 25 percent in pressure".
- `√` is the square root. This is the usual straight-line distance, like the long side of a right triangle.

On the map, the one-unit border around the habitat is drawn as an ellipse. On these two axes it is an exact ellipse.

**Example.** Habitat: Exploration atmosphere, 34% oxygen at 8.2 psi (0.5580 atm). Test: ACME CFI-G, 34.08% oxygen at 0.5000 atm (7.35 psi).

- dx = (0.3408 − 0.34) ÷ 0.04 = **0.020**
- dp = (ln 0.5000 − ln 0.5580) ÷ 0.25 = −0.1097 ÷ 0.25 = **−0.439**
- distance = √(0.020² + 0.439²) = **0.439**, so this test is nearby. It is the closest test of all to the Exploration atmosphere.

**Careful.** Gravity is not part of the rule. A nearby test is "not a test of this habitat and not proof of safety", in the site's own words. A test at distance 1.01 is not much different from one at 0.99. The line is a team design choice, not a law of nature.

**In the code.** `src/lib/coverage.ts:9-15` (the constants) and `:25-30` (distance). Nearby at `src/lib/nearby.ts:55-64`. Ellipse at `src/lib/mapLayout.ts:174-178`.

### 3.2 Nearby counts and fuel classes

**Question.** What kinds of fire were tested near my habitat, and what kinds are missing?

**Idea.** Count the nearby tests, sorted into four kinds of fuel. Each investigation has one fuel class, set by the team:

| Fuel class | On the map | What it covers |
|---|---|---|
| Solid materials | circle | fabrics, plastics like PMMA, silicone |
| Liquid fuels | diamond | fuel droplets, mainly FLEX |
| Gas flames | triangle | gas jets and burners, mainly ACME |
| Smoke and aerosols | square | smoke and dust tests for detectors |
| Not classed | cross | anything else |

The site then writes one plain gap statement from the counts.

**Formula.**

```
total         = number of tests with distance ≤ 1
by fuel       = that number for each class
assumed       = how many of them use an assumed value
inverse       = how many of them are inverse flames
investigations = how many different investigations they come from
```

The gap statement follows simple rules:

- No nearby tests: "No test records meet the nearby oxygen-pressure rule. This is an evidence gap, not proof of safety or danger."
- All four classes present: "Nearby evidence spans all four fuel classes."
- Only one class: "Nearby evidence is limited to (that class) tests."
- Otherwise it names the missing classes.
- If at least half the nearby tests are assumed, it adds "Most of these rows use assumed coordinates."
- At Moon or Mars gravity it adds "No partial-gravity data in this snapshot."

**Example.**

| Habitat | Nearby | Solid | Liquid | Gas | Smoke | Assumed | Inverse |
|---|---|---|---|---|---|---|---|
| ISS cabin (21%, 14.7 psi) | 1,087 | 230 | 127 | 613 | 117 | 843 | 11 |
| Shuttle EVA prep (26.5%, 10.2 psi) | 43 | 0 | 43 | 0 | 0 | 0 | 0 |
| Exploration (34%, 8.2 psi) | 24 | 0 | 9 | 15 | 0 | 0 | 2 |
| Moon Base bound (30%, 10.2 psi) | 14 | 0 | 8 | 6 | 0 | 0 | 6 |
| Spacesuit (100%, 4.3 psi) | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

For Exploration the statement reads: "No nearby solid-material or smoke tests. No partial-gravity data in this snapshot." For the ISS it reads: "Nearby evidence spans all four fuel classes. Most of these rows use assumed coordinates."

For the Shuttle EVA, Exploration and Mars habitats the site adds one more note: ACME BRE "targeted this atmosphere, but its summary table does not say which tests ran at which pressure, so EMBER does not plot its tests."

The ISS nearby tests come from 14 investigations.

**Careful.** Zero nearby tests is an evidence gap, not a danger sign. A big count is not a safety sign either. Fuel class belongs to the whole investigation, not to each row.

**In the code.** `src/lib/nearby.ts:11-30` (classes), `:74-85` (counts), `:116-133` (gap statement), `:42-45` (BRE note).

### 3.3 The Evidence Coverage score

**Question.** On a 0 to 100 scale, how much real test evidence sits near my habitat's air?

**Idea.** Every test gets a **weight** between 0 and 1. A test right on top of your habitat counts 1. The weight fades smoothly as the test gets further away, like the light from a lamp. An assumed test counts half. Add the weights up to get **N**, the number of "effective tests". Then squeeze N onto 0 to 100 so that the first few tests raise the score a lot and later ones raise it less. This is done three times, once for each fire safety **pillar**, and the three scores are blended.

The three pillars are **prevention** (stopping a fire from starting or spreading), **detection** (noticing it, mostly through smoke), and **suppression** (putting it out). The team gave each investigation one main pillar. Some are "fundamentals", meaning basic flame science that supports all three. These pillar choices are still marked "needs human check" in the data file. The 15 November review covered the assumed values and the gates, not the pillars.

**Formula.**

```
weight of one test   w = a × exp(−0.5 × distance²)
                     a = 1 if both values come from the table, 0.5 if either is assumed

how much a test counts toward a pillar:
                     f = 1    if the pillar is the investigation's main pillar
                     f = 0.3  if the investigation is fundamentals, or lists it as a second pillar
                     f = 0    otherwise

effective tests for a pillar   N = sum of (f × w) over every test
pillar score                   = 100 × (1 − exp(−N ÷ 10))
overall score                  = 0.4 × prevention + 0.3 × detection + 0.3 × suppression
```

- `exp(x)` is e raised to the power x. `exp(−0.5 × distance²)` is the bell curve shape. At distance 0 it is 1. At distance 1 it is 0.61. At distance 2 it is 0.14.
- The 10 is the "saturation". With N = 10 effective tests a pillar scores 63. With N = 20 it scores 86. It can never pass 100.
- All of these constants are design choices by the team. The Methods screen says so.

**Example.** Exploration atmosphere (34%, 8.2 psi).

- The closest test, from 3.1, has distance 0.439 and comes from the table, so w = 1 × exp(−0.5 × 0.193) = **0.908**. ACME CFI-G is a fundamentals investigation, so this test adds 0.3 × 0.908 = 0.27 to each pillar.
- Adding all tests gives N = 8.58 for prevention, 8.57 for detection, and 18.58 for suppression. Suppression is higher because FLEX droplet tests have suppression as their main pillar.
- Prevention = 100 × (1 − exp(−0.858)) = **57.6**. Detection = **57.5**. Suppression = **84.4**.
- Overall = 0.4 × 57.6 + 0.3 × 57.5 + 0.3 × 84.4 = **65.6**, shown as **66**.

Every score here is worked out from unrounded values, so redoing a sum from the rounded numbers shown can change the last digit by 0.1.

Other habitats: ISS 100, Shuttle EVA prep 97, Moon Base bound 79, Mars 66, Spacesuit 0.

The dial draws the **assumed share** with a hatched pattern, and the rest as solid. The assumed share is the part of the effective tests N, blended across the pillars, that comes from rows with an assumed value. For the ISS that is 64%. For Exploration it is under 1%. It is not how much the score would drop without those rows. With every assumed row removed, the ISS still scores 99.5, because its score is already near the ceiling.

**Careful.** This is the most common misreading on the site. **Evidence Coverage is not a safety rating.** A score of 100 means a lot of tests ran in similar air. It says nothing about whether fires there are mild or fierce. A score of 0 means nobody has tested there yet. Mars and Exploration get the same score because they share the same air, and gravity is not in the formula. Inverse gas flame tests count in the score too, although their oxygen value is the burner stream. Without them Exploration would score 56 instead of 66. The site works this out from the data and says so in its method notes on the About page.

**In the code.** `src/lib/coverage.ts:9-15` (constants), `:35-39` (weight), `:51-60` (pillar factor), `:62-63` (0 to 100 squeeze), `:65-117` (whole score). Hatched part at `src/components/Coverage.tsx:49`.

### 3.4 The coverage glow on the map

**Question.** Where on the whole map is evidence thick or thin?

**Idea.** The site works out the overall coverage score at every pixel of the map, as if a habitat sat there. The higher the score, the brighter the glow. It is a heat map of evidence.

**Formula.** The same formula as 3.3, so the glow and the dial cannot disagree. Two speed-ups change nothing visible. Tests at the same point are added up once. Tests further than about 7.7 units away are skipped, because their weight there is below 0.0000000000001 (one ten-trillionth). Brightness = (score ÷ 100)^1.3 × 150 out of 255.

**Example.** The glow is bright around 21% and 14.7 psi, where the ISS score is 100. It is dark around 100% oxygen and 4.3 psi, where the Spacesuit score is 0.

**Careful.** Bright means "well tested", never "safe".

**In the code.** `src/lib/field.ts:11-47`, drawn at `src/components/AtmosphereMap.tsx:146-155`.

### 3.5 Ranking and relevance

**Question.** Which of the 24 investigations should I read first for my habitat?

**Idea.** A simple, open recipe with four ingredients, each from 0 to 1, mixed in fixed amounts. Every card on the site shows its four parts, so you can see why it ranks where it does. The site calls it "a transparent heuristic", which means a reasonable rule of thumb, not a proven method.

**Formula.**

```
A  Atmosphere match = 1 − exp(−N ÷ 5)
     N is the sum of the weights w (from 3.3) of this investigation's own tests.
     A is 0 if it has no test table.
F  Fuel relevance   = 1.0 solid, 0.8 smoke and aerosol, 0.6 liquid, 0.4 gas, 0.3 unknown
     Ground or modelling studies always get 0.3.
P  Pillar focus     = 1.0 if its pillar, or one of its second pillars, matches the pillar you chose, 0.5 otherwise
     1.0 for everyone when no focus pillar is set.
D  Amount of data   = smaller of 1 and  log10(1 + number of tests) ÷ log10(501)
     500 tests or more gives the full 1.

score = 100 × (0.45 × A + 0.25 × F + 0.20 × P + 0.10 × D)
```

Ties are broken by PSI number, smallest first.

**Example.** Exploration atmosphere, no focus pillar.

| Rank | Investigation | A | F | P | D | Score |
|---|---|---|---|---|---|---|
| 1 | ACME CFI-G | 0.989 | 0.4 | 1 | 0.935 | **83.8** |
| 2 | FLEX | 0.865 | 0.6 | 1 | 0.904 | **83.0** |
| 3 | ACME Flame Design | 0.685 | 0.4 | 1 | 0.932 | **70.2** |

The scores are worked out from unrounded parts, so redoing a sum from the rounded parts in the table can change the last digit by 0.1.

For FLEX: its tests add up to N = 10.02, so A = 1 − exp(−10.02 ÷ 5) = 0.865. It has 274 tests, so D = log10(275) ÷ log10(501) = 0.904. Score = 100 × (0.45 × 0.865 + 0.25 × 0.6 + 0.2 × 1 + 0.1 × 0.904) = **83.0**.

The fuel part is why solid material studies still rank 4th to 6th here (BASS-II and BASS at 52.9) even though none of their tests are nearby. Their card then says "Background evidence."

**Careful.** A high rank means "most related to your inputs by this recipe". It is not a quality grade of the science. The four weights and the fuel values are team choices, not measurements.

**In the code.** `src/lib/ranking.ts:18-41` (parts and weights), `:43-72` (one score), `:74-84` (sorting), `:86-91` (the formulas as shown on the site).

---

## 4. The Lab: droplets and gravity

FLEX burned single drops of fuel (methanol or heptane) floating in the space station. These three tools work from its table and the Saffire-II table.

### 4.1 The d-squared law and the burning rate

**Question.** How fast does a burning fuel droplet shrink?

**Idea.** A burning droplet loses its **surface area** at a steady pace, not its width. So if you square the diameter and plot it against time, you get a straight line going down. The slope of that line is the **burning rate constant K**. A bigger K means the droplet burns away faster. This is called the d-squared law.

**Formula.**

```
d(t)² = d0² − K × t
diameter at time t      d(t) = √(d0² − K × t), and never below 0
time to burn away fully      = d0² ÷ K
```

- `d0` is the droplet's starting diameter in millimetres.
- `K` is the burning rate constant in mm² per second.
- `t` is time in seconds.

Sources cited in the code: the law is a classical result (Godsave 1953, Spalding 1953). The FLEX data comes from Dietrich and co-authors, Microgravity Science and Technology, 2014.

**The unit.** In NASA's FLEX file the burning rate column header lost its unit and reads only "mm". EMBER reads it as the burning rate constant in mm² per second. NASA's detailed FLEX results head the same values "Burning rate, mm2/s" (NASA/TP-2015-216046, Table IX). The team reviewed this on 15 November 2026, so gate 2 is on (see 5.3) and the droplet in the Lab is animated.

**Example.** FLEX test 20CAL10: methanol, 21% oxygen, d0 = 1.86 mm, K = 0.6. Time to burn away fully = 1.86² ÷ 0.6 = 3.46 ÷ 0.6 = **5.77 s**.

**Careful.** The law is a simple model. Real droplets can break up (FLEX calls this "disruption") or keep burning invisibly as a cool flame.

**In the code.** `src/lib/droplet.ts:1-25`. Column label fix at `scripts/lib/normalize.mjs:57-62`.

### 4.2 Model end and measured burn time

**Question.** Does the d-squared law agree with the burn time NASA measured?

**Idea.** FLEX also wrote down the diameter at which the visible flame went out. Put that into the law and it tells you when the flame should have gone out. EMBER calls this the **model end**. Compare it with the measured burn time.

**Formula.**

```
model end = (d0² − dExt²) ÷ K
ratio     = model end ÷ measured burn time
```

- `dExt` is the droplet diameter when the visible flame went out.
- If dExt is not smaller than d0, the formula gives zero or a negative time. EMBER then shows "Not defined" instead of a number.

**Example.** FLEX 20CAL10: d0 = 1.86 mm, dExt = 0.94 mm, K = 0.6, measured 5 s. Model end = (1.86² − 0.94²) ÷ 0.6 = (3.460 − 0.884) ÷ 0.6 = **4.29 s**. Ratio = 4.29 ÷ 5 = **0.86**.

One FLEX test (C13H102) lists dExt = 3.34 mm, larger than d0 = 3.33 mm, so its model end is "Not defined".

Across the **195** FLEX tests with all four values and a model end, the median ratio is **0.951**. Half fall between **0.919** and **0.975** (finding I4). C13H102 is left out, because it has no model end. The check still includes tests that ended in disruption, where NASA lists the final diameter. The Lab says so.

**Careful.** This is not an independent test of a fire model. Each prediction uses K from the same row, and K was itself worked out from the same burn. So it only checks that the table agrees with the law. A median ratio is not an error bound. The droplet in the Lab follows this law as it shrinks (gate 2 in section 5 is on).

**In the code.** `src/lib/droplet.ts:15-17` (model end), `:36-67` (all-tests check). Lab readout at `src/screens/Lab.tsx:175-182` and `:356-366`.

### 4.3 Extinction ratio, its bins and medians

**Question.** At what size did the flame go out, and does that change with oxygen?

**Idea.** Divide the diameter when the flame went out by the starting diameter. Near **1** means the flame died almost straight away. Near **0** means the flame lasted until the droplet was almost gone. Then group the tests into oxygen bins and take the median of each bin.

Only tests that ended in extinction are used. Tests that ended in disruption or burned to completion also list a final diameter in NASA's table, but it is not the diameter at which the flame went out, so they are left out.

**Formula.**

```
extinction ratio = dExt ÷ d0
bins (oxygen fraction): 0.10, 0.14, 0.18, 0.22, 0.26, 0.30, 0.34, 0.38
```

Each bin runs from its lower edge up to, but not including, the next edge. The last bin includes 0.38.

**Example.** FLEX 20CAL10 ended in extinction: 0.94 ÷ 1.86 = **0.51**.

Methanol medians by bin, extinction tests only:

| Oxygen | 10 to 14% | 14 to 18% | 18 to 22% | 22 to 26% | 26 to 30% | 30 to 34% | 34 to 38% |
|---|---|---|---|---|---|---|---|
| Tests | 13 | 33 | 47 | 8 | 0 | 2 | 0 |
| Median ratio | 0.74 | 0.82 | 0.51 | 0.46 | none | 0.41 | none |

Heptane, by the same bins: 1, 14, 34, 7, 0, 0 and 0 tests.

The Lab also compares nitrogen-only gas with carbon dioxide gas, but **only** where a bin holds at least 5 tests of each, for the same fuel. Three bins qualify: methanol at 14 to 18% (6 and 19 tests), methanol at 18 to 22% (11 and 26), and heptane at 18 to 22% (8 and 17). If none qualified, the site would say it "makes no claim that one added gas beats another".

**Careful.** The bins mix pressures and, unless split, mix added gases. They show a direction, not a limit. A flame going out early is not proof that all burning stopped, because FLEX also found cool flames.

**In the code.** `src/lib/droplet.ts:28-30` (ratio), `src/lib/lab.ts:55-86` (extinction tests only, and the bins), five-test rule at `src/screens/Lab.tsx:519-532`.

### 4.4 Gravity pairs (Saffire-II)

**Question.** Does a material burn further in space or on Earth?

**Idea.** Saffire-II burned the same kinds of sample once in microgravity (on a cargo ship) and once in normal gravity. Each sample therefore gives a pair of burn lengths. EMBER puts each pair side by side.

**Formula.** No arithmetic beyond reading the text. NASA wrote lengths as words and approximations, so EMBER reads them like this:

```
"Complete"   -> the full sample length (29 cm)
"~ 10 cm"    -> 10 cm, flagged as approximate
"~ 0"        -> 0
```

Then it compares the two numbers: shorter, the same, or longer in microgravity. Samples of two mixed materials (such as "PMMA & Nomex") are shown but left out of the comparison.

**Example.** Sample 2-1, silicone 0.27 mm thick: microgravity "~ 0", normal gravity "Complete". That reads as 0 cm against 29 cm, so it is **shorter in microgravity**. Overall, 5 of 8 single-material samples burned shorter in microgravity and 0 longer (finding I7). Of the other 3, 2 burned the full length in both, and 1 (sample 2-3) barely burned in either.

**Unconfirmed thickness.** Some thicknesses are written "037 mm" in NASA's table. EMBER shows it exactly as written. The site says it "is likely 0.37 mm, but that is unconfirmed until the team's science lead checks it." The likely value is never stored or used as a measurement.

**Careful.** This is 9 samples, at one flow speed and about 22% oxygen. It bounds the gravity question and does not settle it. No test ran at Moon or Mars gravity.

**In the code.** `src/lib/lab.ts:91-115`. Text reading at `scripts/lib/normalize.mjs:232-239`.

---

## 5. The habitat flame picture and its two gates

The animated fireball on the habitat screen is an **illustration**. It is marked "SI-generated illustration" on the page. Each thing it does has one of three bases, and the readout says which: "From the NASA tables", "Direction from a NASA source", or "By definition".

### 5.1 The three readout numbers

**Question.** What do NASA's tables say about a flame near my habitat's oxygen level?

**Idea.** Three lookups, each a median or a share of nearby tests.

**Formula.**

```
Burn rate   = median K of FLEX tests within 3 oxygen points, nitrogen only
              If none: a straight line between the nearest tested oxygen levels
              on each side. The tile then says "between tests".
Went out    = (nitrogen-only FLEX tests within 3 oxygen points that ended in extinction)
              out of (all nitrogen-only FLEX tests within 3 oxygen points)
              These are the same tests as the burn rate. If there are none, the tile says "none".
Flame temp  = median "Tad (K)" of normal ACME gas flames within 5 oxygen points,
              leaving out inverse flames and cool flames
```

"Tad (K)" is the **calculated adiabatic flame temperature**: the hottest the flame could get if it lost no heat (see the glossary). It is worked out, not measured. Inverse flames are left out because their oxygen value is the burner stream. Cool flames are left out because, for them, the column describes a hot flame that never happened.

These three windows look at **oxygen only**, not pressure.

**Example.**

| Habitat | Burn rate | Went out | Flame temp |
|---|---|---|---|
| ISS (21%) | 0.51 from 39 tests | 23 of 41 | 2,197 K from 108 tests |
| Exploration (34%) | 0.715 from 8 tests | 0 of 9 | 2,634 K from 132 tests |
| Shuttle EVA prep (26.5%) | 0.6, between tests | none | 2,198 K from 24 tests |

The Shuttle EVA case shows the straight line. No nitrogen-only FLEX test sits within 3 points of 26.5%. The nearest tested levels are 21% (median 0.52) and 30% (median 0.65). 26.5% is 0.055 ÷ 0.09 = 61% of the way between them, so the rate is 0.52 + 0.61 × (0.65 − 0.52) = **0.60**. The same gap empties "Went out": the 25 FLEX tests within 3 points of 26.5% all had carbon dioxide or helium added, so the tile shows "none" with the note "no nitrogen-only test".

**Careful.** Because the windows ignore pressure, "Went out 0 of 9" for Exploration includes nitrogen-only FLEX tests at any pressure between 31% and 37% oxygen. It is not a test of 8.2 psi air.

**In the code.** `src/lib/flame.ts:10-85`. Tiles at `src/components/FireballStage.tsx:127-177`.

### 5.2 How the picture is driven

**Question.** What makes the fireball look calm or fierce, hot or cool, solid or faint?

**Idea.** Each look is a dial from 0 to 1, set from the numbers above or from the habitat itself.

**Formula.** "clamp" means: keep the value between 0 and 1.

| Dial | Formula | Basis |
|---|---|---|
| How fast it seethes | clamp((burn rate − 0.3) ÷ 0.45). 0.25 if there is no rate. | From the NASA tables |
| How hot the brightest part looks | (flame temp in K − 300) ÷ 2,700, from the calculated adiabatic flame temperature of normal ACME flames. 2,300 K if no test is near. | From the NASA tables |
| Holds, struggles or goes out | share = went out ÷ all, over the nitrogen-only FLEX tests. Above 0.9 "failing", 0.5 or more "struggling", else "steady". | From the NASA tables |
| Solid or ghost | clamp(droplet tests within 1 unit ÷ 10). Zero droplet tests gives a ghost and names the nearest one. | From the NASA tables |
| Blue or yellow (camera view) | clamp((oxygen − 0.17) ÷ 0.17) | Direction from a NASA source |
| Haze density | clamp(psi ÷ 14.7) | By definition |
| Drift and lean | clamp(flow in cm/s ÷ 50), lean = that × 0.35 | Direction from a NASA source |
| Shape | fireball at 0 g, Earth flame at 1 g | From the NASA tables |

The colour scale runs from 300 K to 3,000 K. Its two labels, 300 K for cabin air and 2,300 K for a typical flame, come from NASA's Researcher's Guide to Combustion Science. It runs on to 3,000 K because the ACME "Tad (K)" column reaches 2,978 K.

At Moon or Mars gravity the site shows the microgravity shape with a badge: "No partial-gravity tests exist. This is the microgravity shape."

**Example.** Exploration: seethe = (0.715 − 0.3) ÷ 0.45 = **0.92**. Heat = (2,634 − 300) ÷ 2,700 = **0.86**. Went out share 0 so "steady". 9 droplet tests sit within one unit, so the solid-or-ghost dial is 9 ÷ 10 = **0.9**. The Spacesuit has no droplet test within one unit, so it is a **ghost**. The site names the nearest droplet test instead: "34 percent oxygen and 10.3 psi".

**Careful.** The picture shows what the tables say near these numbers. It is not a simulation of a real fire in that habitat.

**In the code.** `src/three/flameParams.ts:50-85`, colour scale at `src/three/ramp.ts:23-32`.

### 5.3 The two gates

Two switches control two parts of the picture. Each waited on a check of one fact. The EMBER team reviewed both on 15 November 2026, and both are **on** at `main`.

| Gate | The fact it rests on | Source the team checked | Effect now that it is on |
|---|---|---|---|
| `tadConfirmed` | The ACME column headed "Tad (K)" is the calculated adiabatic flame temperature, a calculated upper temperature. | Irace and co-authors, Combustion and Flame 2021, and the CFI-G investigator's thesis (Kim, University of Maryland 2022, Table E.2), which lists the same value as the PSI table for one test. | The mark on the temperature scale moves with the habitat. |
| `burningRateUnitConfirmed` | The FLEX burning rate unit is mm² per second. | NASA/TP-2015-216046, Table IX, which heads the same values "Burning rate, mm2/s". | The droplet in the Lab is animated. |

The About page states both, in these words: "The mark on the temperature scale moves with the habitat. It shows the calculated adiabatic flame temperature from the ACME column headed Tad (K), the median of normal hot flames near the chosen oxygen. Inverse flames and cool flames are left out. The droplet in the Lab is animated, with the FLEX burning rate read in mm² per second. Both readings were reviewed by the EMBER team on 15 November 2026 against NASA/TP-2015-216046 and the ACME publications. A combustion researcher should confirm before this is used for design."

**Careful.** A team review is not a researcher's review, and the site says so. The gates only ever controlled those two things. The temperature always set the flame colour, and the burning rate always set how fast it seethes.

**In the code.** `src/three/flameParams.ts:12-23`. Used at `src/components/FireballStage.tsx:95` and `src/screens/Lab.tsx:181`.

---

## 6. The twelve findings in insights.json

Each finding card is built by the code from the snapshot. The wording is filled in from the numbers. The build then checks every number twice. Level 1 works the numbers out again from the snapshot. Level 2 works the headline numbers out again straight from NASA's raw CSV files, using separate short code, so it can catch a bug in the main reader. Each card says "computed from PSI snapshot, wording drafted by SI and reviewed by the team" and carries `reviewed: false` until a person reads it.

Each card below gives its headline today, then how it is worked out.

### I1. The solid material oxygen ceiling

**Headline.** "Solid material tests in PSI that state their oxygen stop at 22.2%. A Moon Base is planned at 30% or more."

**How.** Take every solid material test whose table states its oxygen (140 tests). Take the largest oxygen value. It is 22.2%, in BASS-II. Count solid tests at 30% or above: **0**. The other 123 solid tests, in BASS and Saffire-III, have no oxygen in their tables, so they are left out and the card says so. (Saffire-III now has an assumed 21.2% from a paper, but it is still not from its table.)

**Careful.** It means no PSI solid test stated a higher oxygen. It does not mean solids cannot burn above 22.2%.

**In the code.** `scripts/lib/insights.mjs:34-59`.

### I2. The Moon Base region

**Headline.** "Inside the Moon Base region PSI holds 66 tests, and all 66 are gas flames, 46 of them inverse flames whose oxygen is the burner stream, not the chamber. 0 solid, 0 liquid."

**How.** The region rule from 2.3. Also counts every test at 30% oxygen or more at any pressure: 507 (483 gas, 24 droplet, 0 solid). 17 FLEX droplet tests sit on the edge, at 10.3 to 10.5 psi.

**In the code.** `scripts/lib/insights.mjs:61-97`.

### I3. Partial gravity

**Headline.** "PSI holds 0 partial-gravity combustion investigations. All 24 are microgravity or ground studies."

**How.** Count the "Project Type" field: 19 microgravity, 5 ground, 0 partial gravity.

**In the code.** `scripts/lib/insights.mjs:99-118`.

### I4. The d-squared law against FLEX

**Headline.** "The d-squared law's predicted FLEX burn time has a median of 0.951 times the measured one, across 195 tests. That is a median ratio, not an error bound."

**How.** Section 4.2, over every FLEX test with all four values and a model end. C13H102 is left out, because its extinction diameter is not smaller than its starting diameter. Quartiles 0.919 and 0.975. The Level 2 check from the raw CSV leaves out the same test and gets the same numbers.

**In the code.** `scripts/lib/insights.mjs:120-136`, using `validateDSquared` in `src/lib/droplet.ts:36-67`.

### I5. Extinction against oxygen

**Headline.** "In FLEX, flames went out in 27 of 28 droplet tests at 10 to 15% oxygen and in 2 of 24 at 28 to 36%."

**How.** Count FLEX tests whose "Test end" is "Extinction", in four oxygen bands: 10 to 15%, 15 to 19%, 19 to 23%, 28 to 36%. A band runs from its lower edge up to, but not including, its upper edge. Results: 27 of 28, 76 of 87, 63 of 91, 2 of 24. Then the median extinction ratio (section 4.3), read only where the flame went out: **0.82** in the lowest band, over 22 tests, and **0.41** in the highest, over 2 tests. Tests that ended in disruption or burned to completion are left out of the ratio.

**Careful.** These bands are not the Lab's bins. They mix fuels, pressures and added gases, so they show a direction and not a limit. The high band's median rests on only 2 tests.

**In the code.** `scripts/lib/insights.mjs:15-21` (bands) and `:138-193`.

### I6. FLEX outcomes by fuel

**Headline.** "186 of 274 FLEX droplet tests ended with the visible flame going out before the fuel was gone."

**How.** Count the "Test end" column by fuel. Methanol, 157 tests: 126 extinction, 23 disruption, 8 completion. Heptane, 117 tests: 60 extinction, 38 disruption, 19 completion.

**In the code.** `scripts/lib/insights.mjs:195-234`.

### I7. Saffire-II, microgravity against normal gravity

**Headline.** "In Saffire-II, 5 of 8 single-material samples burned a shorter length in microgravity than in normal gravity. 0 burned longer."

**How.** Section 4.4. The card reads: "2 samples burned the full length in both, and 1 barely burned in either." 3 of the shorter ones were silicone.

**In the code.** `scripts/lib/insights.mjs:236-266`.

### I8. BASS-II materials

**Headline.** "BASS-II burned 129 solid samples in 7 material groups, at 13.6% to 22.2% oxygen."

**How.** NASA's sample names are free text. EMBER sorts them into families by key words, such as "rod" for PMMA rods and "sibal" or "cotton" for the cotton and fiberglass fabric. Then it counts each family and finds its oxygen range. PMMA rods lead with 54 tests. Pressure is not in the table and is assumed to be one atmosphere.

**In the code.** `scripts/lib/insights.mjs:268-304`, families at `src/lib/parse.ts:116-128`.

### I9. SAME-R smoke tests

**Headline.** "SAME-R made smoke from 5 materials in 109 tests and let it age for 21 s to 1,923 s before measuring it."

**How.** Count the "Sample Type" column (Kapton 29, Silicone 22, Lampwick 20, Pyrell 20, Teflon 18). Find the smallest and largest "Net aging time" among the 104 tests that list one. The atmosphere is not in the table and is assumed to be cabin air.

**In the code.** `scripts/lib/insights.mjs:306-331`.

### I10. The highest oxygen tested anywhere

**Headline.** "The highest oxygen level in any PSI combustion test is 85%, in 131 inverse gas flame tests."

**How.** The largest oxygen value in any table, then every test within 0.05 percentage points of it: ACME Flame Design 52, ACME CFI-G 79. All are inverse flames, so 85% is the oxygen of the burner stream, not of a cabin (see 1.4).

**In the code.** `scripts/lib/insights.mjs:333-351`.

### I11. Archive size

**Headline.** "The 24 combustion investigations hold 13.5 TB of archived data. The test tables EMBER reads are a summary of it."

**How.** Add up each investigation's "totalFileSize". 1 TB here is 1,000,000,000,000 bytes. The three largest are ACME Flame Design 2.2 TB, ACME CFI-G 2.1 TB and ACME BRE 2.0 TB.

**Careful.** EMBER does not read the 13.5 TB. It reads the summary tables, one row per test.

**In the code.** `scripts/lib/insights.mjs:353-371`.

### I12. Evidence Coverage for each habitat

**Headline.** "Evidence Coverage is 100 out of 100 near the ISS cabin and 66 near the Exploration atmosphere."

**How.** Section 3.3 for each of the six habitats, rounded to a whole number: ISS 100, Shuttle EVA prep 97, Exploration 66, Moon Base bound 79, Mars 66, Spacesuit 0. The card says the score "weights every flight test by how close it is to each atmosphere".

**Careful.** It is not a safety rating.

**In the code.** `scripts/lib/insights.mjs:373-400`. Both checks at `scripts/lib/verify.mjs`.

---

## 7. Search and CSV export

### 7.1 Search

**Question.** How does the search box decide what matches?

**Idea.** Split what you typed into words. A test or investigation matches only if **every** word appears **somewhere** in its text, in any order. Capital letters do not matter. Part of a word counts, so "sili" finds "silicone".

**Formula.**

```
words   = your text, lower case, split on spaces
matches = every word is found inside the item's text
```

A test's text is its id, label, investigation, fuel, fuel class, outcome and source table. An investigation's text is its names, id, plain summary and every fuel its tests list. An empty search matches everything. On the dashboard a search is cut to 80 characters and narrows the same tests as the other filters, so the map, table and counts always agree.

**Example.** "silicone" finds **27** tests: 22 in SAME-R, 4 in Saffire-II and 1 in SAME. "methanol extinction" finds **126** tests, the FLEX methanol tests whose outcome is extinction.

**Careful.** This is plain word matching, not meaning. "fabric" does not find "SIBAL" unless the word "fabric" is in the text.

**In the code.** `src/lib/search.ts:7-30`, filter scope at `src/lib/mapScope.ts:29-63`.

### 7.2 CSV export

**Question.** What is in the downloaded spreadsheet?

**Idea.** One row per test, in 23 fixed columns, with values as EMBER stored them after the unit conversions. The file is made in your browser. Nothing is sent anywhere.

**Formula.** No arithmetic. The columns include `o2_fraction`, `o2_source`, `pressure_atm`, `pressure_source`, `burning_rate_mm2_s`, `listed_flame_temperature_k` and `flags`. A source column says "table" or "assumed". A cell holding a comma or a quote mark is wrapped in quotes. The file name names the filter, with anything that is not a letter or digit turned into a dash, cut to 80 characters.

**Example.** FLEX 20CAL10 exports as `0.21,table,1.002632,table,...,1.86,0.94,0.6,5,,label-corrected`. A filter of BASS-II, solid and "silicone rubber" saves as `ember-BASS-II-solid-silicone-rubber-tests.csv`. No filter saves as `ember-plotted-tests.csv`.

**Careful.** Pressure is in atm, not psi, and oxygen is a fraction, not a percent. Assumed values are marked in the source columns and never presented as measured.

**In the code.** `src/lib/csv.ts:5-52`.

---

## 8. How the chat finds its evidence

The chat works in two stages. First it **finds** evidence with rules that run in your browser. Only then, when the live answer is switched on, does it send that evidence to a language model. Then it **checks** the model's answer. If the live answer is off, you still see the evidence.

Before either stage, a **topic screen** reads the question. It passes if the question holds one fire word, such as "flame" or "oxygen", or an investigation name such as FLEX, or two everyday subject words, such as "test" and "habitat". It refuses requests to change the assistant's rules. The browser and the server run the same screen, so an off-topic question sends nothing. A **question limit** also applies: 6 a minute and 60 an hour.

### 8.1 Reading numbers and names out of the question

**Question.** Does the question mention an oxygen level, a pressure, a material or an investigation?

**Idea.** Simple pattern spotting, like a highlighter running over the question.

**Formula.**

```
oxygen   = a number followed by "%" or "percent", with "oxygen" or "O2" right beside it,
           kept only from 10% to 100%
pressure = a number followed by "psi", kept only from 3 to 80 psi
material = the first of a fixed list (pmma, nomex, silicone, methanol, ...) found in the text
named    = any investigation whose name or PSI number appears in the text
```

Short all-capital names such as SAME and BASS must be typed in capitals, so the ordinary word "same" does not count.

So "20% carbon dioxide" or "a 50% heptane mix" does not set an oxygen level.

If it finds any of these, the chat lists matching test rows: oxygen within 1.5 points, pressure within 10%, the material, and the named investigation. It shows the full count of matching tests, lists the first 4, and shows the filter it used. It keeps at most 300 rows, but the count is taken before that cut. If the question names an investigation and none of its tests match, the chat says "No matching tests" and does not fall back to other investigations. It may also move your habitat to the numbers, but only for oxygen of 12% or more and pressure of 15 psi or less, and not when the named investigation has no match.

**Example.** "Has anything burned at 34% oxygen and 8.2 psi?" reads as oxygen 0.34 and pressure 8.2 psi, and finds 1 matching test. "Which tests used 21% oxygen?" shows "1,102 matching tests, first 4 listed". "Which tests used silicone in Saffire-II?" reads as material silicone and investigation Saffire-II (PSI-99), and finds 4. "Which BASS tests used 85% oxygen?" finds none: "None of BASS's tests match." "Is the same thing true for BASS?" names only BASS.

**In the code.** `src/lib/retrieve.ts:72-145`. Count and list at `src/components/chat/ChatPanel.tsx:155-191`. Topic screen at `src/lib/topic.ts:108-122`, question limit at `src/lib/rateLimit.ts:6-9`.

### 8.2 Is there any evidence at all?

**Question.** Should the chat answer, or say it has no evidence?

**Idea.** Drop small common words such as "the" and "what". At least **40%** of the words left must match something in EMBER's index, and at least one must. If the meaning model has loaded, a strong match by meaning (a score of 0.3 or more) also passes. If neither passes, the chat says it has no evidence instead of guessing.

**Example.** "What did FLEX find about methanol?" leaves "flex" and "methanol". Both match, so it passes.

**In the code.** `src/lib/retrieve.ts:16-18` and `:54-62`, used at `:162`.

### 8.3 Ranking the evidence

**Question.** Which pieces of evidence go to the model?

**Idea.** Two search methods each make a top-20 list. Keyword search counts matching words, giving extra weight to matches in a name or title. It also adds related words from the glossary, for example "lunar" for Moon. Meaning search, once its small model has loaded in your browser, compares the question with each document as a list of 384 numbers. The two lists are then merged by rank.

**Formula.**

```
keyword boosts:   acronym × 4, title × 3, keywords × 2, summary × 2, body × 1
meaning score:    cosine similarity (how closely two arrows point the same way, from −1 to 1)
merge:            each list adds 1 ÷ (60 + rank) to a document, rank counting from 1
kind weight:      finding 1.25, investigation or material 1.0, table or glossary 0.9,
                  method or habitat or hardware 0.8, context 0.7
then:             × 2.5 for hardware when you ask about hardware,
                  × 1.8 for a glossary entry when you ask "what is a ...",
                  × 0.8 for findings when you ask "which" or "list",
                  × 1.15 when the item applies to your current habitat
an investigation named in your question goes first
```

The pack holds at most **6** items, with at most **4** investigations (5 for a "which" or "list" question). If you mention "score" or "coverage", the coverage method is added. If you mention "rank", the ranking method is added. The server accepts at most 8 evidence ids, 9,000 characters of evidence, and a question of 300 characters.

**Example.** A document ranked 1st by keyword and 3rd by meaning gets 1 ÷ 61 + 1 ÷ 63 = 0.0323. A document ranked 1st in only one list gets 1 ÷ 61 = 0.0164. Agreement between the two methods wins.

**Careful.** If the meaning model has not loaded, keyword search answers alone, and no message is shown.

**In the code.** `src/lib/retrieve.ts:20-34` and `:157-210`. Meaning at `src/lib/meaning.ts:15-64`. Server caps at `server/config.ts:20-23`.

### 8.4 Checking the answer

**Question.** How does EMBER stop the model from inventing numbers?

**Idea.** The answer is cut into pieces at each citation mark such as `[I5]`. Each piece must pass four checks against the evidence it cites. A piece that fails is removed. The answer is shown only if at least two pieces pass.

**Formula.**

```
a piece is removed if:
  it cites nothing
  it cites an id that is not in the evidence pack
  it contains a number not found in its cited evidence or in the habitat line
  it calls something "safe" or "unsafe", or a "safety rating" without "not"
  it shares fewer than 3 meaningful words with its evidence,
     or fewer than 35% of its meaningful words
verdict = shown if 2 or more pieces pass, otherwise rejected
```

Numbers are compared after tidying, so "22.20%" matches "22.2%" but "22%" does not.

**Example.** "FLEX flames went out in 27 of 28 tests at 10 to 15% oxygen [I5]" passes, because 27, 28, 10 and 15 all appear in finding I5. Change 27 to 26 and that piece is removed.

**Careful.** The site's badge says only "Sources and numbers checked". The check proves that the ids and numbers match the evidence. It cannot prove that a sentence means what its source means. The six example questions have prepared ("pinned") answers, but all six are marked not reviewed, so the site does not show them.

**In the code.** `src/lib/grounding.ts:25-128`. Flow at `src/components/chat/ChatPanel.tsx:271-387`.

---

## 9. Glossary

- **Adiabatic flame temperature (Tad).** The hottest a flame could get in theory, if no heat escaped. A calculated upper limit, not a measurement. The site calls the ACME "Tad (K)" column the "calculated adiabatic flame temperature". The team reviewed this reading on 15 November 2026 (gate 1, now on).
- **Assumed value.** A missing oxygen or pressure filled in by the team from the NASA record or a published paper. Reviewed by the team on 15 November 2026. Marked, drawn hollow, and counted at half weight.
- **atm (atmosphere).** Air pressure at sea level. EMBER stores every pressure in atm.
- **Bar.** A metric pressure unit. 1 bar = 0.98692 atm.
- **Burning rate constant (K).** How fast a droplet's squared diameter shrinks, in mm² per second. The unit comes from NASA/TP-2015-216046, Table IX (gate 2, now on).
- **Cool flame.** A faint, low-temperature burning that can go on after the visible flame goes out.
- **Coverage (Evidence Coverage).** A 0 to 100 score of how much test evidence sits near a habitat's air. Not a safety rating.
- **d-squared law.** The rule that a burning droplet's diameter squared falls in a straight line over time.
- **Day-level.** One ACME table row covering a whole test day with several oxygen levels. EMBER splits it into one test per level.
- **Distance (unit).** EMBER's one number for how different two airs are. 4 oxygen points, or a pressure ratio of about 1.28, is one unit.
- **Effective tests (N).** The sum of all test weights. Close, measured tests add almost 1 each. Far or assumed tests add less.
- **Extinction.** The visible flame went out before the fuel was gone. Not proof that all burning stopped.
- **Extinction ratio.** Diameter at flame-out divided by starting diameter.
- **Fuel class.** Solid, liquid, gas, or smoke and aerosol. Set per investigation by the team.
- **Fundamentals.** Basic flame science that supports all three pillars. Counts 0.3 toward each.
- **Ghost.** The faint fireball drawn when no droplet test sits within one unit.
- **Inverse flame.** Oxygen-rich gas blown into fuel. Its oxygen value is the burner stream, not the room.
- **Investigation.** One NASA experiment in PSI, such as FLEX. 24 in EMBER.
- **Log scale.** An axis where each step multiplies the value by the same amount.
- **Median.** The middle value after sorting.
- **Microgravity.** The near weightlessness on the space station. Flames there are round.
- **mmHg.** Millimetres of mercury. 760 mmHg = 1 atm.
- **Model end.** When the d-squared law says the visible flame should go out.
- **Moon Base region.** 30% oxygen or more at 10.2 psi or less, from the challenge statement.
- **Nearby.** Within one unit of distance. Gravity is not part of the rule.
- **Normoxic curve.** The oxygen percent that gives sea level oxygen per breath at each pressure.
- **Oxygen fraction.** Share of the gas that is oxygen, from 0 to 1. 0.21 is normal air.
- **Partial gravity.** Moon (0.166 g) or Mars (0.38 g) gravity. No PSI test ran there.
- **Pillar.** One of prevention, detection or suppression.
- **PSI.** NASA's Physical Sciences Informatics system, where the data comes from. Not the same as the unit psi.
- **psi.** Pounds per square inch, a pressure unit. 14.7 psi is sea level.
- **Quartile.** The values a quarter and three quarters of the way through a sorted list.
- **SI.** Super Intelligence, the term the NASA Space Apps Challenge uses for AI. The site marks what SI drafted, and the team reviewed it.
- **Test.** One row of a NASA table, or one oxygen level of an ACME day-level row. 2,029 in EMBER, from 2,009 table rows. Two rows that record no test are left out.
