// app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createJob, fetchAgentById } from "@/actions/agent";
import { auth } from "@/lib/auth"; // Import your authentication helper

const prisma = new PrismaClient();
const FLASK_SERVER_URL =
  process.env.FLASK_SERVER_URL || "http://localhost:5000";

/**
 * GET /api/agents/[id] - Get agent details
 */
export async function GET(
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
    const result = await fetchAgentById(agentId, user.id);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching agent details:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch agent details",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/agents/[id] - Update an agent
 */
export async function PUT(
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

    // Check if agent exists and the user has permission
    const agent = await prisma.agent.findUnique({
      where: {
        id: agentId,
        creatorId: user.id, // Ensure the user owns this agent
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or you do not have permission to update it" },
        { status: 404 },
      );
    }

    // Check if the request is multipart form data
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart form data" },
        { status: 400 },
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const zipFile = formData.get("file") as File;

    if (!zipFile || !zipFile.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "ZIP file is required" },
        { status: 400 },
      );
    }

    // Create a job for this agent update
    const jobResult = await createJob("AGENT_UPDATE", user.id, agentId);

    if ("error" in jobResult) {
      return NextResponse.json({ error: jobResult.error }, { status: 500 });
    }

    // Forward the zip file to the Flask server
    const flaskFormData = new FormData();
    flaskFormData.append("file", zipFile);
    flaskFormData.append("agent_id", agentId);
    flaskFormData.append("job_id", jobResult.jobId);
    flaskFormData.append("user_id", user.id);

    // Send to Flask server
    const flaskResponse = await fetch(`${FLASK_SERVER_URL}/api/agents/update`, {
      method: "POST",
      body: flaskFormData,
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json();

      // Clean up the job if Flask server rejects the request
      await prisma.job.delete({ where: { id: jobResult.jobId } });

      return NextResponse.json(
        { error: "Flask server rejected the request", details: errorData },
        { status: flaskResponse.status },
      );
    }

    // Return success with job ID for tracking
    return NextResponse.json({
      success: true,
      message: "Agent update process started",
      agentId: agentId,
      jobId: jobResult.jobId,
    });
  } catch (error) {
    console.error("Error updating agent:", error);
    return NextResponse.json(
      {
        error: "Failed to update agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/agents/[id] - Delete an agent
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

    // Check if agent exists and the user has permission
    const agent = await prisma.agent.findUnique({
      where: {
        id: agentId,
        creatorId: user.id, // Ensure the user owns this agent
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or you do not have permission to delete it" },
        { status: 404 },
      );
    }

    // Delete the agent
    await prisma.agent.delete({
      where: { id: agentId },
    });

    // Return success
    return NextResponse.json({
      success: true,
      message: "Agent deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json(
      {
        error: "Failed to delete agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
