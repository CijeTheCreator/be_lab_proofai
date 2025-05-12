// app/api/agents/[id]/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAgent } from "@/actions/agent";
import { auth } from "@/lib/auth"; // Import your authentication helper
import { isAdmin } from "@/lib/permissions"; // You'll need to implement this function

/**
 * POST /api/agents/[id]/verify - Verify or unverify an agent (admin only)
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

    // Check if user is an admin
    const admin = await isAdmin(user.id);

    const agentId = params.id;
    const result = await verifyAgent(agentId, user.id, admin);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error verifying agent:", error);
    return NextResponse.json(
      {
        error: "Failed to verify agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
