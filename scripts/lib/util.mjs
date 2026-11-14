// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Small helpers shared by the build scripts.
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const shortHash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 8)

// One stable way to write JSON, so the same inputs always give byte-identical files.
export const toJson = (value) => JSON.stringify(value, null, 1) + '\n'
