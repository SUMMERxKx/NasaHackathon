// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// The server function. A thin wrapper. The logic lives in server/handler.ts.
import { handleAsk } from '../server/handler.ts'

export function POST(request: Request): Promise<Response> {
  return handleAsk(request, process.env)
}

export function GET(request: Request): Promise<Response> {
  return handleAsk(request, process.env)
}
