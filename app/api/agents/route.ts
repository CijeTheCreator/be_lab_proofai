// app/api/agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createJob } from "@/actions/agent";
import { auth } from "@/lib/auth"; // Import your authentication helper
import { v4 as uuidv4 } from "uuid"; // You might need to install this package

const prisma = new PrismaClient();
const FLASK_SERVER_URL =
  process.env.FLASK_SERVER_URL || "http://localhost:5000";

/**
 * GET /api/agents - Fetch agents
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await auth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || undefined;
    const verified = searchParams.has("verified")
      ? searchParams.get("verified") === "true"
      : undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const userId = searchParams.get("userId") || undefined;

    // Use Prisma to fetch agents
    const where: any = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ];
    }

    if (verified !== undefined) {
      where.isVerified = verified;
    }

    if (userId) {
      where.creatorId = userId;
    }

    const agents = await prisma.agent.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        creator: {
          select: {
            name: true,
          },
        },
        stars: {
          select: {
            id: true,
          },
        },
      },
    });

    // Transform the response
    const transformedAgents = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      version: agent.version,
      isVerified: agent.isVerified,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      creatorId: agent.creatorId,
      creatorName: agent.creator.name,
      starCount: agent.stars.length,
    }));

    return NextResponse.json({ agents: transformedAgents });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch agents",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/agents - Create a new agent
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await auth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Create a temporary agent entry to get an ID (Flask server will update it with proper metadata)
    const tempAgent = await prisma.agent.create({
      data: {
        name: "Processing...",
        description: "Agent is being processed",
        version: "0.0.1",
        creatorId: user.id,
      },
    });

    // Create a job for this agent creation
    const jobResult = await createJob("AGENT_CREATE", user.id, tempAgent.id);

    if ("error" in jobResult) {
      // Clean up the temporary agent if job creation fails
      await prisma.agent.delete({ where: { id: tempAgent.id } });
      return NextResponse.json({ error: jobResult.error }, { status: 500 });
    }

    // Forward the zip file to the Flask server
    const flaskFormData = new FormData();
    flaskFormData.append("file", zipFile);
    flaskFormData.append("agent_id", tempAgent.id);
    flaskFormData.append("job_id", jobResult.jobId);
    flaskFormData.append("user_id", user.id);

    // Send to Flask server
    const flaskResponse = await fetch(`${FLASK_SERVER_URL}/api/agents/create`, {
      method: "POST",
      body: flaskFormData,
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json();

      // Clean up if Flask server rejects the request
      await prisma.agent.delete({ where: { id: tempAgent.id } });
      await prisma.job.delete({ where: { id: jobResult.jobId } });

      return NextResponse.json(
        { error: "Flask server rejected the request", details: errorData },
        { status: flaskResponse.status },
      );
    }

    // Return success with job ID for tracking
    return NextResponse.json({
      success: true,
      message: "Agent creation process started",
      agentId: tempAgent.id,
      jobId: jobResult.jobId,
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      {
        error: "Failed to create agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
