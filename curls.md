```bash
# GET /api/agents
curl -X GET "http://localhost:3000/api/agents"
```

```bash
# GET /api/agents with query parameters
curl -X GET "http://localhost:3000/api/agents?query=test&verified=true&page=1&limit=5&userId=827a2a72-ffc2-443b-ae91-f6ea1b7f1b33"
```

```bash
# POST /api/agents with zip file
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/file.zip"
```

```bash
# GET /api/agents/[id]
curl -X GET http://localhost:3000/api/agents/912042b3-7913-412d-b04c-78593051c2fc
```

```bash
# PUT /api/agents/[id] with zip file
curl -X PUT http://localhost:3000/api/agents/912042b3-7913-412d-b04c-78593051c2fc \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/file.zip"
```

```bash
# DELETE /api/agents/[id]
curl -X DELETE http://localhost:3000/api/agents/912042b3-7913-412d-b04c-78593051c2fc
```

```bash
# GET /api/jobs/[id]
curl -X GET http://localhost:3000/api/jobs/b01c2004-921c-4f73-b4bb-7a4e9466f13d
```

```bash
# POST /api/sessions - Create a new session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"agentId": "912042b3-7913-412d-b04c-78593051c2fc"}'
```

```bash
# GET /api/sessions - Get all sessions for current user
curl -X GET "http://localhost:3000/api/sessions?agentId=912042b3-7913-412d-b04c-78593051c2fc&includeEnded=false&page=1&limit=10"
```

```bash
# GET /api/sessions/[id] - Get a specific session
curl -X GET http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8
```

```bash
# PATCH /api/sessions/[id] - Update a session (e.g., end it)
curl -X PATCH http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8 \
  -H "Content-Type: application/json" \
  -d '{"endSession": true}'
```

```bash
# DELETE /api/sessions/[id] - Delete a session
curl -X DELETE http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8
```

```bash
# GET /api/sessions/[id]/variables - Get user variables for a session
curl -X GET http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8/variables
```

```bash
# POST /api/sessions/[id]/variables - Create a new user variable
curl -X POST http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8/variables \
  -H "Content-Type: application/json" \
  -d '{"key": "VARIABLE_KEY", "value": "VARIABLE_VALUE"}'
```

```bash
# PUT /api/sessions/[id]/variables/[key] - Update a specific user variable
curl -X PUT http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8/variables/boy \
  -H "Content-Type: application/json" \
  -d '{"value": "bar"}'
```

```bash
# DELETE /api/sessions/[id]/variables/[key] - Delete a specific user variable
curl -X DELETE http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8/variables/boy
```

```bash
# POST request to add a new chat message
curl -X POST http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8/messages \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "Hello, how are you?"}'

# GET request to fetch chat messages from a session
curl -X GET "http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8/messages?limit=50&before=2efed444-c8c2-4373-abca-a8df86e9ce71"
curl -X GET "http://localhost:3000/api/sessions/18909934-e7a2-41f3-b2f5-42b5ebb7d1c8/messages?limit=50"
```

# POST request to invoke an agent with a new session

curl -X POST http://localhost:3000/api/agents/{agentId}/invoke \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer {your_token}" \
 -d '{"prompt": "What is the weather like today?"}'

# POST request to invoke an agent using an existing session

curl -X POST http://localhost:3000/api/agents/912042b3-7913-412d-b04c-78593051c2fc/invoke \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer {your_token}" \
 -d '{"prompt": "Continue our conversation.", "sessionId": "18909934-e7a2-41f3-b2f5-42b5ebb7d1c8"}'

# Piston

curl -X POST http://localhost:2000/api/v2/packages \
 -H "Content-Type: application/json" \
 -d '{"language": "python", "version": "3.10.0"}'
