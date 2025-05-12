// app/api/agents/[id]/env-vars/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setAgentEnvVar } from "@/actions/agent";
import { auth } from "@/lib/auth"; // Import your authentication helper

/**
 * POST /api/agents/[id]/env-vars - Set an environment variable for an agent
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
    const { key, value } = await request.json();

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    if (value === undefined || value === null) {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
    }

    const result = await setAgentEnvVar(agentId, user.id, key, String(value));

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error setting agent environment variable:", error);
    return NextResponse.json(
      {
        error: "Failed to set environment variable",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/agents/[id]/env-vars - Delete an environment variable for an agent
 */
export async function DELETE(
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
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Key parameter is required" },
        { status: 400 },
      );
    }

    // Check if the agent exists and belongs to the user
    const prisma = new PrismaClient();
    const agent = await prisma.agent.findUnique({
      where: {
        id: agentId,
        creatorId: user.id,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or you do not have permission to modify it" },
        { status: 404 },
      );
    }

    // Delete the environment variable
    await prisma.agentEnvVar.deleteMany({
      where: {
        agentId,
        key,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Environment variable deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting agent environment variable:", error);
    return NextResponse.json(
      {
        error: "Failed to delete environment variable",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
