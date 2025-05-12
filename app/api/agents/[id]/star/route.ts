// app/api/agents/[id]/star/route.ts
import { NextRequest, NextResponse } from "next/server";
import { toggleAgentStar } from "@/actions/agent";
import { auth } from "@/lib/auth"; // Import your authentication helper

/**
 * POST /api/agents/[id]/star - Star or unstar an agent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Verify authentication
    const user = await auth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agentId = params.id;
    const result = await toggleAgentStar(agentId, user.id);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error toggling agent star:", error);
    return NextResponse.json(
      {
        error: "Failed to star/unstar agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
