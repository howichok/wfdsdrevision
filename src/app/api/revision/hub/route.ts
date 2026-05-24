import { NextRequest, NextResponse } from "next/server"
import { buildRevisionHubData } from "@/lib/revision/hub-data"
import { parseRevisionScope } from "@/lib/revision/revision-scope"
import {
  requireAuth,
  AuthError,
  authErrorResponse,
} from "@/lib/auth/permissions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const scope = parseRevisionScope(request.nextUrl.searchParams)
    const data = await buildRevisionHubData(user.role, scope)
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    const message = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
