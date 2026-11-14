// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// Placeholder until the live fireball is built. It reports a failure so the poster stays.
import { useEffect } from 'react'
import type { DropletState, FlameView } from '../components/FireballStage.tsx'
import type { FlameParams } from './flameParams.ts'

export type FireballProps = { params: FlameParams; view: FlameView; droplet: DropletState; showEarth: boolean; onFail: () => void }

export default function Fireball({ onFail }: FireballProps) {
  useEffect(() => onFail(), [onFail])
  return null
}
