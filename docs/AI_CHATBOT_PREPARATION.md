# AI Chatbot Preparation

This document describes the provider-agnostic SerbisyoToledo assistant integration.

## Current state

The assistant supports Gemini as its first provider adapter while retaining deterministic fallback answers in English or Cebuano.

No assistant conversation is stored in MySQL. Recent messages are held only in the browser while the chatbot is open and are sent as a bounded stateless history with each request.

## Frontend

The chatbot is user-triggered and only appears on discovery/help contexts:

- Home
- Browse Services
- Client Dashboard
- Public provider pages when viewed by a guest or client

It does not appear in:

- Service Provider workspace pages
- Requests
- Notifications
- Settings
- Provider Schedule
- Provider Availability
- Authentication pages
- Any Admin page

Visibility is centralized in `src/utils/chatbotVisibility.js` and covered by tests.

`src/components/common/Chatbot.jsx` calls `assistantAPI.sendMessage()`. When the backend returns an action of `recommend_providers`, the frontend uses the existing public provider recommendation API and renders matching providers.

The chat scrolls to the newest message/reply automatically.

## Backend contract

### GET /api/assistant/capabilities

Reports whether the assistant endpoint is available and whether an AI provider is configured.

### POST /api/assistant/message

Request shape:

```json
{
  "message": "I need a plumber near Poblacion",
  "locale": "en",
  "context": {
    "route": "/feed",
    "role": "client"
  },
  "history": [
    {
      "role": "user",
      "content": "Previous message"
    },
    {
      "role": "assistant",
      "content": "Previous reply"
    }
  ]
}
```

The backend keeps at most the latest 8 history items and truncates individual items. History is not persisted.

Response shape may contain:

```json
{
  "success": true,
  "data": {
    "mode": "fallback",
    "providerConfigured": false,
    "reply": "I can help...",
    "intent": "service_discovery",
    "action": {
      "type": "recommend_providers",
      "query": "I need a plumber near Poblacion"
    },
    "locale": "en"
  }
}
```

## Provider integration

The provider-agnostic coordinator is `backend/services/assistantService.js`. Gemini-specific code is isolated in `backend/services/ai/geminiAdapter.js`; the maintained server-side instruction is `backend/services/ai/geminiInstruction.js`.

Required environment variable names:

`AI_PROVIDER=gemini`, `AI_MODEL`, and `AI_API_KEY`. The API key is server-side only and is never included in capabilities, responses, frontend data, or safe diagnostics.

Gemini uses structured JSON output. The server validates intent, action type, filter sizes, numeric ranges, dates, locales, and categories against the SerbisyoToledo taxonomy before returning an action. Provider recommendations are still fetched only from the platform recommendation API; Gemini never receives the provider database.

The current request is stateless: only the latest eight bounded chat messages plus allowlisted route, role, locale, and Toledo date context are sent to the provider. No cookies, JWTs, account data, verification documents, or environment data are sent. No conversation is persisted.

Gemini requests have a bounded timeout. Provider errors, quota errors, timeouts, and malformed JSON fall back to the deterministic assistant with a usable HTTP 200 response. Future providers can be added as separate adapters while preserving the assistant API contract.

## Database

This preparation intentionally does not add chatbot tables, messages, embeddings, vector search, or schema migrations.

Decisions about conversation persistence, knowledge retrieval, audit logs, or AI-specific data storage should be handled during the later major database audit rather than being introduced piecemeal now.
