// File: app/api/sessions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";

// Get a specific session
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const sessionId = params.id;

    // Find the session and verify ownership
    const userSession = await prisma.session.findUnique({
      where: {
        id: sessionId,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: {
            chatHistory: true,
            userVars: true,
          },
        },
      },
    });

    if (!userSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if user owns this session
    // if (userSession.userId !== session.user.id) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    // }

    return NextResponse.json(userSession);
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 },
    );
  }
}

// Update a session (e.g., end it)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const sessionId = params.id;
    const { endSession } = await req.json();

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

    // Update session (currently just supports ending it)
    const updatedSession = await prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        ...(endSession ? { endedAt: new Date() } : {}),
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 },
    );
  }
}

// Delete a session
export async function DELETE(
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

    // Delete session and all related records (cascades via schema)
    await prisma.session.delete({
      where: {
        id: sessionId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 },
    );
  }
}
