// File: app/api/sessions/[id]/variables/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";

// Get user variables for a session
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
    });

    if (!userSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // // Check if user owns this session
    // if (userSession.userId !== session.user.id) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    // }

    // Get all variables for the session
    const variables = await prisma.userVariable.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(variables);
  } catch (error) {
    console.error("Error fetching user variables:", error);
    return NextResponse.json(
      { error: "Failed to fetch user variables" },
      { status: 500 },
    );
  }
}

// Create a new user variable
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const sessionId = params.id;
    const { key, value } = await req.json();

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Key and value are required" },
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

    // // Check if user owns this session
    // if (userSession.userId !== session.user.id) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    // }

    // Check if session is already ended
    if (userSession.endedAt) {
      return NextResponse.json(
        { error: "Cannot add variables to ended session" },
        { status: 400 },
      );
    }

    // Create or update variable (upsert to handle conflicts)
    const variable = await prisma.userVariable.upsert({
      where: {
        sessionId_key: {
          sessionId,
          key,
        },
      },
      update: {
        value,
      },
      create: {
        sessionId,
        key,
        value,
      },
    });

    return NextResponse.json(variable, { status: 201 });
  } catch (error) {
    console.error("Error creating/updating user variable:", error);
    return NextResponse.json(
      { error: "Failed to create/update user variable" },
      { status: 500 },
    );
  }
}
