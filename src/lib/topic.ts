// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The topic screen for Ask EMBER. It runs on the server before any model call and in the chat
// panel before the question is sent, with the same words on both sides. It is a plain keyword
// check against EMBER's own vocabulary, so it costs nothing and gives the same answer every time.
import type { SearchIndexFile } from '../types.ts'

export const TOPIC_HINT = "Ask about NASA's microgravity fire tests in EMBER, such as flames, fuels, materials, oxygen levels or a habitat."

export type TopicVerdict = { ok: true } | { ok: false; reason: 'misuse' | 'off_topic' }
export type TopicVocab = { strong: Set<string>; weak: Set<string>; phrases: string[]; capsOnly: Set<string> }

// Words that on their own place a question inside EMBER's subject.
const STRONG = `fire fires flame flamelet burn burner combustion combust combustible ignite ignition ignitable
flammable flammability nonflammable inflammable flashpoint oxygen oxidizer oxidiser o2 co2 n2 nitrogen helium argon
diluent dilution psi microgravity micro-gravity gravity gravitational weightless weightlessness freefall zero-g 0g
spacecraft spaceship spaceflight iss nasa orbit orbital astronaut cosmonaut crew cabin spacesuit eva moon lunar mars
martian artemis apollo mir shuttle extinction extinguish extinguisher extinguishment suppress suppressant suppression
smoke soot smolder smoulder ember fuel droplet candle wick lampwick wax pmma acrylic plexiglass nomex sibal cotton
fabric fiberglass silicone kapton teflon pyrell methanol ethanol heptane octane isooctane decane dodecane propanol
glycerol ethylene methane propane butane ethane hydrogen propylene aerosol particulate firefighter firefighting blaze
pyrolysis laminar premixed non-premixed counterflow coflow stoichiometric buoyancy buoyant radiative saffire mdca loi
ppo2 d-squared d2 normoxic glovebox liftoff evidence pressure convection conduction`.split(/\s+/)

// Words that belong to the subject but also to everyday talk. Two of them together count.
const WEAK = `test experiment investigation study sample material data temperature heat hot gas space hardware result
science scientific research measure measurement rate limit air flow scale point score value record row
distance nearby constant law index direction partial reduced base cold cool shared vehicle cargo rover lander upward
particle dust coordinate hollow assumed assumption percent screening inert plastic cloth textile detector detection
prevention pillar inside-out opposed concurrent atmosphere habitat diffusion coverage station msg tad cir vent
ventilation spread speed rack`.split(/\s+/)

// Words from the search file that say nothing about fire on their own.
const IGNORE = new Set('a an and as of the with he goes out time large low free fall other materials pure mixture balance fine road arizona ard design films rods sheets slabs spheres rubber'.split(' '))
const IGNORE_PHRASES = new Set(['goes out'])

// Requests to change the assistant's role, reveal its rules, or do a job that is not about the evidence.
const MISUSE: RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass|skip)\b.{0,40}\b(instructions?|rules|prompts?|guidelines|previous|above|system)\b/,
  /\b(system|developer|hidden|initial|original)\s+(prompt|message|instructions?)\b/,
  /\b(your|these)\s+(instructions|rules|prompt)\b/,
  /\byou\s+are\s+now\b/,
  /\b(you|please)\s+(act|behave|respond|answer)\s+(as|like)\b/,
  /^(act|behave)\s+as\b/,
  /\bpretend\b/,
  /\brole[\s-]?play\b/,
  /\bjailbreak|\bdeveloper\s+mode\b|\bdan\s+mode\b|\bfrom\s+now\s+on\b|\bnew\s+(role|persona|instructions)\b/,
  /<\/?(system|assistant|user|instructions?)>|\b(system|assistant)\s*:/,
  /\b(write|generate|create|build|debug|fix|give\s+me|make\s+me)\b.{0,40}\b(code|script|program|function|app|website|webpage|html|css|sql|regex)\b/,
  /\b(write|compose|draft|generate|create)\b.{0,40}\b(essay|poem|story|song|lyrics|email|letter|resume|tweet|joke|limerick|haiku|speech|article|blog|homework|assignment)\b/,
  /\b(python|javascript|typescript|java|c\+\+|c#|golang|php|kotlin|powershell|sql|html|css|regex|json|api\s+key)\b/,
  /```|\bdef\s+\w+\s*\(|console\.log|#include|\bfunction\s*\(|=>|[{}]/,
  /\b(translate|translation|recipe|recipes|homework|horoscope|lottery|bitcoin|crypto|stock\s+price)\b/,
  /\btell\s+(me\s+)?(a\s+)?(joke|story|riddle)\b/,
]

const words = (text: string): string[] => text.toLowerCase().match(/[a-z0-9][a-z0-9+#-]*/g) ?? []

// Simple endings, so "flames", "burning", "ignited" and "studies" find their word.
function forms(word: string): string[] {
  const out = [word]
  if (word.endsWith('ies')) out.push(`${word.slice(0, -3)}y`)
  if (word.endsWith('es')) out.push(word.slice(0, -2))
  if (word.endsWith('s')) out.push(word.slice(0, -1))
  if (word.endsWith('ed')) out.push(word.slice(0, -2), word.slice(0, -1))
  if (word.endsWith('ing')) out.push(word.slice(0, -3), `${word.slice(0, -3)}e`)
  if (word.includes('-')) out.push(...word.split('-').filter((part) => part.length > 1))
  return out
}

// Builds the vocabulary from the search file the site already serves, plus the lists above.
export function buildTopicVocab(file: SearchIndexFile): TopicVocab {
  const strong = new Set(STRONG)
  const weak = new Set(WEAK)
  const phrases = new Set<string>(['space station', 'evidence coverage', 'coverage score', 'heat release', 'flame spread', 'smoke point'])
  const capsOnly = new Set<string>()
  const addTerm = (term: string) => {
    const lower = term.toLowerCase().replace(/[^a-z0-9% .-]/g, ' ').replace(/\s+/g, ' ').trim()
    if (lower.includes(' ')) {
      if (!IGNORE_PHRASES.has(lower)) phrases.add(lower)
      return
    }
    if (lower.length < 3 || /^\d+$/.test(lower) || forms(lower).some((form) => weak.has(form) || IGNORE.has(form))) return
    strong.add(lower)
  }
  for (const [alias, expansion] of Object.entries(file.aliases)) {
    for (const term of [alias, ...expansion]) addTerm(term)
  }
  for (const doc of file.docs) {
    if (doc.kind === 'glossary' || doc.kind === 'habitat' || doc.kind === 'context') addTerm(doc.title)
    if (doc.kind === 'material') {
      // The fuel or material name after the investigation name, such as "Nomex" or "C2H4".
      for (const word of words(doc.title.split(',').slice(1).join(' '))) if (word.length >= 2 && !/^\d/.test(word)) addTerm(word)
    }
    if (doc.kind === 'investigation') {
      for (const token of `${doc.acronym ?? ''}`.split(/[\s/]+/)) {
        // Short acronyms that are also English words, such as SAME, BASS or FLEX, count only in capitals.
        if (/^[A-Z]{2,5}$/.test(token)) capsOnly.add(token)
        else if (/^[A-Za-z]+-[A-Za-z0-9]+$/.test(token) && /[A-Z0-9]/.test(token.slice(1))) strong.add(token.toLowerCase())
        else if (/^[A-Z][A-Za-z]{5,}$/.test(token) && token !== token.toLowerCase()) addTerm(token)
      }
    }
  }
  for (const word of weak) strong.delete(word)
  return { strong, weak, phrases: [...phrases], capsOnly }
}

// The verdict for one question. Misuse is checked first, then whether the question is about EMBER's subject.
export function screenQuestion(question: string, vocab: TopicVocab): TopicVerdict {
  const lower = question.toLowerCase().replace(/\s+/g, ' ').trim()
  if (MISUSE.some((pattern) => pattern.test(lower))) return { ok: false, reason: 'misuse' }
  const padded = ` ${lower.replace(/[^a-z0-9% .-]/g, ' ').replace(/\s+/g, ' ')} `
  if (vocab.phrases.some((phrase) => padded.includes(` ${phrase} `) || padded.includes(` ${phrase}s `))) return { ok: true }
  if ((question.match(/[A-Za-z0-9-]+/g) ?? []).some((token) => vocab.capsOnly.has(token) || vocab.capsOnly.has(token.split('-')[0]))) return { ok: true }
  const weakSeen = new Set<string>()
  for (const word of words(lower)) {
    const list = forms(word)
    if (list.some((form) => vocab.strong.has(form))) return { ok: true }
    const weakForm = list.find((form) => vocab.weak.has(form))
    if (weakForm) weakSeen.add(weakForm)
  }
  return weakSeen.size >= 2 ? { ok: true } : { ok: false, reason: 'off_topic' }
}
