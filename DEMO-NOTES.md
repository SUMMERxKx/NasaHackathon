# Demo notes

For the person who records the 30 second cut and the person who signs off the numbers. The production site is https://ember-two-eta.vercel.app.

## The fastest way to see the demo path

Press **Play the story** in the top bar. Five steps drive the real app in the order below. Every number in a caption is read from the data when the story runs.

## The click path for a 30 second screen recording

Record in the dark theme at 1920 by 1080. Keep the label "SI-generated illustration" inside the frame whenever a flame is on screen.

| Seconds | What to do | What to say |
|---|---|---|
| 0 to 3 | Open `https://ember-two-eta.vercel.app/` with the ISS cabin selected. Hold on the hero: the fireball seething, the small Earth flame beside it. | "On Earth a flame streams upward. In freefall it becomes a fireball." |
| 3 to 9 | Pick the Exploration atmosphere card. The dial sweeps from 100 to 67, the bars shrink, the list reorders, the gravity banner slides in, and the fireball burns faster while its readout changes. | "Pick your habitat. A Moon Base runs richer in oxygen. The fire burns harder, and the evidence thins out." |
| 9 to 16 | Open Map. Press "Focus the Moon Base region". Click the region caption. In the panel, click ACME CFI-G, then one test. The raw NASA row is on screen. | "Every mark is a real NASA test, one click away. Here there are 66, all gas flames. Solid material tests stop at 22.2 percent oxygen." |
| 16 to 19 | Open Lab. Show the droplet calculator with FLEX test 20CAL10: 4.29 seconds from the model beside 5 seconds measured. | "Simple models, checked against 196 real burns." |
| 19 to 27 | Open Ask. Tap the chip "What is missing for the Moon?". Then type one short question and let the live answer stream and earn its ticks. | "Ask in plain words. Every sentence is checked against its source." |
| 27 to 30 | End card: the name, the tagline, the link. | "EMBER. Know what we know before we light the Moon." |

Rules for the recording:

- 30 seconds or less. One second over and the project cannot be judged globally. Aim for 28.
- If Ask needs more time, cut the Lab beat first.
- Never stage or edit in an answer the app did not produce.
- The numbers spoken must be the numbers on screen.
- No NASA logo, patch or footage.
- The droplet in the Lab is still until the science lead confirms the burning rate unit. See `SETUP.md`, step 8.
- The live answer needs the OpenRouter key in Vercel. Until then the Ask screen shows the evidence answer, which is also a fair thing to record.

## Three deep links that are good for screenshots

- `https://ember-two-eta.vercel.app/?h=exploration` : the Brief for the Exploration atmosphere, with the gravity banner and the three gap cards.
- `https://ember-two-eta.vercel.app/map?h=exploration&zoom=moon&drill=region.moon~inv.PSI-159` : the map zoomed to the Moon Base region, with the drill panel open on 48 ACME CFI-G tests.
- `https://ember-two-eta.vercel.app/lab/droplet` : the droplet calculator with FLEX test 20CAL10 and the validation scatter.

Two more: `https://ember-two-eta.vercel.app/?h=suit` shows the fireball as a ghost, and `https://ember-two-eta.vercel.app/?h=exploration&drill=insight.I1.maxSolidO2Pct` opens the 129 BASS-II rows behind 22.2%.

## The five real numbers to quote

Copied from `public/data/insights.json`. The build recomputes them, and four are recomputed a second time from the raw NASA files.

| Number | Value | Card |
|---|---|---|
| Highest oxygen in any solid material test | 22.2%, in BASS-II, over 129 tests | I1 |
| Tests inside the Moon Base region | 66, all gas flames. 0 solid, 0 liquid. 17 droplet tests on its edge. | I2 |
| The d-squared law against FLEX | Median of predicted over measured 0.951, over 196 tests | I4 |
| Highest oxygen tested anywhere | 85%, in 131 inverse gas flame tests. It is the oxidizer stream, not a cabin. | I10 |
| Evidence Coverage | 100 near the ISS cabin, 67 near the Exploration atmosphere, 0 near the spacesuit atmosphere | I12 |

The fireball's readout, also from the data: at the ISS cabin, burning rate 0.51 over 39 FLEX tests and 111 of 165 nearby tests ended in extinction. At the Exploration atmosphere, 0.715 over 8 tests and 0 of 9.

## Known limitations

- The Evidence Coverage score counts evidence. It is not a safety rating.
- The ranking is a heuristic with weights chosen by the team.
- 722 tests rest on an assumed cabin air atmosphere. They are hollow on the map and count at half weight.
- PSI holds no partial-gravity combustion tests, so nothing describes a flame on the Moon or Mars.
- The six pinned answers are written but not yet reviewed, so a chip still makes a live call. See `REVIEW-CHECKLIST.md`.
- The evaluation counts are measured. The Meaning measure is still open: the science lead has not yet read the answers against their sources.
- In the evaluation, the first choice refused "What is missing for the Moon?" in 2 of 3 rounds and answered it well in the third. If the chip gives the refusal sentence during a recording, tap it again, or record the evidence answer.
- Search by meaning needs a download of about 51 MB on the first use of the question box. Until it is ready, search is by keyword with alias expansion, with no message.
- The pillar mapping, the equipment tags, the plain summaries and the assumptions are SI drafts that wait on a human check.

## Checks run on the build machine

On 14 November 2026, against the local build, in Chrome. The checks against the production site are in the next section.

| Check | Result |
|---|---|
| Unit tests, both levels of insight verification, server tests with stubbed models | 112 tests pass |
| Every route renders in both themes | Pass, in the tests |
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

## Checks run against the production site

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
