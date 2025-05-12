// File: app/api/sessions/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Add a new chat message to a session
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = params.id;
    const { role, content } = await req.json();

    if (!role || !content) {
      return NextResponse.json(
        { error: "Role and content are required" },
        { status: 400 },
      );
    }

    // Validate role
    if (!["user", "agent", "system"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role specified" },
        { status: 400 },
      );
    }

    // Find the session and verify ownership
    const userSession = await prisma.session.findUnique({
      where: {
        id: sessionId,
      },
    });

    if (!userSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if user owns this session
    if (userSession.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if session is already ended
    if (userSession.endedAt) {
      return NextResponse.json(
        { error: "Cannot add messages to ended session" },
        { status: 400 },
      );
    }

    // Create new chat message
    const newMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
      },
    });

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error("Error creating chat message:", error);
    return NextResponse.json(
      { error: "Failed to create chat message" },
      { status: 500 },
    );
  }
}

// Get chat messages for a session
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = params.id;
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const before = url.searchParams.get("before"); // Message ID to fetch messages before

    // Find the session and verify ownership
    const userSession = await prisma.session.findUnique({
      where: {
        id: sessionId,
      },
    });

    if (!userSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if user owns this session
    if (userSession.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Build where clause
    const where: any = {
      sessionId,
    };

    // For pagination: Get messages before a specific message ID
    if (before) {
      const beforeMessage = await prisma.chatMessage.findUnique({
        where: { id: before },
      });

      if (beforeMessage) {
        where.timestamp = {
          lt: beforeMessage.timestamp,
        };
      }
    }

    // Get messages with pagination
    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
    });

    // Return in chronological order (oldest first)
    return NextResponse.json(messages.reverse());
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat messages" },
      { status: 500 },
    );
  }
}
