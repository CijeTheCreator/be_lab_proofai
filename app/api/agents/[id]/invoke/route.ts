// app/api/agents/[id]/invoke/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createJob } from "@/actions/agent";
import { auth } from "@/lib/auth"; // Import your authentication helper

const prisma = new PrismaClient();
const FLASK_SERVER_URL =
  process.env.FLASK_SERVER_URL || "http://localhost:5000";

/**
 * POST /api/agents/[id]/invoke - Invoke an agent with a prompt
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

    // Check if agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Parse the request body
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    // Create a new session for this invocation
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        agentId: agentId,
        chatHistory: {
          create: {
            role: "user",
            content: prompt,
          },
        },
      },
    });

    // Create a job for this agent invocation
    const jobResult = await createJob(
      "AGENT_INVOCATION",
      user.id,
      agentId,
      session.id,
    );

    if ("error" in jobResult) {
      // Clean up the session if job creation fails
      await prisma.session.delete({ where: { id: session.id } });
      return NextResponse.json({ error: jobResult.error }, { status: 500 });
    }

    // This endpoint is unimplemented as per requirements
    // In a real implementation, you would forward the request to the Flask server for processing
    // The code below is just a placeholder for future implementation

    /*
    // Send to Flask server
    const flaskResponse = await fetch(`${FLASK_SERVER_URL}/api/agents/${agentId}/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: session.id,
        jobId: jobResult.jobId,
        userId: user.id,
        prompt: prompt,
      }),
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json();
      
      // Clean up if Flask server rejects the request
      await prisma.session.delete({ where: { id: session.id } });
      await prisma.job.delete({ where: { id: jobResult.jobId } });
      
      return NextResponse.json(
        { error: 'Flask server rejected the request', details: errorData },
        { status: flaskResponse.status }
      );
    }
    */

    // Return success with job ID and session ID for tracking
    return NextResponse.json({
      success: true,
      message: "Agent invocation process started",
      agentId: agentId,
      sessionId: session.id,
      jobId: jobResult.jobId,
      note: "This endpoint is unimplemented as per requirements",
    });
  } catch (error) {
    console.error("Error invoking agent:", error);
    return NextResponse.json(
      {
        error: "Failed to invoke agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
