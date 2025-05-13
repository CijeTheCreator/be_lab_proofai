// File: app/api/sessions/[id]/messages/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";

// Add multiple chat messages to a session at once
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    //TODO: Suspending Auth for now
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const sessionId = params.id;
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Valid messages array is required" },
        { status: 400 },
      );
    }

    // Validate all messages
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: "Each message must have role and content" },
          { status: 400 },
        );
      }

      if (!["user", "agent", "system"].includes(msg.role)) {
        return NextResponse.json(
          { error: "Invalid role specified" },
          { status: 400 },
        );
      }
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

    //TODO: Suspending Auth for now
    // // Check if user owns this session
    // if (userSession.userId !== session.user.id) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    // }

    // Check if session is already ended
    if (userSession.endedAt) {
      return NextResponse.json(
        { error: "Cannot add messages to ended session" },
        { status: 400 },
      );
    }

    // Create all messages in a transaction
    const createdMessages = await prisma.$transaction(
      messages.map((msg) =>
        prisma.chatMessage.create({
          data: {
            sessionId,
            role: msg.role,
            content: msg.content,
          },
        }),
      ),
    );

    return NextResponse.json(createdMessages, { status: 201 });
  } catch (error) {
    console.error("Error creating chat messages in bulk:", error);
    return NextResponse.json(
      { error: "Failed to create chat messages" },
      { status: 500 },
    );
  }
}
