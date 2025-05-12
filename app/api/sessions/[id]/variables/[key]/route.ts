// File: app/api/sessions/[id]/variables/[key]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";

// Update a specific user variable
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; key: string } },
) {
  try {
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const sessionId = params.id;
    const variableKey = params.key;
    const { value } = await req.json();

    if (value === undefined) {
      return NextResponse.json({ error: "Value is required" }, { status: 400 });
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
        { error: "Cannot modify variables in ended session" },
        { status: 400 },
      );
    }

    // Check if variable exists
    const existingVariable = await prisma.userVariable.findUnique({
      where: {
        sessionId_key: {
          sessionId,
          key: variableKey,
        },
      },
    });

    if (!existingVariable) {
      return NextResponse.json(
        { error: "Variable not found" },
        { status: 404 },
      );
    }

    // Update variable
    const updatedVariable = await prisma.userVariable.update({
      where: {
        sessionId_key: {
          sessionId,
          key: variableKey,
        },
      },
      data: {
        value,
      },
    });

    return NextResponse.json(updatedVariable);
  } catch (error) {
    console.error("Error updating user variable:", error);
    return NextResponse.json(
      { error: "Failed to update user variable" },
      { status: 500 },
    );
  }
}

// Delete a specific user variable
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; key: string } },
) {
  try {
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const sessionId = params.id;
    const variableKey = params.key;

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
        { error: "Cannot delete variables in ended session" },
        { status: 400 },
      );
    }

    // Delete variable
    await prisma.userVariable.delete({
      where: {
        sessionId_key: {
          sessionId,
          key: variableKey,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Handle not found error specifically
    if ((error as any).code === "P2025") {
      return NextResponse.json(
        { error: "Variable not found" },
        { status: 404 },
      );
    }

    console.error("Error deleting user variable:", error);
    return NextResponse.json(
      { error: "Failed to delete user variable" },
      { status: 500 },
    );
  }
}
