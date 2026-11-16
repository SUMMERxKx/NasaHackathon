# EMBER pitch script (3 minutes)

Team Low Cortisol Gng: Jesse, Samar, Pasang, Daniel. NASA Space Apps Challenge 2026, Flame in Freefall.

Deck: EMBER-pitch-v7.pptx. Live site: https://ember-two-eta.vercel.app

Read the script part aloud. The background notes are for answering questions, not for reading.
Spoken script: about 378 words, under 3 minutes at a normal pace.


## Slide 1: Jesse. 0:00 to 0:10.

**Script**

Hi, we are Low Cortisol Gng. Our question is simple. How do we keep every crew safe from fire in space?

## Slide 2: Jesse. 0:10 to 0:27.

**Script**

On Earth, hot air rises and pulls a candle flame into a teardrop. In space nothing rises, so the flame becomes a slow blue ball. It can spread in surprising ways, and smoulder out of sight.

## Slide 3: Jesse. 0:27 to 0:54.

**Script**

Here is the real problem. NASA has already run hundreds of fire tests in space and shared the data. But it sits in 22 separate technical tables, each in its own format. Astronauts live on stations and spacecraft today, and tomorrow in Moon and Mars bases and rovers. They need fire answers, and nobody can easily see what has been tested and what has not.

## Slide 4: Samar. 0:54 to 1:12.
*(Click once: the EMBER start screen fades in)*

**Script**

So we built EMBER. It is one dashboard with every NASA fire test, cleaned into a single dataset. You pick a crew home, see which tests apply and where the gaps are, filter and search the data, and ask an AI assistant that cites NASA's sources.

<details><summary>Background notes (do not read aloud)</summary>

- Crew home, or habitat: any place people live and breathe in space, such as the space station, a spacecraft cabin, a Moon or Mars base, a rover or a spacesuit.
- Atmosphere: the air inside that home, meaning how much of it is oxygen and how hard it presses (its pressure). In EMBER each crew home is described by these two numbers.
- Oxygen percentage: how much of each breath is oxygen. Air on Earth is 21 percent. Some planned Moon and Mars bases use 30 to 34 percent.
- Pressure: how thick the air is. Earth at sea level is 14.7 psi. A Moon or Mars base may use about 8 to 10 psi, like air high on a mountain, which saves weight and makes spacewalks quicker to start.
- Why richer air matters: fire feeds on oxygen, so when a bigger share of the air is oxygen, most materials catch fire more easily and burn faster, even at lower pressure.
- Nearby tests: NASA tests run in air close to the chosen home's air, within about 4 points of oxygen or about 25 percent of pressure. A nearby test is evidence. It is not a test of that home and not proof that it is safe.
- Gaps: a kind of fuel (solid materials, liquid fuels, gas flames, smoke) with no nearby tests, or a gravity, like the Moon's or Mars's, with no data at all.
- The crew homes you can pick on the dashboard: ISS cabin, Shuttle EVA preparation, Exploration atmosphere, Moon Base bound, Mars surface habitat, Spacesuit, plus a Custom one where you set the oxygen, pressure, gravity and air flow yourself. Each one is just a different air mix, and EMBER shows the NASA tests run in similar air.

</details>

## Slide 5: Samar. 1:12 to 1:40.
*(Screenshot 1 shows when the slide opens. Click once before each next line, four clicks in all)*

**Script**

Start with the space station. Over a thousand tests sit close to its air.
Switch to a Moon or Mars base. Only 24, none on solid things like fabric.
The map puts every crew home beside every test.
Search and filter every test.
Or ask our AI. Every answer lists its NASA sources.

<details><summary>Background notes (do not read aloud)</summary>

- Crew homes you can pick: ISS cabin, Shuttle EVA preparation, Exploration atmosphere, Moon Base bound, Mars surface habitat and Spacesuit, or Custom with your own oxygen, pressure, air flow and gravity. Dragging the ring on the map also moves the home.
- Search: one box that looks in test ids and labels, investigation names, fuels or materials, fuel classes, outcomes and table names. Every word typed must match.
- Filter by pillar: Prevention, Detection, Suppression or Fundamentals (what the test helps with).
- Filter by fuel or material class: Solid, Liquid, Gas, or Smoke and aerosol.
- Filter by investigation: any one of the 20 NASA investigations that have test rows.
- Filter by hardware: the Combustion Integrated Rack with the ACME insert or the droplet insert, the glovebox with the SPICE flow duct, the Cygnus cargo vehicle, or smoke and aerosol instruments.
- Search and filters always narrow the same tests, and the map, table, counts and CSV all follow them.
- Table view: the same tests as rows, nearest first, sortable by investigation, test, fuel, class, oxygen, pressure and distance. Click a row to see NASA's original row.
- Download this view (CSV): saves exactly the tests in view.
- Zoom: pinch, or Ctrl or Command with the scroll wheel. Shift and drag zooms to a box, a drag pans, and there is a Moon zoom button and a reset. Every chart with number axes zooms the same way.
- Coverage glow: an optional layer that glows where NASA has flown tests.
- Investigations screen: the same search and filters, plus a filter by what each one informs (detectors, extinguishers, material screening, atmosphere design) and by project type, a sort, and Compare for two or three investigations side by side.
- Every number on screen opens the NASA rows behind it, down to the raw row and a link to psi.nasa.gov.

</details>

## Slide 6: Pasang. 1:40 to 2:16.

**Script**

Can you trust it? NASA shared its results as 22 tables, each in its own format. We cleaned them into one list of 2,029 tests. We never overwrite NASA's numbers. Every test keeps NASA's original row beside our cleaned version, so you can always check us. Where a table had an obvious typo, like 3400 where NASA meant 34, we fixed it and labelled the fix. Where a value was missing, our guess is clearly marked.

<details><summary>Background notes (do not read aloud)</summary>

- What cleaning means here: NASA published 22 tables, each with its own column names, units and layout. We read every one into a single list where every test has the same fields: fuel, fuel class, oxygen, pressure, air flow and outcome.
- Rows and tests: the 22 tables hold 2,009 rows. A row that lists several oxygen levels for one test day becomes one test per level, and note rows are kept apart, which gives 2,029 tests.
- What was converted: oxygen written as a percent or as a fraction now uses one scale, and pressure given in bar or mmHg is converted to atmospheres. The site shows pressure in psi too. 1 atmosphere is 14.7 psi.
- Typo fixes: 34 test rows carry a typo-fixed flag. An ACME BRE oxygen cell reads 3400%, which we read as 34. In two ACME tables the fuel names count up (CH5, CH6 and so on), and we read them as the fuel in the first row. Each fix is flagged on the test.
- Label corrections: 6 column headers lost a symbol in NASA's files, such as O2 printed as O in the FLEX table, or the micro sign in Saffire-II. EMBER shows the corrected label, keeps the original, flags every affected test, and lists all 6 on the About screen under Label corrections.
- Cells that look wrong but are not confirmed, such as some Saffire-II sample thicknesses, are not changed. They are shown exactly as NASA wrote them and marked as needing a check.
- Nothing is overwritten: every test keeps NASA's raw row, cell for cell, beside what EMBER read from it. Open any test and the raw row sits right under it.
- Assumed value: when a table does not state the oxygen or pressure, for example a test run in the station's own cabin air, EMBER uses a declared value such as 21 percent oxygen at 1 atmosphere. There are 12 declared assumptions. 886 tests have at least one assumed value and 721 have an assumed oxygen value.
- How assumed values are shown: hollow marks on the map, the word assumed in every table, half weight in the coverage score, and never presented as measured.
- Review: the team reviewed all 12 assumptions on 15 November 2026. 9 were confirmed and 3 changed, each now citing a published source. The site says: Reviewed by the EMBER team on 15 November 2026. A combustion researcher should confirm before this is used for design. That researcher review is one of our next steps.
- What the review changed: ACME BRE's tests left the map because its table does not say which test ran at which pressure. DAFT's 2 dust tests left it because no source gives their oxygen. Saffire-III's 2 tests joined it at 21.2 percent oxygen, from a published paper. Two rows that record no test were dropped and listed on the About screen. 1,893 tests are now on the map, and the station cabin has 1,087 nearby tests.
- Tracing a number: every number on screen opens the rows behind it, then one test, then NASA's raw row and a link to that investigation on psi.nasa.gov. The build also checks the headline numbers twice, once from our cleaned list and once straight from NASA's raw files.
- Tests not on the map: 136 tests still lack an oxygen or a pressure value, such as ACME BRE's, whose pressure NASA's table does not state. They are not dropped. They are listed on their investigation's page and on the About screen.
- What EMBER does not claim: it is not a safety rating. A nearby test is not a test of that home and not proof of safety. A count is not a probability. The ranking is a rule of thumb. NASA's tables have no Moon or Mars gravity data yet, and EMBER says so.
- The AI assistant: EMBER finds the evidence first, without any AI. A language model then writes a short answer, and every sentence is checked against its sources. If the check fails, the evidence itself is shown instead.

</details>

## Slide 7: Daniel. 2:16 to 2:55.

**Script**

What comes next? First, machine learning to estimate missing oxygen or pressure from similar tests, always labelled as estimates and never mixed with NASA's values. Second, new tests, including Moon and Mars gravity tests, added automatically as NASA publishes them. Third, a fire check that warns habitat designers about materials and air NASA has never tested. EMBER is live at ember two eta dot vercel dot app. Know the fire risks before we build the next home in space. Thank you.

<details><summary>Background notes (do not read aloud)</summary>

- Machine learning for missing values: some NASA tables leave out the oxygen or the pressure. Today EMBER covers those with 12 declared assumptions, and 136 tests stay off the map. A model trained on similar tests (same hardware, same investigation, same fuel) would estimate the missing value with a range. Estimates would sit in their own field, be drawn differently, carry the word estimate, and never replace or mix with NASA's measured values. We would test it by hiding values we do know and checking how close it gets.

- New tests, added automatically: EMBER already downloads NASA's Physical Sciences Informatics library with one script. Running it on a schedule, rebuilding, rechecking every number and publishing only when the checks pass keeps EMBER current. NASA's tables have no Moon or Mars gravity tests yet, so each one would fill a gap the dashboard already shows.
- A fire check for habitat designers: a designer enters the planned air and the list of cabin materials. EMBER flags every material and air pair with no nearby NASA test, and exports an evidence pack (the tests, NASA's raw rows, the assumptions and the gaps) ready for a safety review. It builds on what EMBER already does for one crew home at a time.
- If asked why these four: two make the data more complete (estimates, new tests), one makes it more trusted (researcher review), and one puts it to work (the design check).

</details>
