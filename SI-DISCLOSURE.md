# SI disclosure

Super Intelligence (SI) is the term the NASA Space Apps Challenge uses for AI. This file says how SI was used to make EMBER. The team edits it so that it stays true.

The organizers confirmed to the team on 14 November 2026 that using AI is allowed.

## Which SI tools were used, and for what

| Use | Tool | What it did |
|---|---|---|
| Research and planning | An SI assistant | Read the challenge, probed the PSI service, and wrote the build plan in `plan.html`. |
| Code | Claude Code with the Fable 5.2 model | Drafted the application code, the data pipeline, the build checks and the tests during the event. The team reviewed it. |
| Words | The same assistant | Drafted the plain summaries of each investigation, the wording of the insight cards, the glossary, the method texts and the context cards, from PSI record text and NASA pages. |
| Live answers in the app | Claude Haiku 5.5 as first choice and GPT-6 Luna as backup, both reached through OpenRouter from one server function on Vercel | Write a short answer on the Ask screen from the NASA evidence shown and nothing else. |
| The fireball | SI-assisted shader code, run in the visitor's browser with three.js | Draws the animated fireball and the Earth flame. No image or video generator was used. |

## What is sent to the live model

The question, the habitat and EMBER's own evidence text. The browser sends evidence ids and never text. The server function looks up the text from a file built from NASA data. EMBER does not store or log questions. A line under the question box tells visitors not to enter personal information.

## How SI output is marked

- Areas of SI drafted text carry the tag "SI drafted, checked against PSI data", which links to the Methods screen.
- The Live answer panel is labelled "Live model answer, limited to the NASA evidence shown below". A status line under each answer names the path that produced it.
- Every view of the fireball, and its poster, carries the visible label "SI-generated illustration". The label must stay in frame in any video.
- Every generated data file carries a `generatedBy` field. Pinned answers also record the model, the time, the check result and the review note.
- Source files carry a one-line SI header comment.
- The README and the Methods screen carry this disclosure in short.

## What keeps SI output honest

- Numbers are computed from the NASA tables by code, not written by SI. A build step recomputes every number on an insight card and fails on any difference. Four headline cards are recomputed a second time straight from the raw CSV files with separate code.
- The browser checks every live answer sentence by sentence. A sentence with no valid source, with a number that is not in its source, or with a verdict of safe or unsafe is removed. The check cannot prove that a sentence means what its source means, so the evidence always stays on screen.
- The hand-made mappings and the assumed atmospheres carry the status "needs human check" until the team confirms them.

## What the team did themselves

Chose and shaped the concept. Made the design and story decisions. Check the science and every insight against the data. Confirm the declared assumptions. Review the pinned answers. Test the app. Record the demo.

## Event offers used

None. The site is hosted on Vercel's free plan. The live model is paid from the owner's own OpenRouter credit, at well under a dollar for the event.

## NASA branding

No NASA logo, insignia, flag or mission patch appears anywhere in the app, the fireball or the repository. EMBER says "built with NASA open data" in plain text. NASA does not endorse this project.
