// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Model ids, timers and caps. Public settings, in one place. No secret lives here.

export const CONFIG = {
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  // The first choice is a judgment and not a measurement. The evaluation runs both and the better one goes first.
  modelPrimary: 'anthropic/claude-haiku-5.5',
  modelBackup: 'openai/gpt-6-luna',
  labels: {
    'anthropic/claude-haiku-5.5': 'Claude Haiku 5.5 through OpenRouter',
    'openai/gpt-6-luna': 'GPT-6 Luna through OpenRouter',
    'mock/local': 'a local mock that calls nothing',
  } as Record<string, string>,
  // Both models think before they write unless told not to. Thinking counts against the cap,
  // so it starts off. If the evaluation turns it on, set "low" and raise maxTokens to 1500.
  reasoningEffort: 'none',
  maxTokens: 600,
  firstTextMs: { primary: 6000, backup: 5000 },
  totalMs: { primary: 25000, backup: 20000 },
  maxQuestionChars: 300,
  maxEvidenceIds: 8,
  maxEvidenceChars: 9000,
  maxBodyBytes: 4000,
}

export const REFUSAL = 'The PSI evidence in EMBER does not answer that.'

export type Env = Record<string, string | undefined>
