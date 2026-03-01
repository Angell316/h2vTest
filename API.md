# H2V Messenger — API Documentation

> **Version:** 0.6.1 · **Updated:** 2026-03-01  
> **Stack:** Node.js · TypeScript · Express · PostgreSQL (Prisma) · Redis · WebSocket

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Rate Limiting](#3-rate-limiting)
4. [Response Format](#4-response-format)
5. [Auth Endpoints](#5-auth-endpoints)
6. [User Endpoints](#6-user-endpoints)
7. [Chat Endpoints](#7-chat-endpoints)
8. [Message Endpoints](#8-message-endpoints)
9. [Keys (Signal Protocol)](#9-keys-signal-protocol)
10. [File Upload](#10-file-upload)
11. [WebSocket](#11-websocket)
12. [Error Reference](#12-error-reference)
13. [Database Schema](#13-database-schema)
14. [Quick Reference Table](#14-quick-reference-table)

---

## 1. Overview

| | Value |
|---|---|
| **Base URL** | `http://localhost:3000` |
| **Tunnel URL (dev)** | `https://<tuna-subdomain>.ru.tuna.am` |
| **WebSocket URL** | `ws://localhost:3000/ws` |
| **Content-Type** | `application/json` (except file upload) |
| **Auth scheme** | Bearer JWT |
| **Static files** | `GET /uploads/<filename>` |

---

## 2. Authentication

Protected endpoints require an `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Tokens are obtained from `POST /api/auth/login` or `POST /api/auth/register`.

| Token | Lifetime | Storage |
|---|---|---|
| `accessToken` | 7 days | Client memory / localStorage |
| `refreshToken` | 30 days | DB table `refresh_tokens` |

When `accessToken` expires, use `POST /api/auth/refresh` to get a new pair.  
The old `refreshToken` is invalidated on each refresh (**token rotation**).

---

## 3. Rate Limiting

| Route group | Limit | Window |
|---|---|---|
| `/api/auth/*` | 20 requests | 15 minutes |
| All other `/api/*` | 300 requests | 1 minute |

When exceeded:

```json
HTTP 429
{
  "success": false,
  "message": "Too many requests, try again later"
}
```

---

## 4. Response Format

Every response uses a unified envelope:

```json
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "message": "HUMAN_READABLE_OR_CODE"
}
```

Validation errors (422) include field-level details:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": {
    "email": ["Invalid email address"],
    "password": ["String must contain at least 8 character(s)"]
  }
}
```

---

## 5. Auth Endpoints

> Base path: `/api/auth`  
> **No authorization required.** Rate limit: **20 req / 15 min**.

---

### `POST /api/auth/register`

Register a new user account.

**Request body:**

```json
{
  "nickname": "john_doe",
  "email":    "john@example.com",
  "password": "secret123"
}
```

| Field | Type | Rules |
|---|---|---|
| `nickname` | string | 3–32 chars, `[a-zA-Z0-9_]` only |
| `email` | string | valid email |
| `password` | string | min 8 chars |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id":        "cmm7qjfzs005oqshgx4amqnwy",
      "nickname":  "john_doe",
      "email":     "john@example.com",
      "avatar":    null,
      "createdAt": "2026-03-01T12:00:00.000Z"
    },
    "tokens": {
      "accessToken":  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**Errors:**

| Status | message | Reason |
|---|---|---|
| 422 | `Validation error` | Invalid fields |
| 409 | `EMAIL_TAKEN` | Email already registered |
| 409 | `NICKNAME_TAKEN` | Nickname already taken |

---

### `POST /api/auth/login`

Login with email and password.

**Request body:**

```json
{
  "email":    "john@example.com",
  "password": "secret123"
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id":       "cmm7qjfzs005oqshgx4amqnwy",
      "nickname": "john_doe",
      "email":    "john@example.com",
      "avatar":   null
    },
    "tokens": {
      "accessToken":  "eyJ...",
      "refreshToken": "eyJ..."
    }
  }
}
```

**Errors:**

| Status | message |
|---|---|
| 401 | `INVALID_CREDENTIALS` |
| 422 | `Validation error` |

---

### `POST /api/auth/refresh`

Exchange a refresh token for a new token pair. The old refresh token is **immediately invalidated**.

**Request body:**

```json
{
  "refreshToken": "eyJ..."
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "accessToken":  "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Errors:**

| Status | message |
|---|---|
| 500 | `Invalid refresh token` |
| 500 | `Refresh token expired or not found` |

---

### `POST /api/auth/logout`

Invalidate a refresh token.

**Request body:**

```json
{
  "refreshToken": "eyJ..."
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": { "message": "Logged out" }
}
```

---

## 6. User Endpoints

> Base path: `/api/users`  
> **Requires Authorization.**

---

### `GET /api/users/me`

Get the current user's profile. Online status is enriched from Redis.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id":         "cmm7qjfzs005oqshgx4amqnwy",
    "nickname":   "john_doe",
    "avatar":     "/uploads/1740000000000-abc.jpg",
    "bio":        "Software engineer",
    "lastOnline": "2026-03-01T11:55:00.000Z",
    "isOnline":   true
  }
}
```

---

### `PATCH /api/users/me`

Update the current user's profile. All fields are optional.

**Request body:**

```json
{
  "nickname": "new_nickname",
  "avatar":   "https://example.com/avatar.jpg",
  "bio":      "New about me"
}
```

| Field | Type | Rules |
|---|---|---|
| `nickname` | string? | 3–32 chars |
| `avatar` | string? | valid URL |
| `bio` | string? | max 256 chars |

**Response `200`:** same as `GET /api/users/me`.

---

### `GET /api/users/search?q=<query>`

Search users by nickname (case-insensitive, partial match). Returns up to **20** results. Does not return the current user.

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | yes | search string |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id":         "cuid...",
      "nickname":   "alice",
      "avatar":     null,
      "bio":        null,
      "lastOnline": "2026-03-01T11:00:00.000Z",
      "isOnline":   false
    }
  ]
}
```

---

### `GET /api/users/:id`

Get any user's public profile by ID.

**URL params:** `:id` — user cuid.

**Response `200`:** same structure as `GET /api/users/me`.

**Errors:**

| Status | message |
|---|---|
| 404 | `User not found` |

---

## 7. Chat Endpoints

> Base path: `/api/chats`  
> **Requires Authorization.**

---

### `GET /api/chats`

Get the current user's chat list, sorted by `updatedAt` descending (cursor pagination).

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `cursor` | string | — | ID of the last received chat (for next page) |
| `limit` | number | 30 | 1–100 |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "chats": [
      {
        "id":          "cmm7qjo2y00bcqshgcarwx790",
        "type":        "DIRECT",
        "name":        null,
        "avatar":      null,
        "description": null,
        "createdAt":   "2026-03-01T10:00:00.000Z",
        "updatedAt":   "2026-03-01T12:00:00.000Z",
        "members": [
          {
            "id":       "cuid...",
            "chatId":   "cuid...",
            "userId":   "cuid...",
            "role":     "OWNER",
            "joinedAt": "2026-03-01T10:00:00.000Z",
            "user": {
              "id":       "cuid...",
              "nickname": "alice",
              "avatar":   null,
              "isOnline": true
            }
          }
        ],
        "messages": [
          {
            "id":         "cuid...",
            "text":       "Hey!",
            "ciphertext": null,
            "signalType": 0,
            "type":       "TEXT",
            "createdAt":  "2026-03-01T12:00:00.000Z",
            "sender": { "id": "cuid...", "nickname": "alice" }
          }
        ]
      }
    ],
    "nextCursor": "cmm7qjo2y00bcqshgcarwx790"
  }
}
```

> `nextCursor` is `null` when there are no more pages.  
> `messages[0]` contains the **last message** in the chat (for sidebar preview).

---

### `GET /api/chats/:id`

Get a single chat by ID (membership is verified).

**Response `200`:** full chat object (same structure as in the list, without `messages`).

**Errors:**

| Status | message |
|---|---|
| 404 | `Chat not found or access denied` |

---

### `POST /api/chats/direct`

Create a direct (1-on-1) chat with a user. Returns the existing chat if one already exists between both users.

**Request body:**

```json
{
  "targetUserId": "cuid..."
}
```

**Response `201`:** full chat object.

> Creator gets role `OWNER`, target user gets `MEMBER`.

**Errors:**

| Status | message |
|---|---|
| 500 | `Cannot create chat with yourself` |

---

### `POST /api/chats/group`

Create a group chat.

**Request body:**

```json
{
  "name":      "Team Chat",
  "memberIds": ["cuid...", "cuid..."]
}
```

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1–64 chars |
| `memberIds` | string[] | at least 1 user |

**Response `201`:** full chat object. Creator is automatically added as `OWNER`.

---

### `DELETE /api/chats/:id/leave`

Leave a chat. Your `ChatMember` record is deleted.

**Response `200`:**

```json
{
  "success": true,
  "data": { "message": "Left chat" }
}
```

---

## 8. Message Endpoints

> Base path: `/api`  
> **Requires Authorization.**

---

### `GET /api/chats/:chatId/messages`

Get message history for a chat (cursor pagination, newest first). Supports full-text search.

**URL params:** `:chatId` — chat ID.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `cursor` | string | — | ID of oldest received message (loads older messages) |
| `limit` | number | 50 | 1–100 |
| `q` | string | — | Full-text search in `text` field (1–200 chars). Only matches plaintext messages. |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id":         "cuid...",
      "chatId":     "cuid...",
      "text":       "Hello!",
      "ciphertext": null,
      "signalType": 0,
      "type":       "TEXT",
      "mediaUrl":   null,
      "replyToId":  null,
      "isEdited":   false,
      "isDeleted":  false,
      "createdAt":  "2026-03-01T12:00:00.000Z",
      "updatedAt":  "2026-03-01T12:00:00.000Z",
      "sender": {
        "id":       "cuid...",
        "nickname": "john_doe",
        "avatar":   null
      },
      "readReceipts": [
        { "userId": "cuid...", "readAt": "2026-03-01T12:01:00.000Z" }
      ],
      "reactions": [
        { "id": "cuid...", "userId": "cuid...", "emoji": "👍" }
      ],
      "replyTo": {
        "id":       "cuid...",
        "text":     "Original message",
        "ciphertext": null,
        "signalType": 0,
        "isDeleted": false,
        "sender": { "id": "cuid...", "nickname": "alice" }
      }
    }
  ]
}
```

> Messages with `isDeleted: true` are excluded from results.  
> `replyTo` is `null` if the message is not a reply.  
> `signalType`: `0` = plaintext · `1` = PreKeyWhisperMessage · `3` = WhisperMessage

**Errors:**

| Status | message |
|---|---|
| 403 | `Not a member of this chat` |

---

### `DELETE /api/messages/:id`

Soft-delete your own message. Sets `isDeleted = true`, `text = null`, `ciphertext = null`. Broadcasts `message:deleted` via WebSocket to all chat members.

**Response `200`:**

```json
{
  "success": true,
  "data": { "message": "Deleted" }
}
```

**Errors:**

| Status | message |
|---|---|
| 403 | `Forbidden` |
| 404 | `Message not found` |

---

### `PATCH /api/messages/:id`

Edit the text of your own message. Sets `isEdited = true`.

> ⚠️ Only works for plaintext (`signalType = 0`) messages. E2E encrypted messages must re-encrypt on the client before editing.

**Request body:**

```json
{
  "text": "Corrected message text"
}
```

**Response `200`:** full message object (same structure as history).

**Errors:**

| Status | message |
|---|---|
| 403 | `Forbidden` |

---

### `POST /api/messages/:id/reactions`

Add a reaction to a message (upsert — duplicate reactions are ignored).

**URL params:** `:id` — message ID.

**Request body:**

```json
{
  "emoji": "👍"
}
```

> **Allowed emoji:** `👍` `❤️` `😂` `😮` `😢` `🔥`

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id":        "cuid...",
    "messageId": "cuid...",
    "userId":    "cuid...",
    "emoji":     "👍"
  }
}
```

> Triggers `reaction:added` WS event to all chat members.

**Errors:**

| Status | message |
|---|---|
| 400 | `Invalid emoji` |
| 400 | `Not a member of this chat` |

---

### `DELETE /api/messages/:id/reactions/:emoji`

Remove your reaction from a message.

**URL params:**
- `:id` — message ID
- `:emoji` — emoji character, URL-encoded (e.g. `%F0%9F%91%8D` for `👍`)

**Response `200`:**

```json
{
  "success": true,
  "data": { "message": "Removed" }
}
```

> Triggers `reaction:removed` WS event to all chat members.

---

## 9. Keys (Signal Protocol)

> Base path: `/api/keys`  
> **Requires Authorization.**  
> These endpoints implement the X3DH key exchange for end-to-end encryption.

---

### `POST /api/keys/bundle`

Upload (or replace) the current user's PreKey Bundle. All existing one-time prekeys are cleared before uploading new ones.

**Request body:**

```json
{
  "registrationId":  12345,
  "identityKey":     "base64encodedPublicKey==",
  "signedPreKeyId":  1,
  "signedPreKey":    "base64encodedPublicKey==",
  "signedPreKeySig": "base64encodedSignature==",
  "oneTimePreKeys": [
    { "keyId": 1, "publicKey": "base64encodedPublicKey==" },
    { "keyId": 2, "publicKey": "base64encodedPublicKey==" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `registrationId` | number | Unique device registration ID |
| `identityKey` | string | Public identity key (base64) |
| `signedPreKeyId` | number | Signed prekey ID |
| `signedPreKey` | string | Public signed prekey (base64) |
| `signedPreKeySig` | string | Signature of signed prekey by identity key (base64) |
| `oneTimePreKeys` | array | One-time prekeys (can be `[]`) |

**Response `201`:**

```json
{
  "success": true,
  "data": { "uploaded": true }
}
```

**Errors:**

| Status | message |
|---|---|
| 400 | `MISSING_KEY_FIELDS` |

---

### `GET /api/keys/bundle/:userId`

Fetch a user's PreKey Bundle to initiate an X3DH session. **Atomically consumes one one-time prekey** from the server.

> ⚠️ Call this endpoint only when actually building a session. For checking existence use `GET /api/keys/has-bundle/:userId`.

**URL params:** `:userId` — target user's ID.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "registrationId":  12345,
    "identityKey":     "base64...",
    "signedPreKeyId":  1,
    "signedPreKey":    "base64...",
    "signedPreKeySig": "base64...",
    "preKey": {
      "keyId":     7,
      "publicKey": "base64..."
    }
  }
}
```

> `preKey` is `null` if one-time prekeys are exhausted. The session can still be established using only the signed prekey, but forward secrecy is reduced. Clients should call `POST /api/keys/replenish` when count drops below threshold.

**Errors:**

| Status | message |
|---|---|
| 404 | `BUNDLE_NOT_FOUND` |

---

### `GET /api/keys/has-bundle/:userId`

Check whether a user has published a PreKey Bundle. **Does not consume any one-time prekey.**

**URL params:** `:userId` — user ID.

**Response `200`:**

```json
{
  "success": true,
  "data": { "hasBundle": true }
}
```

---

### `POST /api/keys/replenish`

Add more one-time prekeys for the current user.

**Request body:**

```json
{
  "preKeys": [
    { "keyId": 101, "publicKey": "base64..." },
    { "keyId": 102, "publicKey": "base64..." }
  ]
}
```

**Response `200`:**

```json
{
  "success": true,
  "data": { "added": 2 }
}
```

**Errors:**

| Status | message |
|---|---|
| 400 | `MISSING_PREKEYS` |

---

### `GET /api/keys/count`

Get the remaining one-time prekey count for the current user.

**Response `200`:**

```json
{
  "success": true,
  "data": { "count": 47 }
}
```

> Clients should replenish when count < 20.

---

## 10. File Upload

> **Requires Authorization.**  
> Uses `multipart/form-data`.

---

### `POST /api/upload`

Upload a file to the server. The file is stored permanently and accessible via a static URL.

**Request:**

```
POST /api/upload
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

file=<binary>
```

**Limits:**

| Constraint | Value |
|---|---|
| Max file size | **20 MB** |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `video/mp4`, `video/webm`, `audio/mpeg`, `audio/ogg`, `audio/webm`, `application/pdf`, `text/plain`, `application/zip`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "url":  "/uploads/1740825600000-a3b2c1d4.jpg",
    "type": "IMAGE",
    "name": "photo.jpg",
    "size": 204800
  }
}
```

| Field | Values |
|---|---|
| `type` | `IMAGE` · `VIDEO` · `AUDIO` · `FILE` |
| `url` | Accessible via `GET /uploads/<filename>` (no auth required) |
| `size` | File size in bytes |

**Typical usage** — attach file to message:

```json
// 1. Upload the file
POST /api/upload → { "url": "/uploads/xyz.mp4", "type": "VIDEO" }

// 2. Send via WebSocket
{
  "event": "message:send",
  "payload": {
    "chatId":   "cuid...",
    "text":     "",
    "type":     "VIDEO",
    "mediaUrl": "/uploads/xyz.mp4"
  }
}
```

**Errors:**

| Status | message |
|---|---|
| 400 | `No file provided` |
| 400 | `File type not allowed` |

---

## 11. WebSocket

### Connection

```
ws://localhost:3000/ws?token=<accessToken>
```

The access token is passed as a query parameter. If absent or invalid, the connection is closed with code `4001`.

```javascript
// Example (browser)
const ws = new WebSocket(`ws://localhost:3000/ws?token=${accessToken}`);

ws.onmessage = (event) => {
  const { event: type, payload } = JSON.parse(event.data);
  // handle type...
};

ws.send(JSON.stringify({
  event: 'message:send',
  payload: { chatId: '...', text: 'Hello!' }
}));
```

### Message Format

All messages are JSON strings in both directions.

**Client → Server:**
```json
{ "event": "<type>", "payload": { ... } }
```

**Server → Client:**
```json
{ "event": "<type>", "payload": { ... } }
```

---

### Client → Server Events

#### `message:send`

Send a message to a chat.

```json
{
  "event": "message:send",
  "payload": {
    "chatId":     "cuid...",
    "text":       "Hello!",
    "ciphertext": null,
    "signalType": 0,
    "type":       "TEXT",
    "mediaUrl":   null,
    "replyToId":  null
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `chatId` | string | **yes** | Target chat ID |
| `text` | string? | no | Plaintext content (`signalType = 0`) |
| `ciphertext` | string? | no | Encrypted content, base64 (Signal E2E) |
| `signalType` | number? | no | `0` = plaintext · `1` = PreKeyWhisperMessage · `3` = WhisperMessage |
| `type` | string? | no | `TEXT` · `IMAGE` · `FILE` · `AUDIO` · `VIDEO` (default: `TEXT`) |
| `mediaUrl` | string? | no | URL from `/api/upload` |
| `replyToId` | string? | no | ID of the quoted message |

**Server responds with:**
- `message:new` → all chat members (including sender)
- `message:delivered` → sender (if ≥1 recipient is online)

---

#### `message:read`

Mark a message as read.

```json
{
  "event": "message:read",
  "payload": {
    "messageId": "cuid...",
    "chatId":    "cuid..."
  }
}
```

**Server responds with:**
- `message:read` → original message sender

---

#### `typing:start`

Notify chat that the current user started typing.

```json
{
  "event": "typing:start",
  "payload": { "chatId": "cuid..." }
}
```

**Server responds with:**
- `typing:started` → all chat members except sender

---

#### `typing:stop`

Notify chat that the current user stopped typing.

```json
{
  "event": "typing:stop",
  "payload": { "chatId": "cuid..." }
}
```

**Server responds with:**
- `typing:stopped` → all chat members except sender

---

#### `presence:ping`

Heartbeat — extends the online TTL in Redis. Send every **30 seconds** to stay online.

```json
{
  "event": "presence:ping"
}
```

No response.

---

### Server → Client Events

#### `message:new`

New message in a chat. Delivered to **all members** including sender.

```json
{
  "event": "message:new",
  "payload": {
    "id":         "cuid...",
    "chatId":     "cuid...",
    "text":       "Hello!",
    "ciphertext": null,
    "signalType": 0,
    "type":       "TEXT",
    "mediaUrl":   null,
    "replyToId":  null,
    "isEdited":   false,
    "isDeleted":  false,
    "createdAt":  "2026-03-01T12:00:00.000Z",
    "updatedAt":  "2026-03-01T12:00:00.000Z",
    "sender": {
      "id":       "cuid...",
      "nickname": "john_doe",
      "avatar":   null
    },
    "readReceipts": [],
    "reactions":    [],
    "replyTo":      null
  }
}
```

---

#### `message:delivered`

Message delivered — at least one recipient is online. Sent **to sender only**.

```json
{
  "event": "message:delivered",
  "payload": {
    "messageId": "cuid...",
    "chatId":    "cuid..."
  }
}
```

---

#### `message:read`

A recipient read the message. Sent **to sender only**.

```json
{
  "event": "message:read",
  "payload": {
    "messageId": "cuid...",
    "chatId":    "cuid...",
    "readBy":    "cuid..."
  }
}
```

---

#### `message:deleted`

A message was deleted (via REST). Sent to **all chat members**.

```json
{
  "event": "message:deleted",
  "payload": {
    "messageId": "cuid...",
    "chatId":    "cuid..."
  }
}
```

---

#### `reaction:added`

A reaction was added (via REST). Sent to **all chat members**.

```json
{
  "event": "reaction:added",
  "payload": {
    "reaction": {
      "id":        "cuid...",
      "messageId": "cuid...",
      "userId":    "cuid...",
      "emoji":     "👍"
    },
    "chatId": "cuid..."
  }
}
```

---

#### `reaction:removed`

A reaction was removed (via REST). Sent to **all chat members**.

```json
{
  "event": "reaction:removed",
  "payload": {
    "messageId": "cuid...",
    "userId":    "cuid...",
    "emoji":     "👍",
    "chatId":    "cuid..."
  }
}
```

---

#### `typing:started`

A user started typing. Sent to **all members except the typer**.

```json
{
  "event": "typing:started",
  "payload": {
    "chatId": "cuid...",
    "userId": "cuid..."
  }
}
```

---

#### `typing:stopped`

A user stopped typing. Sent to **all members except the typer**.

```json
{
  "event": "typing:stopped",
  "payload": {
    "chatId": "cuid...",
    "userId": "cuid..."
  }
}
```

---

#### `user:online`

A user connected to WebSocket. Broadcast to **all connected users**.

```json
{
  "event": "user:online",
  "payload": {
    "userId":     "cuid...",
    "lastOnline": null
  }
}
```

---

#### `user:offline`

A user disconnected (all their sockets closed). Broadcast to **all connected users**.

```json
{
  "event": "user:offline",
  "payload": {
    "userId":     "cuid...",
    "lastOnline": "2026-03-01T12:05:30.000Z"
  }
}
```

---

#### `presence:snapshot`

Sent **only to a newly connecting client** immediately after they connect. Contains IDs of all currently online users so the client can initialize its online state without polling.

```json
{
  "event": "presence:snapshot",
  "payload": {
    "onlineUserIds": ["cuid...", "cuid..."]
  }
}
```

---

#### `error`

Sent when the server cannot process an incoming WS event.

```json
{
  "event": "error",
  "payload": { "message": "Bad JSON" }
}
```

| message | Cause |
|---|---|
| `Bad JSON` | Malformed JSON received |
| `Missing event field` | No `event` key in payload |
| `Unknown event: <type>` | Unrecognized event type |
| `Failed to send message` | Error in `message:send` handler |
| `Failed to mark as read` | Error in `message:read` handler |

---

## 12. Error Reference

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `304` | Not Modified (cached) |
| `400` | Bad Request |
| `401` | Unauthorized (invalid credentials) |
| `403` | Forbidden (not a member / not owner) |
| `404` | Not Found |
| `409` | Conflict (duplicate email/nickname) |
| `422` | Unprocessable Entity (validation error) |
| `429` | Too Many Requests (rate limit) |
| `500` | Internal Server Error |

### Prisma / DB Errors (mapped)

| Prisma Code | Status returned | message |
|---|---|---|
| `P2002` | 409 | `Already exists` |
| `P2025` | 404 | `Not found` |
| `P2003` | 400 | `Invalid reference` |

---

## 13. Database Schema

### Models overview

| Model | Table | Description |
|---|---|---|
| `User` | `users` | User accounts |
| `RefreshToken` | `refresh_tokens` | Active refresh tokens |
| `Chat` | `chats` | Chats (DIRECT or GROUP) |
| `ChatMember` | `chat_members` | Chat membership (OWNER / ADMIN / MEMBER) |
| `Message` | `messages` | Messages (supports soft delete) |
| `Reaction` | `reactions` | Emoji reactions on messages |
| `ReadReceipt` | `read_receipts` | Message read status per user |
| `PreKeyBundle` | `prekey_bundles` | Signal Protocol: signed identity bundle |
| `OneTimePreKey` | `one_time_prekeys` | Signal Protocol: ephemeral prekeys |

### Key Enums

```
ChatType:       DIRECT | GROUP
ChatMemberRole: OWNER  | ADMIN | MEMBER
MessageType:    TEXT   | IMAGE | FILE | AUDIO | VIDEO | SYSTEM
signalType:     0 (plaintext) | 1 (PreKeyWhisperMessage) | 3 (WhisperMessage)
```

### Performance Indexes

| Table | Index columns | Purpose |
|---|---|---|
| `messages` | `(chat_id, created_at DESC)` | Chat history pagination |
| `messages` | `(sender_id)` | Messages by sender |
| `chat_members` | `(user_id)` | User's chat list |
| `one_time_prekeys` | `(user_id, key_id)` | OTP key lookup & atomic delete |
| `refresh_tokens` | `(user_id)` | Logout deleteMany |
| `reactions` | `(message_id)` | Reactions per message |

---

## 14. Quick Reference Table

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Server health check |
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/refresh` | — | Refresh token pair |
| POST | `/api/auth/logout` | — | Logout (invalidate refresh token) |
| GET | `/api/users/me` | JWT | My profile |
| PATCH | `/api/users/me` | JWT | Update my profile |
| GET | `/api/users/search?q=` | JWT | Search users by nickname |
| GET | `/api/users/:id` | JWT | User profile by ID |
| GET | `/api/chats` | JWT | My chat list (paginated) |
| GET | `/api/chats/:id` | JWT | Single chat |
| POST | `/api/chats/direct` | JWT | Create / find direct chat |
| POST | `/api/chats/group` | JWT | Create group chat |
| DELETE | `/api/chats/:id/leave` | JWT | Leave chat |
| GET | `/api/chats/:chatId/messages` | JWT | Message history + search |
| DELETE | `/api/messages/:id` | JWT | Delete message (soft) |
| PATCH | `/api/messages/:id` | JWT | Edit message text |
| POST | `/api/messages/:id/reactions` | JWT | Add reaction |
| DELETE | `/api/messages/:id/reactions/:emoji` | JWT | Remove reaction |
| POST | `/api/keys/bundle` | JWT | Upload PreKey Bundle |
| GET | `/api/keys/bundle/:userId` | JWT | Fetch bundle (consumes OTP prekey) |
| GET | `/api/keys/has-bundle/:userId` | JWT | Check bundle exists (no OTP consumed) |
| POST | `/api/keys/replenish` | JWT | Add more one-time prekeys |
| GET | `/api/keys/count` | JWT | OTP prekey count |
| POST | `/api/upload` | JWT | Upload file (multipart) |
| GET | `/uploads/:filename` | — | Access uploaded file |

### WebSocket Events Summary

| Direction | Event | Recipient |
|---|---|---|
| C → S | `message:send` | — |
| C → S | `message:read` | — |
| C → S | `typing:start` | — |
| C → S | `typing:stop` | — |
| C → S | `presence:ping` | — |
| S → C | `message:new` | All chat members |
| S → C | `message:delivered` | Sender only |
| S → C | `message:read` | Sender only |
| S → C | `message:deleted` | All chat members |
| S → C | `reaction:added` | All chat members |
| S → C | `reaction:removed` | All chat members |
| S → C | `typing:started` | All members except typer |
| S → C | `typing:stopped` | All members except typer |
| S → C | `user:online` | All connected users |
| S → C | `user:offline` | All connected users |
| S → C | `presence:snapshot` | Newly connecting client only |
| S → C | `error` | Requesting client |
