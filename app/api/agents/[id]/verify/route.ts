// app/api/agents/[id]/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAgent } from "@/actions/agent";
import { prisma } from "@/lib/prisma";
// import { auth } from "@/lib/auth"; // Import your authentication helper
// import { isAdmin } from "@/lib/permissions"; // You'll need to implement this function

/**
 * POST /api/agents/[id]/verify - Verify or unverify an agent (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    //TODO: Suspending Auth for now
    // // Verify authentication
    // const user = await auth();
    // if (!user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }
    //
    // // Check if user is an admin
    // const admin = await isAdmin(user.id);
    //

    //FIX: User for testing
    const user = await prisma.user.findUnique({
      where: {
        id: "827a2a72-ffc2-443b-ae91-f6ea1b7f1b33",
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    //FIX: User for testing
    const agentId = params.id;
    const result = await verifyAgent(agentId, user.id, true);

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
