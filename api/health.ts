// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The health check. It calls no model and holds no secret.
import { handleHealth } from '../server/handler.ts'

export function GET(): Promise<Response> {
  return handleHealth(process.env)
}
