# Setup: the steps only the owner can do

EMBER builds and passes its checks with no account at all. These steps put it online and turn on the live model. They need a person and an account, so the build did not do them. None of them needs a payment card or a purchase. If any step asks for one, stop.

Do them in this order. Each says what you should see when it worked.

## 1. Put the site online with Vercel

1. Sign in to vercel.com with the GitHub account that owns `SUMMERxKx/NasaHackathon`. Choose the free Hobby plan.
2. Choose Add New, then Project, and import the repository `SUMMERxKx/NasaHackathon`.
3. Accept the Vite preset that Vercel detects. Leave the build settings alone. The repository's `vercel.json` already sets the build command to `npm run ci` and the output folder to `dist`.
4. Name the project. The site's address is that name followed by `.vercel.app`.
5. Press Deploy.

What you should see: the build runs the tests, the data check, the style check, the token check, the build and the secret scan, in about two to three minutes. The first deployment of a project is always the production site, even from a branch.

Things to know:

- A push to `main` makes the production site. A push to any other branch makes a preview. Preview addresses ask for a Vercel login, so share and submit the production address only.
- If the work is still on the branch `fm/ember-build`, either merge its pull request into `main` first, or set the project's Production Branch to `fm/ember-build` in Settings, then Git, until it is merged.
- A failed build should leave the last good site live. The first red build is a chance to confirm that.
- Vercel's free plan allows 100 deployments a day.

## 2. Make an OpenRouter key for EMBER

1. On openrouter.ai, open Keys and make a new key named EMBER. Do not reuse your main key.
2. Give it a credit limit of $5 and set the limit to reset daily.
3. Copy the key. You will paste it once, in the next step, and nowhere else.

Never paste the key into a chat, a file, a commit or a terminal on the build machine.

## 3. Give the key to Vercel

1. In the Vercel project, open Settings, then Environment Variables.
2. Add a variable named exactly `OPENROUTER_API_KEY`. Paste the key as its value.
3. Tick Production only. Leave Preview and Development unticked. Save.
4. Redeploy once: open Deployments, open the menu on the latest production deployment and choose Redeploy. A new variable only reaches the next deployment.

The name must never start with `VITE_`. Vite copies every variable with that prefix into the code the browser downloads.

What you should see: `https://<your address>/api/health` returns `"configured": true`. On the Ask screen, a typed question now shows a "Live model answer" panel above the evidence, and the status line names the model.

Ask one question on the live site and read the function's log in Vercel before trusting it. The stream shape was read from OpenRouter's docs, not from a live call.

## 4. Add the firewall rule

1. In the Vercel project, open Firewall.
2. Add one rule: when the request path equals `/api/ask`, rate limit by IP address to 8 requests in 60 seconds, and answer 429.
3. Publish it. It takes effect with no redeploy.

The Hobby plan allows one such rule. If it cannot be added, the key's daily limit still caps the spend.

## 5. OpenRouter privacy settings

In OpenRouter's privacy settings, leave prompt logging off, and turn off routing of paid models to providers that may train on prompts.

## 6. Pinned answers, after the live answer works

The six example chips show a pinned answer only after a person has read it. Until then a chip makes a live call, or shows the evidence answer.

```sh
npm run build:pinned -- --site https://<your address>
```

This writes `public/data/pinned-answers.json` with `"reviewed": false` on every answer. The science lead reads each sentence against the evidence cards it cites. For each answer that is right, set `"reviewed": true` and write a short `"reviewNote"`. Commit and push. A test fails the build if a reviewed answer stops passing the checker after a data change.

## 7. The evaluation

```sh
npm run eval:ask -- --site https://<your address>
npm run eval:ask -- --site https://<your address> --use backup
```

Each run posts 12 real questions and 5 trick questions three times, and costs under 2 cents. Copy the summary lines into `src/config/evaluation.ts` so the Methods screen shows them. If the backup beats the first choice, swap the two ids in `server/config.ts`. If answers come back empty, set `reasoningEffort` to `low` and `maxTokens` to 1500 in the same file.

## 8. Checks that wait on the science lead

These are drafts by SI and carry the status "needs human check".

| What | Where | What to do |
|---|---|---|
| The burning rate unit of the FLEX table | `src/three/flameParams.ts`, `GATES.burningRateUnitConfirmed` | Confirm from the publication that it is mm² per second. Then set it to `true`. This turns on the animated droplet in the Lab. |
| The ACME column headed `Tad (K)` | the same file, `GATES.tadConfirmed` | Confirm it is the adiabatic flame temperature. Then set it to `true`. This lets the mark on the temperature scale move. |
| Assumed atmospheres | `data/manual/atmosphere-defaults.json` | Confirm or correct each entry from the PSI record. Change its status. |
| Pillars, fuel classes and hardware families | `data/manual/pillars.json` | Confirm each entry. |
| What each investigation informs | `data/manual/equipment.json` | Confirm each entry with a sentence from the PSI record. |
| Plain summaries | `data/manual/summaries.json` | Read each against the PSI record. |
| Incident and spinoff cards | `data/manual/resources.json` | Check every sentence against its NASA page. |
| The Exploration atmosphere preset | `data/manual/habitats.json` | Read the two NTRS reports and settle the wording. |

After any change in `data/manual`, run `npm run build:data` and then `npm run build:embeddings`, and commit the generated files with it. The build fails if they are out of date. If the embeddings step is skipped, search still works by keyword.

## 9. Before each submission

- The demo path works in Chrome, Safari and Firefox, and at 390 pixels wide.
- The demo path works with a keyboard alone, drill-through included.
- Submit and share the production address, never a preview address.
- Look at the EMBER key's usage on OpenRouter. It should be cents.
- Push at least 20 minutes before a submission. A red test stops the deploy.

## If the key ever leaks

Delete it on OpenRouter, make a new one with the same limit, paste it into Vercel and redeploy.
