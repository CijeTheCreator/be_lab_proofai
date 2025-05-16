### **Overview of Architecture**

I am building an agent hub with a nextjs frontend and backend and an additional flask backend. The focus is currently on the flask backend as the nextjs part is ready. The agent hub allows developers to deploy agents and users to invoke them. The nextjs frontend and backend handles a lot of the user interaction witht he agent, however the flask server mainly handles the invocation of deployed agents.

A user who wants to invoke an agent uses the nextjs route provided below, the schema is also provided for extra context.

```typescript
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
```

```prisma

// This is your Prisma schema file with Clerk integration
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  USER
  ADMIN
}

model User {
  id        String   @id @default(uuid())
  clerkId   String   @unique // Add Clerk's user ID for mapping
  name      String
  email     String   @unique
  imageUrl  String? // Profile picture from Clerk
  role      UserRole @default(USER) // For permissions
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // User's published content
  publishedAgents   Agent[]
  publishedDatasets Dataset[]
  publishedModels   Model[]

  // User's starred content
  starredAgents   StarredAgent[]
  starredDatasets StarredDataset[]
  starredModels   StarredModel[]

  // User's sessions
  sessions Session[]

  // User's jobs
  jobs Job[]

  // User's profile
  profile Profile?
}

// User profile for additional information
model Profile {
  id          String   @id @default(uuid())
  bio         String?
  location    String?
  website     String?
  companyName String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relation to User
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Agent {
  id          String   @id @default(uuid())
  name        String
  description String
  version     String
  isVerified  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Creator relationship
  creatorId String
  creator   User   @relation(fields: [creatorId], references: [id])

  // Agent files
  files AgentFile[]

  // Environment variables
  envVars AgentEnvVar[]

  // Tags
  tags AgentTag[]

  // Sessions
  sessions Session[]

  // Stars
  stars StarredAgent[]

  // Jobs related to this agent
  jobs Job[]

  @@index([creatorId])
}

model AgentFile {
  id        String   @id @default(uuid())
  filename  String
  filepath  String
  filesize  Int
  mimetype  String
  createdAt DateTime @default(now())

  // Relationship to Agent
  agentId String
  agent   Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([agentId])
}

model AgentEnvVar {
  id        String   @id @default(uuid())
  key       String
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relationship to Agent
  agentId String
  agent   Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([agentId, key])
  @@index([agentId])
}

model AgentTag {
  id   String @id @default(uuid())
  name String

  // Relationship to Agent
  agentId String
  agent   Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([agentId, name])
  @@index([agentId])
}

model StarredAgent {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Relationships
  userId  String
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  agentId String
  agent   Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([userId, agentId])
  @@index([userId])
  @@index([agentId])
}

model Session {
  id        String    @id @default(uuid())
  startedAt DateTime  @default(now())
  endedAt   DateTime?

  // Relationships
  userId  String
  user    User   @relation(fields: [userId], references: [id])
  agentId String
  agent   Agent  @relation(fields: [agentId], references: [id])

  // Session data
  userVars    UserVariable[]
  chatHistory ChatMessage[]

  // Jobs related to this session (agent invocation jobs)
  jobs Job[]

  @@index([userId])
  @@index([agentId])
}

model UserVariable {
  id        String   @id @default(uuid())
  key       String
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relationship to Session
  sessionId String
  session   Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, key])
  @@index([sessionId])
}

model ChatMessage {
  id        String   @id @default(uuid())
  role      String // 'user', 'agent', 'system'
  content   String
  timestamp DateTime @default(now())

  // Relationship to Session
  sessionId String
  session   Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

model Dataset {
  id          String   @id @default(uuid())
  name        String
  description String
  version     String
  isVerified  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Creator relationship
  creatorId String
  creator   User   @relation(fields: [creatorId], references: [id])

  // Dataset files
  files DatasetFile[]

  // Stars
  stars StarredDataset[]

  // Jobs related to this dataset
  jobs Job[]

  @@index([creatorId])
}

model DatasetFile {
  id        String   @id @default(uuid())
  filename  String
  filepath  String
  filesize  Int
  mimetype  String
  createdAt DateTime @default(now())

  // Relationship to Dataset
  datasetId String
  dataset   Dataset @relation(fields: [datasetId], references: [id], onDelete: Cascade)

  @@index([datasetId])
}

model StarredDataset {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Relationships
  userId    String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  datasetId String
  dataset   Dataset @relation(fields: [datasetId], references: [id], onDelete: Cascade)

  @@unique([userId, datasetId])
  @@index([userId])
  @@index([datasetId])
}

model Model {
  id          String   @id @default(uuid())
  name        String
  description String
  version     String
  isVerified  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Creator relationship
  creatorId String
  creator   User   @relation(fields: [creatorId], references: [id])

  // Model files
  files ModelFile[]

  // Stars
  stars StarredModel[]

  // Jobs related to this model
  jobs Job[]

  @@index([creatorId])
}

model ModelFile {
  id        String   @id @default(uuid())
  filename  String
  filepath  String
  filesize  Int
  mimetype  String
  createdAt DateTime @default(now())

  // Relationship to Model
  modelId String
  model   Model  @relation(fields: [modelId], references: [id], onDelete: Cascade)

  @@index([modelId])
}

model StarredModel {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Relationships
  userId  String
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  modelId String
  model   Model  @relation(fields: [modelId], references: [id], onDelete: Cascade)

  @@unique([userId, modelId])
  @@index([userId])
  @@index([modelId])
}

// Job system for tracking operations
enum JobType {
  AGENT_CREATE
  AGENT_UPDATE
  MODEL_CREATE
  MODEL_UPDATE
  DATASET_CREATE
  DATASET_UPDATE
  AGENT_INVOCATION
}

enum JobStatus {
  QUEUED
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELLED
}

model Job {
  id            String    @id @default(uuid())
  type          JobType
  status        JobStatus @default(QUEUED)
  progress      Float     @default(0) // 0-100%
  statusMessage String?
  errorMessage  String?
  createdAt     DateTime  @default(now())
  startedAt     DateTime?
  completedAt   DateTime?

  // User who initiated the job
  userId String
  user   User   @relation(fields: [userId], references: [id])

  // Related resources (only one will be populated based on job type)
  agentId   String?
  agent     Agent?   @relation(fields: [agentId], references: [id])
  datasetId String?
  dataset   Dataset? @relation(fields: [datasetId], references: [id])
  modelId   String?
  model     Model?   @relation(fields: [modelId], references: [id])

  // For AGENT_INVOCATION jobs, link to the session
  sessionId String?
  session   Session? @relation(fields: [sessionId], references: [id])

  // Logs for the job
  logs JobLog[]

  @@index([userId])
  @@index([agentId])
  @@index([datasetId])
  @@index([modelId])
  @@index([sessionId])
  @@index([type])
  @@index([status])
  @@index([createdAt])
}

model JobLog {
  id        String   @id @default(uuid())
  level     String // 'info', 'warning', 'error', etc.
  message   String
  timestamp DateTime @default(now())

  // Relationship to Job
  jobId String
  job   Job    @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@index([timestamp])
}
```

As seen, the session id, job id and so on, is passed from the nextjs app to the flask app. Use the id to fetch and build the context.

The architecture can be divided into three layers:

1. **Agent Interface Layer** – The Python module exposed to the agent code (e.g., `hub.get_env_vars()`)
2. **Execution Layer (Piston Integration)** – How context is passed into the sandboxed environment

---

## **1. Agent Interface Layer (Python SDK-like module)**

This is what the developer will import in their agent code:

```python
import hub

env = hub.get_env_vars()
user_vars = hub.get_user_vars()
hub.send_message("Hello from Agent!")
history = hub.get_chat_history()
result = hub.call_agent("agent_id", input_data)
```

```python
import json
import sys

_context = {}

def _init(context):
    global _context
    _context = context

def get_env_vars():
    return _context.get("env_vars", {})

def get_user_vars():
    return _context.get("user_vars", {})

def send_message(msg):
    print(json.dumps({"type": "message", "content": msg}))

def get_chat_history():
    return _context.get("chat_history", [])

def call_agent(agent_id, input_data):
    return {"status": "called"}

def call_llm(prompt):
    return {"status": "called"}
```

I have already built the interface and published it to pip

---

## **2. Execution Layer (Piston Integration)**

### Key Goal

You must inject the `hub.py` module and pass the runtime context as a JSON object at execution time.

### Implementation

You’ll need to:

1. Prepare a `hub.py` file dynamically with `_init()` already called using your context.
2. Include this file and the user agent code in the `files` field when submitting to Piston.
3. Modify the user's agent code if needed to call `_init()` at the top (or do it automatically via template).

#### Example Piston API Payload:

```json
{
  "language": "python3",
  "files": [
    {
      "name": "main.py",
      "content": "import hub\nhub._init(__context__)\n# agent code follows"
    },
    {
      "name": "hub.py",
      "content": "...contents of hub.py..."
    }
  ],
  "stdin": "",
  "args": [],
  "run": true
}
```

```python
__context__ = {...}  # JSON string of context
import hub
hub._init(__context__)
```

So your goal is to write the flask app.
use the ids provided from the next app to inject context.
Implement the funtions:

```python

def get_env_vars():
    return _context.get("env_vars", {})

def get_user_vars():
    return _context.get("user_vars", {})

def send_message(msg):
    print(json.dumps({"type": "message", "content": msg}))

def get_chat_history():
    return _context.get("chat_history", [])

def call_agent(agent_id, input_data):
    return {"status": "called"}

def call_llm(prompt):
    return {"status": "called"}
```

Calling send_message should just add a chat message to the database
call_agent should call google gemini and return the completion

When the piston completion is done, change the job status for the agent invocation

The piston is self hosted on my computer.

There is only one endpoint in the flask app, and that is for agent invocation. That is your only task.
