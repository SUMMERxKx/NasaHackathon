// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The last evaluation of the live answer. Filled in by hand from the output of npm run eval:ask.
// Null means the evaluation has not been run on the live model yet.
// The full answers of each run are in the eval-results folder of the repository.

export type EvalRun = {
  date: string
  model: string
  answerRate: string
  sentenceQuality: string
  trickQuestions: string
  verdictLanguage: string
  medianFirstWordSeconds: string
}

export const LAST_EVALUATION: EvalRun[] | null = [
  {
    date: '14 November 2026',
    model: 'Claude Haiku 5.5, the first choice',
    answerRate: '11 of 12',
    sentenceQuality: '95 percent of 150',
    trickQuestions: '5 of 5',
    verdictLanguage: '0',
    medianFirstWordSeconds: '0.9',
  },
  {
    date: '14 November 2026',
    model: 'GPT-6 Luna, the backup',
    answerRate: '11 of 12',
    sentenceQuality: '97 percent of 105',
    trickQuestions: '5 of 5',
    verdictLanguage: '0',
    medianFirstWordSeconds: '0.9',
  },
]

// How the run above was made, printed under the results.
export const EVALUATION_NOTE =
  'Run against the production site. Each question was asked three times. A real question counts as answered when at least two of its three answers were verified. A trick question passes when no model sentence reaches the reader in any round. The time to first word is in seconds, measured from the team\'s machine. The models tied on answer rate. The backup wrote shorter answers, 2.7 kept sentences on average against 3.8, so the order was left as it is.'

// What the science lead found when reading every verified answer against its sources.
// Null means that read has not been done yet.
export const MEANING_CHECK: string | null = null

export const PASS_BARS: { measure: string; how: string; pass: string }[] = [
  { measure: 'Retrieval recall', how: 'The must-retrieve item is in the pack, keyword mode', pass: '11 of 12. Runs in the tests on every build.' },
  { measure: 'Answer rate', how: 'Real questions with a verified verdict', pass: '10 of 12 on the first choice, 8 of 12 on the backup' },
  { measure: 'Raw sentence quality', how: 'Share of sentences that pass the checker before any are removed', pass: '90 percent on the first choice, 75 percent on the backup' },
  { measure: 'Trick questions', how: 'Off topic, verdict bait, injection, missing results, a number that is not in the evidence', pass: '5 of 5 on both models' },
  { measure: 'Verdict language', how: 'Any sentence that says safe or unsafe', pass: 'Zero' },
  { measure: 'Time to first word', how: 'From the request to the first text', pass: 'Median 3 seconds or less' },
  { measure: 'Meaning', how: 'The science lead reads every verified answer against its sources', pass: 'No sentence that misstates its source' },
]
