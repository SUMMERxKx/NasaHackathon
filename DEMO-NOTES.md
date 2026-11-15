# Demo notes

For the person who records the 30 second cut and the person who signs off the numbers. The production site is https://ember-two-eta.vercel.app.

## The fastest way to see the demo path

Press **Tour** at the top right of the dashboard. Five steps drive the real app in the order below. Every number in a caption is read from the data when the tour runs.

## The click path for a 30 second screen recording

Record at 1920 by 1080. Keep the small "SI" mark in the corner of the fireball and of the start page sky inside the frame whenever either is on screen.

| Seconds | What to do | What to say |
|---|---|---|
| 0 to 3 | Open `https://ember-two-eta.vercel.app/`. Hold on the start page: the sky, the round flame in freefall and the name. Press "Open the dashboard". | "On Earth a flame streams upward. In freefall it becomes a sphere." |
| 3 to 9 | On the dashboard, open the habitat picker at the top right and pick the Exploration atmosphere. The count of nearby NASA test records falls from 1,093 to 24, the solid and smoke rows read "No nearby rows", the gap statement changes and the three investigations reorder. | "Pick your habitat. A Moon Base runs richer in oxygen. The fire burns harder, and the evidence thins out." |
| 9 to 16 | Scroll down to the map and press "Moon zoom". Click the region caption. In the panel, click ACME CFI-G, then one test. The raw NASA row is on screen. | "Every mark is a real NASA test, one click away. Here there are 66, all gas flames. Solid material tests stop at 22.2 percent oxygen." |
| 16 to 19 | Open Lab. Show the droplet model with FLEX test 20CAL10: 4.29 seconds from the model beside 5 seconds measured. | "Simple models, checked against 196 real burns." |
| 19 to 27 | Press the robot at the bottom right. Tap "What is missing for the Moon?". Then type one short question and let the live answer stream in with its source chips. | "Ask in plain words. Every sentence is checked against its source." |
| 27 to 30 | End card: the name, the tagline, the link. | "EMBER. Know what we know before we light the Moon." |

Rules for the recording:

- 30 seconds or less. One second over and the project cannot be judged globally. Aim for 28.
- If the chat needs more time, cut the Lab beat first.
- Never stage or edit in an answer the app did not produce.
- The numbers spoken must be the numbers on screen.
- No NASA logo, patch or footage.
- The droplet in the Lab is still until the science lead confirms the burning rate unit. See `SETUP.md`, step 8.
- The live answer needs the OpenRouter key in Vercel. Until then the chat panel shows the evidence as the answer, which is also a fair thing to record.

## Three deep links that are good for screenshots

- `https://ember-two-eta.vercel.app/dashboard?h=exploration` : the dashboard for the Exploration atmosphere, with the counts by fuel class, the gap statement and the three investigations to read first.
- `https://ember-two-eta.vercel.app/dashboard?h=exploration&zoom=moon&drill=region.moon~inv.PSI-159` : the map zoomed to the Moon Base region, with the drill panel open on 48 ACME CFI-G tests.
- `https://ember-two-eta.vercel.app/lab/droplet` : the droplet model with FLEX test 20CAL10 and the validation scatter.

Three more: `https://ember-two-eta.vercel.app/dashboard?h=suit` shows the empty state, with "No nearby rows" in all four classes, `https://ember-two-eta.vercel.app/lab/flame?h=suit` shows the fireball as a ghost, and `https://ember-two-eta.vercel.app/dashboard?h=exploration&drill=insight.I1.maxSolidO2Pct` opens the 129 BASS-II rows behind 22.2%. The older addresses, such as `/map` and `/ask`, still work and redirect.

## The five real numbers to quote

Copied from `public/data/insights.json`. The build recomputes them, and four are recomputed a second time from the raw NASA files.

| Number | Value | Card |
|---|---|---|
| Highest oxygen in any solid material test | 22.2%, in BASS-II, over 129 tests | I1 |
| Tests inside the Moon Base region | 66, all gas flames. 0 solid, 0 liquid. 17 droplet tests on its edge. | I2 |
| The d-squared law against FLEX | Median of predicted over measured 0.951, over 196 tests | I4 |
| Highest oxygen tested anywhere | 85%, in 131 inverse gas flame tests. It is the oxidizer stream, not a cabin. | I10 |
| Evidence Coverage | 100 near the ISS cabin, 67 near the Exploration atmosphere, 0 near the spacesuit atmosphere | I12 |

The nearby counts on the dashboard, from the same data: 1,093 test records near the ISS cabin, of which 849 rest on assumed coordinates, 43 near the Shuttle EVA preparation atmosphere, all liquid fuels, 24 near the Exploration and the Mars atmospheres, 14 near the Moon Base bound and 0 near the spacesuit atmosphere. Only the ISS cabin has a solid-material or a smoke test nearby.

The fireball's readout in the Lab, also from the data: at the ISS cabin, burning rate 0.51 over 39 FLEX tests and 111 of 165 nearby tests ended in extinction. At the Exploration atmosphere, 0.715 over 8 tests and 0 of 9.

## Known limitations

- The Evidence Coverage score counts evidence. It is not a safety rating.
- The ranking is a heuristic with weights chosen by the team.
- 722 tests rest on an assumed cabin air atmosphere. They are hollow on the map and count at half weight.
- PSI holds no partial-gravity combustion tests, so nothing describes a flame on the Moon or Mars.
- The six pinned answers are written but not yet reviewed, so an example question in the chat still makes a live call. See `REVIEW-CHECKLIST.md`.
- The evaluation counts are measured. The Meaning measure is still open: the science lead has not yet read the answers against their sources.
- In the evaluation, the first choice refused "What is missing for the Moon?" in 2 of 3 rounds and answered it well in the third. If the example gives the refusal sentence during a recording, tap it again, or record the evidence answer.
- Search by meaning needs a download of about 51 MB the first time a question is typed in the chat. Until it is ready, search is by keyword with alias expansion, with no message.
- The pillar mapping, the equipment tags, the plain summaries and the assumptions are SI drafts that wait on a human check.

## Checks run on the counts-first dashboard

On 15 November 2026, against the local production build, in Chrome on an Apple M2. The dashboard now leads with the counts of nearby NASA test records. The coverage score sits in About and the fireball in the Lab.

| Check | Result |
|---|---|
| Unit tests, both levels of insight verification, server tests with stubbed models | 140 tests pass |
| The nearby counts of all six presets against a separate audit of the snapshot | All match: 1,093, 43, 24, 14, 24 and 0, with the same four class counts |
| 23 addresses at 1440 pixels wide: start page, the dashboard for each preset, Investigations, Detail, Compare, the four Lab tools and the About tabs | All render. No console errors. No sideways scroll. |
| The same 23 addresses at 390 pixels wide | No console errors. No sideways scroll. Every class name and count of the chart fits inside it. |
| A class count opens only its own rows: Liquid fuels for the Exploration atmosphere | 9 rows, all FLEX liquid fuel tests |
| From a class count to an assumed row: Solid materials at the ISS cabin, then BASS, then test 1 | 229 rows, then 122, then the raw NASA row with the note that its atmosphere is assumed |
| From a caveat count to an inverse flame: the Exploration atmosphere | 2 rows. Test 22024L2 of ACME Flame Design says its oxygen value is the oxidizer stream. |
| An empty class: Solid materials for the spacesuit atmosphere | A panel that states the rule, calls it an evidence gap and links to the investigations, the findings and the definition |
| Keyboard: Tab to a row of the count chart, press Enter | The panel opens on that class |
| The tour, five steps | Pass. Step three brings the map into view. |
| Script loaded on a first visit to the start page, the entry file and the one file it preloads | 380 kB unpacked, against 376 kB before. The charting library is 314 kB in a file of its own, fetched with the dashboard and never by the start page. |

Not checked: Lighthouse, Safari and Firefox, a real phone, and the live model on the production site.

## Checks run on the redesign

On 14 November 2026, against the local production build of the redesign, in Chrome on an Apple M2. The site now has a start page, a dashboard, Investigations, a Lab and About, with the chat in a panel.

| Check | Result |
|---|---|
| Unit tests, both levels of insight verification, server tests with stubbed models | 122 tests pass |
| Every route renders, and every old address redirects | Pass, in the tests |
| Every screen at 1440 pixels wide: start page, dashboard, Investigations, Detail, Compare, the three Lab models and the eight About tabs | All render. No console errors. No sideways scroll. |
| Start page, dashboard, Investigations, Lab and About at 390 pixels wide | No sideways scroll |
| The habitat picker: each preset, then custom sliders | The ring, the score, the fireball and the list all follow |
| The chat panel with the local mock model: an example question and a typed question | The answer streams, is checked and lists its sources. The habitat follows the question. |
| A question in the address, `/ask?q=`, from before the redesign | Redirects to the dashboard, opens the chat and asks it |
| The tour, five steps | Pass. The last step opens the chat. |
| Drill-through from the address: the region, then ACME CFI-G | 48 rows shown |
| WebGL canvases on screen at once | One |
| Frame rate at rest on the start page and the dashboard, CPU slowed 4 times | 60 frames a second |
| Zoom to the Moon Base region, CPU slowed 4 times | About 250 ms of long frames. The site before the redesign took about 1,000 ms. |
| Dragging the habitat ring, CPU slowed 4 times | No frame over 50 ms in most runs, the same as before the redesign. The average frame is longer than before, 26 ms against 19 ms, because the whole dashboard now follows the ring. |
| Script loaded on a first visit to the start page | 634 kB unpacked, with no 3D code. The first screen before the redesign loaded 1,252 kB, 3D code included. |

Not checked on the redesign yet: Lighthouse, Safari and Firefox, a real phone, and the live model on the production site.

## Checks run before the redesign, on the build machine

On 14 November 2026, against the local build, in Chrome. These name the screens as they were then: Brief, Map, Ask, Earth and Methods. The checks against the production site are in the next section.

| Check | Result |
|---|---|
| Unit tests, both levels of insight verification, server tests with stubbed models | 112 tests pass |
| Every route renders | Pass, in the tests |
| Lighthouse accessibility, Brief | 93 before the accessible name fixes |
| Lighthouse accessibility, Map | 96 before the accessible name fixes |
| Lighthouse accessibility, Ask | 100 |
| Sideways scroll at 390 pixels on Brief, Map, Investigations, Detail, Ask, Lab, Methods and the drill panel | None |
| Console errors on every screen | None |
| Keyboard: focus a chart mark, press Enter, the panel opens with focus on its heading. Back steps up one level. Escape closes. | Pass |
| The guided story, five steps | Pass |
| The fireball's frame rate on the build machine | 61 frames a second |
| Ask with the local mock model: the answer streams, is checked and earns its ticks | Pass |
| "Who won the World Cup?" | The refusal sentence. No model call. |

## Checks run against the production site before the redesign

On 14 November 2026, against https://ember-two-eta.vercel.app, in Chrome.

| Check | Result |
|---|---|
| Every route at 1440 pixels wide: Brief, Map, Investigations, Detail, Compare, Lab, Ask, Earth, Methods and three deep links | All render. No console errors. |
| The same routes at 390 pixels wide | No sideways scroll. No console errors. |
| Drill-through on the Map: the region, then ACME CFI-G, then test 21106A4 | The raw NASA row and the link to psi.nasa.gov are shown. |
| The fireball with the habitat controls | The readout changes from 0.51 over 39 tests to 0.715 over 8 tests. 61 frames a second. |
| The guided story | All five steps. |
| A typed question on Ask | The live answer streams within a few seconds, passes the check and names Claude Haiku 5.5. |
| A chip on Ask at 390 pixels wide | The live answer streams and passes the check. |
| Requests to other hosts while using Ask and search by meaning | None. |
| The rate limit on `/api/ask` | The ninth call inside a minute gets 429. |
| The evaluation, both models | 11 of 12 real questions and 5 of 5 trick questions each. See the Methods screen. |

One defect was found and fixed: when the drill panel closed, keyboard focus fell to the top of the page and not back to the mark that opened it. The fix reaches the site with the next deploy.

Still to do by hand before a submission: the demo path in Safari and Firefox, a check on a real phone, and one real question on the live site after the key is set.
