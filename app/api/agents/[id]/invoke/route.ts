// app/api/agents/[id]/invoke/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/actions/agent";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import axios from "axios";

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
    const { prompt, sessionId } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    let session;

    // Check if sessionId was provided
    if (sessionId) {
      // Verify session exists and belongs to this user
      const existingSession = await prisma.session.findUnique({
        where: {
          id: sessionId,
          userId: user.id,
          agentId: agentId,
        },
      });

      if (!existingSession) {
        return NextResponse.json(
          { error: "Session not found or unauthorized" },
          { status: 404 },
        );
      }

      // Use existing session and add new message to chat history
      session = await prisma.session.update({
        where: { id: sessionId },
        data: {
          chatHistory: {
            create: {
              role: "user",
              content: prompt,
            },
          },
        },
      });
    } else {
      // Create a new session for this invocation
      session = await prisma.session.create({
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
    }

    // Create a job for this agent invocation
    const jobResult = await createJob(
      "AGENT_INVOCATION",
      user.id,
      agentId,
      session.id,
    );

    if ("error" in jobResult) {
      // Only clean up if we created a new session
      if (!sessionId) {
        await prisma.session.delete({ where: { id: session.id } });
      }
      return NextResponse.json({ error: jobResult.error }, { status: 500 });
    }

    // This endpoint is unimplemented as per requirements
    // In a real implementation, you would forward the request to the Flask server for processing

    try {
      // Send to Flask server using Axios
      const flaskResponse = await axios.post(
        `${FLASK_SERVER_URL}/api/agents/${agentId}/invoke`,
        {
          sessionId: session.id,
          jobId: jobResult.jobId,
          userId: user.id,
          prompt: prompt,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      // Axios automatically throws for non-2xx responses, so if we get here, it was successful
    } catch (error) {
      // Handle Axios errors
      const errorData =
        axios.isAxiosError(error) && error.response?.data
          ? error.response.data
          : { message: "Unknown error occurred" };

      const statusCode =
        axios.isAxiosError(error) && error.response?.status
          ? error.response.status
          : 500;

      // Clean up if Flask server rejects the request, but only for new sessions
      if (!sessionId) {
        await prisma.session.delete({ where: { id: session.id } });
      }
      await prisma.job.delete({ where: { id: jobResult.jobId } });

      return NextResponse.json(
        { error: "Flask server rejected the request", details: errorData },
        { status: statusCode },
      );
    }

    // Return success with job ID and session ID for tracking
    return NextResponse.json({
      success: true,
      message: sessionId
        ? "Continued agent conversation"
        : "Started new agent conversation",
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
