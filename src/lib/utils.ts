// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The class name helper that the components in src/components/ui expect.
import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
