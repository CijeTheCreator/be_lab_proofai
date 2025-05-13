// app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkJobStatus } from "@/actions/agent";
import { auth } from "@/lib/auth"; // Import your authentication helper

/**
 * GET /api/jobs/[id] - Get job status
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

    const jobId = params.id;
    const result = await checkJobStatus(jobId, user.id);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching job status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch job status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
