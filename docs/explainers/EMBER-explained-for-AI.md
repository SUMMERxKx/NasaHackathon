# EMBER: context for an AI assistant

Use this file as background to answer questions about EMBER. Facts are as of 15 November 2026, after the final site update.

## What EMBER is

- EMBER is a web dashboard built by team Low Cortisol Gng (Jesse, Samar, Pasang, Daniel) for the NASA Space Apps Challenge 2026, challenge "Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data". Local event: Kamloops, Canada.
- Live site: https://ember-two-eta.vercel.app
- Code: https://github.com/SUMMERxKx/NasaHackathon
- 30-second demo: https://github.com/SUMMERxKx/NasaHackathon/blob/main/submission/EMBER-demo-30s.mp4

## The problem

- Fire behaves differently in space. With no gravity, hot air does not rise, so a candle flame becomes a slow, dim blue ball instead of a teardrop. Fires can spread and smoulder in unexpected ways.
- Crews live on space stations and spacecraft today and will live in Moon and Mars bases, rovers and spacesuits tomorrow. Some of these will use thinner air with more oxygen, which makes materials burn more easily.
- NASA has run hundreds of fire tests in microgravity and published them in its Physical Sciences Informatics (PSI) database. The data exists, but it sits in 22 separate technical tables, each in its own format, so it is hard to find, compare and interpret.

## The solution

EMBER puts every NASA PSI combustion test in one place: 24 investigations, 22 tables, 2,029 tests, 1,893 of them placed on the map. A user picks a crew home and sees which real NASA tests ran in similar air, what kinds of fuels and materials they cover, and where the gaps are.

Main tools:
- Dashboard: pick a crew home, see the nearby test counts by type (solid materials, liquid fuels, gas flames, smoke and aerosols), a plain-language gap sentence, and the top three most relevant investigations.
- Map: every test plotted by oxygen and pressure. Zoom, pan and click any test.
- Search, filters (investigation, fuel class, safety pillar, hardware) and a table with "Download this view (CSV)".
- Lab: the droplet burning law, extinction and gravity comparisons, and a flame visual.
- Ask EMBER: an AI chat (Claude Haiku 5.5, GPT-6 Luna as backup, through OpenRouter) that answers only from NASA evidence, cites sources, and removes any sentence whose source or number does not match. Off-topic questions are refused before any AI call, and there is a rate limit.
- About: methods, formulas, assumptions, sources, glossary and the AI disclosure.

## Home air and test air (the core idea)

Every crew home is described by its air: how much of it is oxygen, and its pressure (how thick the air is).

| Crew home | Oxygen | Pressure |
|---|---|---|
| ISS cabin | 21% | 14.7 psi (same as Earth at sea level) |
| Shuttle EVA preparation | 26.5% | 10.2 psi |
| Exploration atmosphere and Mars surface habitat | 34% | 8.2 psi |
| Moon Base bound | 30% | 10.2 psi |
| Spacesuit | 100% | 4.3 psi |
| Custom | user sets oxygen, pressure, gravity, air flow | |

Every NASA test also ran in some air, with its own oxygen and pressure, either stated in NASA's table or marked as assumed.

## How "nearby" works

- EMBER measures the distance between the test air and the home air.
- About 4 percentage points of oxygen counts as 1 unit.
- About 25 percent more or less pressure counts as 1 unit. Pressure is compared as a ratio (log scale) because it spans 1 to over 40 psi.
- The two are combined as a straight-line distance: d = square root of ((oxygen gap / 0.04) squared + (ln(test pressure / home pressure) / 0.25) squared).
- A test within 1 unit is "nearby" and counts as evidence for that home. Example: the ISS cabin has 1,087 nearby tests. The Exploration atmosphere has 24, with zero solid-material and zero smoke tests, which is a gap.
- Nearby means NASA burned something in similar air. It does not mean NASA tested that home, and it is not a safety rating or a confidence level.

## Other calculations, briefly

- Evidence Coverage (shown in About): every test contributes a weight that shrinks with distance, exp(-0.5 times d squared). Assumed values count half. Totals per pillar (prevention, detection, suppression) become 100 times (1 minus e to the minus N over 10), blended 0.4, 0.3, 0.3. It levels off as evidence piles up. Inverse-flame tests still count, which is disclosed.
- Ranking: combines how well an investigation's tests match the air, how relevant its fuels are, which safety pillar it informs, and how much data it has.
- Droplet burning law: diameter squared falls linearly with time, d(t)^2 = d0^2 - K t, with K in mm squared per second.

## How the data was cleaned

1. NASA's 22 tables, each with different columns and units, were read into one list with the same fields: fuel, fuel class, oxygen, pressure, air flow, outcome.
2. Units were unified: oxygen as one scale, pressure from bar or mmHg to atmospheres and psi.
3. Obvious typos (for example "3400%" meaning 34%) were fixed and flagged. Column headers that lost symbols in NASA's files were corrected and listed.
4. NASA's numbers were never overwritten. Every test keeps NASA's original row beside what EMBER read.
5. Where a table left out oxygen or pressure, a documented value (such as normal cabin air) was used, marked "assumed", drawn as a hollow dot, cited to a source and reviewed by the team on 15 November 2026. A combustion researcher should still confirm before design use. Where no good value existed (for example ACME BRE pressures, DAFT oxygen), the tests stay off the map instead of being guessed.
6. Two rows that were not real tests were dropped and listed.

## Limits

- No partial-gravity (Moon or Mars gravity) combustion data exists in PSI yet.
- Inverse flames (oxygen flows from the burner, not the room) are flagged because their oxygen value is not cabin air.
- Coverage and nearby are evidence measures, not safety ratings.

## What comes next

1. Machine learning to estimate missing oxygen or pressure from similar tests, always labelled as an estimate and never mixed with NASA's values.
2. New tests, including Moon and Mars gravity tests, added automatically as NASA publishes them.
3. A fire check for habitat designers that flags material and air combinations NASA has never tested and exports the evidence for a safety review.

## AI use disclosure

AI assistants drafted most of the code, text, visuals and the demo. The team chose the concept, checked the science and tested the app. AI-generated visuals carry an "SI" mark.
