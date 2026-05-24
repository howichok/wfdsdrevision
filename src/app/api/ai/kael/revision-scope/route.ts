import { NextRequest, NextResponse } from "next/server"
import { buildRevisionHubData } from "@/lib/revision/hub-data"
import { buildRevisionContextBlock } from "@/lib/revision/revision-context"
import { parseRevisionScope } from "@/lib/revision/revision-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = parseRevisionScope(request.nextUrl.searchParams)
    const data = await buildRevisionHubData("SU", scope)
    const contextBlock = buildRevisionContextBlock(scope, data)

    return NextResponse.json({
      scope: data.scope,
      lessons: data.lessons,
      topics: data.topics,
      contextBlock,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load revision scope"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
