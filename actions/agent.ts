// actions/agent.ts
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// Types
export type ErrorResponse = {
  error: string;
  details?: any;
};

type AgentListResponse =
  | {
      agents: Array<{
        id: string;
        name: string;
        description: string;
        version: string;
        isVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
        creatorId: string;
        creatorName: string;
        starCount: number;
      }>;
    }
  | ErrorResponse;

type AgentDetailResponse =
  | {
      agent: {
        id: string;
        name: string;
        description: string;
        version: string;
        isVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
        creatorId: string;
        creatorName: string;
        files: Array<{
          id: string;
          filename: string;
          filepath: string;
          filesize: number;
          mimetype: string;
          createdAt: Date;
        }>;
        envVars: Array<{
          id: string;
          key: string;
          value: string;
        }>;
        tags: Array<{
          id: string;
          name: string;
        }>;
        starCount: number;
        isStarredByUser: boolean;
      };
    }
  | ErrorResponse;

type AgentFileResponse =
  | {
      file: {
        id: string;
        filename: string;
        filepath: string;
        filesize: number;
        mimetype: string;
        url: string; // URL to fetch the actual file content from Flask server
      };
    }
  | ErrorResponse;

type StarAgentResponse =
  | {
      success: boolean;
      isStarred: boolean;
    }
  | ErrorResponse;

type SetEnvVarResponse =
  | {
      success: boolean;
      envVar: {
        id: string;
        key: string;
        value: string;
      };
    }
  | ErrorResponse;

type VerifyAgentResponse =
  | {
      success: boolean;
      agent: {
        id: string;
        isVerified: boolean;
      };
    }
  | ErrorResponse;

type CreateJobResponse =
  | {
      success: boolean;
      jobId: string;
    }
  | ErrorResponse;

type JobStatusResponse =
  | {
      job: {
        id: string;
        type: string;
        status: string;
        progress: number;
        statusMessage: string | null;
        errorMessage: string | null;
        createdAt: Date;
        startedAt: Date | null;
        completedAt: Date | null;
        logs: Array<{
          id: string;
          level: string;
          message: string;
          timestamp: Date;
        }>;
      };
    }
  | ErrorResponse;

/**
 * Fetch a list of agents with optional filtering
 */
export async function fetchAgents(
  userId?: string,
  query?: string,
  verified?: boolean,
  page: number = 1,
  limit: number = 10,
): Promise<AgentListResponse> {
  try {
    // Build the where clause based on filters
    const where: any = {};

    if (userId) {
      where.creatorId = userId;
    }

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ];
    }

    if (verified !== undefined) {
      where.isVerified = verified;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Fetch agents
    const agents = await prisma.agent.findMany({
      where,
      skip,
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

    return { agents: transformedAgents };
  } catch (error) {
    console.error("Error fetching agents:", error);
    return {
      error: "Failed to fetch agents",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch agent details by ID
 */
export async function fetchAgentById(
  agentId: string,
  userId?: string,
): Promise<AgentDetailResponse> {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        creator: {
          select: {
            name: true,
          },
        },
        files: true,
        envVars: true,
        tags: true,
        stars: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!agent) {
      return {
        error: "Agent not found",
      };
    }

    // Check if the current user has starred this agent
    const isStarredByUser = userId
      ? agent.stars.some((star) => star.userId === userId)
      : false;

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        version: agent.version,
        isVerified: agent.isVerified,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        creatorId: agent.creatorId,
        creatorName: agent.creator.name,
        files: agent.files.map((file) => ({
          id: file.id,
          filename: file.filename,
          filepath: file.filepath,
          filesize: file.filesize,
          mimetype: file.mimetype,
          createdAt: file.createdAt,
        })),
        envVars: agent.envVars.map((envVar) => ({
          id: envVar.id,
          key: envVar.key,
          value: envVar.value,
        })),
        tags: agent.tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
        })),
        starCount: agent.stars.length,
        isStarredByUser,
      },
    };
  } catch (error) {
    console.error("Error fetching agent:", error);
    return {
      error: "Failed to fetch agent details",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch agent file details
 * This doesn't return the file content (that's handled by the Flask server)
 * But returns metadata about the file
 */
export async function fetchAgentFile(
  fileId: string,
): Promise<AgentFileResponse> {
  try {
    const file = await prisma.agentFile.findUnique({
      where: { id: fileId },
      include: {
        agent: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!file) {
      return {
        error: "File not found",
      };
    }

    // Construct URL to fetch file from Flask server
    // This is just a placeholder - you'll need to adjust based on your Flask server setup
    const fileUrl = `${process.env.FLASK_SERVER_URL}/api/agents/${file.agent.id}/files/${file.id}`;

    return {
      file: {
        id: file.id,
        filename: file.filename,
        filepath: file.filepath,
        filesize: file.filesize,
        mimetype: file.mimetype,
        url: fileUrl,
      },
    };
  } catch (error) {
    console.error("Error fetching agent file:", error);
    return {
      error: "Failed to fetch file details",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Star or unstar an agent
 */
export async function toggleAgentStar(
  agentId: string,
  userId: string,
): Promise<StarAgentResponse> {
  try {
    // Check if the agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return {
        error: "Agent not found",
      };
    }

    // Check if the user has already starred this agent
    const existingStar = await prisma.starredAgent.findFirst({
      where: {
        agentId,
        userId,
      },
    });

    let isStarred: boolean;

    if (existingStar) {
      // Remove the star
      await prisma.starredAgent.delete({
        where: { id: existingStar.id },
      });
      isStarred = false;
    } else {
      // Add a star
      await prisma.starredAgent.create({
        data: {
          agentId,
          userId,
        },
      });
      isStarred = true;
    }

    // Revalidate pages
    revalidatePath(`/agents/${agentId}`);
    revalidatePath("/agents");

    return {
      success: true,
      isStarred,
    };
  } catch (error) {
    console.error("Error toggling agent star:", error);
    return {
      error: "Failed to star/unstar agent",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Set environment variable for an agent
 */
export async function setAgentEnvVar(
  agentId: string,
  userId: string,
  key: string,
  value: string,
): Promise<SetEnvVarResponse> {
  try {
    // Check if the agent exists and belongs to the user
    const agent = await prisma.agent.findUnique({
      where: {
        id: agentId,
        creatorId: userId, // Ensure the user owns this agent
      },
    });

    if (!agent) {
      return {
        error: "Agent not found or you do not have permission to modify it",
      };
    }

    // Check if the env var already exists
    const existingEnvVar = await prisma.agentEnvVar.findFirst({
      where: {
        agentId,
        key,
      },
    });

    let envVar;

    if (existingEnvVar) {
      // Update existing env var
      envVar = await prisma.agentEnvVar.update({
        where: { id: existingEnvVar.id },
        data: { value },
      });
    } else {
      // Create new env var
      envVar = await prisma.agentEnvVar.create({
        data: {
          agentId,
          key,
          value,
        },
      });
    }

    // Revalidate page
    revalidatePath(`/agents/${agentId}`);

    return {
      success: true,
      envVar: {
        id: envVar.id,
        key: envVar.key,
        value: envVar.value,
      },
    };
  } catch (error) {
    console.error("Error setting agent env var:", error);
    return {
      error: "Failed to set environment variable",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify an agent (admin only)
 */
export async function verifyAgent(
  agentId: string,
  userId: string,
  isAdmin: boolean,
): Promise<VerifyAgentResponse> {
  try {
    // Check if the user is an admin
    if (!isAdmin) {
      return {
        error: "Unauthorized. Only admins can verify agents.",
      };
    }

    // Check if the agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return {
        error: "Agent not found",
      };
    }

    // Toggle verification status
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: { isVerified: !agent.isVerified },
    });

    // Revalidate pages
    revalidatePath(`/agents/${agentId}`);
    revalidatePath("/agents");

    return {
      success: true,
      agent: {
        id: updatedAgent.id,
        isVerified: updatedAgent.isVerified,
      },
    };
  } catch (error) {
    console.error("Error verifying agent:", error);
    return {
      error: "Failed to update agent verification status",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check job status
 */
export async function checkJobStatus(
  jobId: string,
  userId: string,
): Promise<JobStatusResponse> {
  try {
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
        userId, // Ensure the user owns this job
      },
      include: {
        logs: {
          orderBy: {
            timestamp: "asc",
          },
        },
      },
    });

    if (!job) {
      return {
        error: "Job not found or you do not have permission to view it",
      };
    }

    return {
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        statusMessage: job.statusMessage,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        logs: job.logs.map((log) => ({
          id: log.id,
          level: log.level,
          message: log.message,
          timestamp: log.timestamp,
        })),
      },
    };
  } catch (error) {
    console.error("Error checking job status:", error);
    return {
      error: "Failed to fetch job status",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a job (internal use)
 */
export async function createJob(
  type:
    | "AGENT_CREATE"
    | "AGENT_UPDATE"
    | "MODEL_CREATE"
    | "MODEL_UPDATE"
    | "DATASET_CREATE"
    | "DATASET_UPDATE"
    | "AGENT_INVOCATION",
  userId: string,
  resourceId?: string,
  sessionId?: string,
): Promise<CreateJobResponse> {
  try {
    // Determine which resource ID field to populate
    const data: any = {
      type,
      userId,
      status: "QUEUED",
    };

    if (resourceId) {
      if (type.startsWith("AGENT_")) {
        data.agentId = resourceId;
      } else if (type.startsWith("MODEL_")) {
        data.modelId = resourceId;
      } else if (type.startsWith("DATASET_")) {
        data.datasetId = resourceId;
      }
    }

    if (sessionId && type === "AGENT_INVOCATION") {
      data.sessionId = sessionId;
    }

    const job = await prisma.job.create({
      data,
    });

    return {
      success: true,
      jobId: job.id,
    };
  } catch (error) {
    console.error("Error creating job:", error);
    return {
      error: "Failed to create job",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}
