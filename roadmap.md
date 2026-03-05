## Версия 0.9.0 — Android: сборка и исправление ошибок (05.03.2026)

### Что сделано
- Исправлен AGP: 8.5.2 → 8.7.3 (поддержка compileSdk 35)
- Добавлены android.useAndroidX=true, android.enableJetifier=true в gradle.properties
- Добавлена зависимость material-icons-extended
- Исправлены иконки: Group→People, WifiOff→CloudOff, ChevronLeft→ArrowBack, Logout→ExitToApp
- Исправлены импорты MutableInteractionSource в ChatScreen.kt
- Исправлены вызовы Modifier.padding(horizontal, bottom)
- Исправлен вызов updateMe() с обязательными параметрами
- Тема XML заменена на android:Theme.Material.Light.NoActionBar
- BUILD SUCCESSFUL — app-debug.apk готов

# H2V Messenger вЂ” Roadmap

## Р’РµСЂСЃРёСЏ 0.1.0 вЂ” Р‘Р°Р·РѕРІС‹Р№ Р±СЌРєРµРЅРґ (01.03.2026)

### Р§С‚Рѕ СЃРґРµР»Р°РЅРѕ

#### РЎС‚СЂСѓРєС‚СѓСЂР° РїСЂРѕРµРєС‚Р°
- `messenger-backend/` вЂ” Node.js + TypeScript + Express
- Prisma 7 (PostgreSQL) + Redis (ioredis) + WebSocket (ws)
- JWT Р°РІС‚РѕСЂРёР·Р°С†РёСЏ (access + refresh С‚РѕРєРµРЅС‹)

#### РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ (`/api/auth`)
- [x] `POST /register` вЂ” СЂРµРіРёСЃС‚СЂР°С†РёСЏ (nickname, email, password)
- [x] `POST /login` вЂ” РІС…РѕРґ, РІРѕР·РІСЂР°С‚ access + refresh С‚РѕРєРµРЅР°
- [x] `POST /refresh` вЂ” РѕР±РЅРѕРІР»РµРЅРёРµ access-С‚РѕРєРµРЅР° РїРѕ refresh
- [x] `POST /logout` вЂ” РёРЅРІР°Р»РёРґР°С†РёСЏ refresh-С‚РѕРєРµРЅР°

#### РџРѕР»СЊР·РѕРІР°С‚РµР»Рё (`/api/users`)
- [x] `GET /me` вЂ” СЃРІРѕР№ РїСЂРѕС„РёР»СЊ
- [x] `PATCH /me` вЂ” РѕР±РЅРѕРІРёС‚СЊ nickname / avatar / bio
- [x] `GET /search?q=` вЂ” РїРѕРёСЃРє РїРѕ nickname
- [x] `GET /:id` вЂ” РїСЂРѕС„РёР»СЊ Р»СЋР±РѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ

#### Р§Р°С‚С‹ (`/api/chats`)
- [x] `GET /` вЂ” СЃРїРёСЃРѕРє С‡Р°С‚РѕРІ СЃ РїРѕСЃР»РµРґРЅРёРј СЃРѕРѕР±С‰РµРЅРёРµРј
- [x] `GET /:id` вЂ” РґРµС‚Р°Р»Рё С‡Р°С‚Р°
- [x] `POST /direct` вЂ” СЃРѕР·РґР°С‚СЊ Р»РёС‡РЅС‹Р№ С‡Р°С‚ (DIRECT)
- [x] `POST /group` вЂ” СЃРѕР·РґР°С‚СЊ РіСЂСѓРїРїРѕРІРѕР№ С‡Р°С‚
- [x] `DELETE /:id/leave` вЂ” РїРѕРєРёРЅСѓС‚СЊ С‡Р°С‚

#### РЎРѕРѕР±С‰РµРЅРёСЏ (`/api/chats/:chatId/messages`, `/api/messages/:id`)
- [x] `GET /chats/:chatId/messages` вЂ” РёСЃС‚РѕСЂРёСЏ (cursor pagination)
- [x] `PATCH /messages/:id` вЂ” СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ
- [x] `DELETE /messages/:id` вЂ” soft-delete СЃРѕРѕР±С‰РµРЅРёСЏ

#### WebSocket (`ws://host/ws?token=JWT`)
| Event (РєР»РёРµРЅС‚ в†’ СЃРµСЂРІРµСЂ) | РћРїРёСЃР°РЅРёРµ |
|------------------------|----------|
| `message:send` | РћС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ РІ С‡Р°С‚ |
| `message:read` | РћС‚РјРµС‚РёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ РїСЂРѕС‡РёС‚Р°РЅРЅС‹Рј |
| `typing:start` | РќР°С‡Р°Р» РЅР°Р±РёСЂР°С‚СЊ С‚РµРєСЃС‚ |
| `typing:stop` | РџРµСЂРµСЃС‚Р°Р» РЅР°Р±РёСЂР°С‚СЊ |
| `presence:ping` | Heartbeat РѕРЅР»Р°Р№РЅ-СЃС‚Р°С‚СѓСЃР° |

| Event (СЃРµСЂРІРµСЂ в†’ РєР»РёРµРЅС‚) | РћРїРёСЃР°РЅРёРµ |
|------------------------|----------|
| `message:new` | РќРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ РІ С‡Р°С‚Рµ |
| `message:read` | РљС‚Рѕ-С‚Рѕ РїСЂРѕС‡РёС‚Р°Р» СЃРѕРѕР±С‰РµРЅРёРµ |
| `message:deleted` | РЎРѕРѕР±С‰РµРЅРёРµ СѓРґР°Р»РµРЅРѕ |
| `typing:started` | РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РїРµС‡Р°С‚Р°РµС‚ |
| `typing:stopped` | РџРµСЂРµСЃС‚Р°Р» РїРµС‡Р°С‚Р°С‚СЊ |
| `user:online` | РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РѕРЅР»Р°Р№РЅ |
| `user:offline` | РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РѕС„Р»Р°Р№РЅ |
| `error` | РћС€РёР±РєР° |

#### РЎС‚СЂСѓРєС‚СѓСЂР° Р‘Р” (Prisma / PostgreSQL)
- `users` вЂ” id, nickname, email, password_hash, avatar, bio, last_online, is_online
- `refresh_tokens` вЂ” id, token, user_id, expires_at
- `chats` вЂ” id, type (DIRECT/GROUP), name, avatar, description
- `chat_members` вЂ” id, chat_id, user_id, role (OWNER/ADMIN/MEMBER)
- `messages` вЂ” id, chat_id, sender_id, text, type, media_url, reply_to_id, is_edited, is_deleted
- `read_receipts` вЂ” id, message_id, user_id, read_at

#### Redis (РїСЂРёСЃСѓС‚СЃС‚РІРёРµ)
- `user:{id}:online` вЂ” TTL 60s, РїСЂРѕРґР»РµРІР°РµС‚СЃСЏ heartbeat РєР°Р¶РґС‹Рµ 30s
- `user:{id}:last_online` вЂ” ISO-РґР°С‚Р° РїРѕСЃР»РµРґРЅРµРіРѕ РѕРЅР»Р°Р№РЅР°
- `chat:{id}:typing:{userId}` вЂ” TTL 5s, РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ РїСЂРё РЅР°Р±РѕСЂРµ

---

## Р’РµСЂСЃРёСЏ 0.4.0 вЂ” Signal Protocol E2E Encryption (01.03.2026)

### Р§С‚Рѕ СЃРґРµР»Р°РЅРѕ

#### Backend: РЅРѕРІС‹Рµ РјРѕРґРµР»Рё Prisma
- [x] `prekey_bundles` вЂ” identity key, signed prekey, registration ID (1 РЅР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ)
- [x] `one_time_prekeys` вЂ” РѕРґРЅРѕСЂР°Р·РѕРІС‹Рµ prekeys, СѓРґР°Р»СЏСЋС‚СЃСЏ РїСЂРё РІС‹РґР°С‡Рµ
- [x] `messages.ciphertext` вЂ” Р·Р°С€РёС„СЂРѕРІР°РЅРЅС‹Р№ blob (base64)
- [x] `messages.signal_type` вЂ” С‚РёРї Signal СЃРѕРѕР±С‰РµРЅРёСЏ (0=plain, 1=preKeyWhisper, 3=whisper)
- [x] РњРёРіСЂР°С†РёСЏ `e2e_signal_protocol` РїСЂРёРјРµРЅРµРЅР°

#### Backend: API РєР»СЋС‡РµР№ (`/api/keys`)
- [x] `POST /api/keys/bundle` вЂ” Р·Р°РіСЂСѓР·РёС‚СЊ СЃРІРѕР№ PreKeyBundle + OneTimePreKeys
- [x] `GET /api/keys/bundle/:userId` вЂ” РїРѕР»СѓС‡РёС‚СЊ bundle СЃРѕР±РµСЃРµРґРЅРёРєР° (OTP key СѓРґР°Р»СЏРµС‚СЃСЏ)
- [x] `POST /api/keys/replenish` вЂ” РїРѕРїРѕР»РЅРёС‚СЊ РѕРґРЅРѕСЂР°Р·РѕРІС‹Рµ prekeys
- [x] `GET /api/keys/count` вЂ” РєРѕР»РёС‡РµСЃС‚РІРѕ РѕСЃС‚Р°РІС€РёС…СЃСЏ OTP keys

#### Backend: СЃРѕРѕР±С‰РµРЅРёСЏ СЃ С€РёС„СЂРѕРІР°РЅРёРµРј
- [x] `message.service.sendMessage()` РїСЂРёРЅРёРјР°РµС‚ `ciphertext` + `signalType`
- [x] WS event `message:send` РїРѕРґРґРµСЂР¶РёРІР°РµС‚ `ciphertext` + `signalType`
- [x] РЎРµСЂРІРµСЂ РЅРµ СЂР°СЃС€РёС„СЂРѕРІС‹РІР°РµС‚ вЂ” РїРµСЂРµРґР°С‘С‚ blob as-is

#### Frontend: Signal Protocol
- [x] Р‘РёР±Р»РёРѕС‚РµРєР° `@privacyresearch/libsignal-protocol-typescript` СЃРѕР±СЂР°РЅР° РІ `signal-protocol.js` (esbuild, IIFE)
- [x] `crypto-store.js` вЂ” СЂРµР°Р»РёР·Р°С†РёСЏ `StorageType` С‡РµСЂРµР· IndexedDB
- [x] Р“РµРЅРµСЂР°С†РёСЏ РєР»СЋС‡РµР№ РїСЂРё СЂРµРіРёСЃС‚СЂР°С†РёРё/РІС…РѕРґРµ (identity, signed prekey, 100 OTP keys)
- [x] РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ Р·Р°РіСЂСѓР·РєР° РєР»СЋС‡РµР№ РЅР° СЃРµСЂРІРµСЂ (`POST /api/keys/bundle`)
- [x] РџРѕСЃС‚СЂРѕРµРЅРёРµ СЃРµСЃСЃРёРё (X3DH) РїСЂРё РѕС‚РєСЂС‹С‚РёРё С‡Р°С‚Р°
- [x] РЁРёС„СЂРѕРІР°РЅРёРµ РїСЂРё РѕС‚РїСЂР°РІРєРµ (`SessionCipher.encrypt`)
- [x] Р”РµС€РёС„СЂРѕРІРєР° РїСЂРё РїРѕР»СѓС‡РµРЅРёРё (`SessionCipher.decryptWhisperMessage` / `decryptPreKeyWhisperMessage`)
- [x] РџРѕРґРґРµСЂР¶РєР° Double Ratchet вЂ” СЃРµСЃСЃРёСЏ РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё

#### UI: РёРЅРґРёРєР°С‚РѕСЂС‹ E2E
- [x] РРєРѕРЅРєР° Р·Р°РјРєР° рџ”’ РЅР° РєР°Р¶РґРѕРј Р·Р°С€РёС„СЂРѕРІР°РЅРЅРѕРј СЃРѕРѕР±С‰РµРЅРёРё
- [x] Р‘РµР№РґР¶ "рџ”’ E2E" РІ Р·Р°РіРѕР»РѕРІРєРµ С‡Р°С‚Р°
- [x] РРєРѕРЅРєР° рџ”’ РІ СЃРїРёСЃРєРµ С‡Р°С‚РѕРІ (direct)
- [x] Р’ sidebar: "рџ”’ Р—Р°С€РёС„СЂРѕРІР°РЅРЅРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ" РґР»СЏ Р·Р°С€РёС„СЂРѕРІР°РЅРЅС‹С… РїСЂРµРІСЊСЋ
- [x] Fallback: "рџ”’ РќРµ СѓРґР°Р»РѕСЃСЊ СЂР°СЃС€РёС„СЂРѕРІР°С‚СЊ" РїСЂРё РѕС€РёР±РєРµ РґРµРєСЂРёРїС‚Р°

#### РћРіСЂР°РЅРёС‡РµРЅРёСЏ (by design)
- РќРµС‚ Р±СЌРєР°РїР° РєР»СЋС‡РµР№ вЂ” РїСЂРё РѕС‡РёСЃС‚РєРµ IndexedDB/СЃРјРµРЅРµ Р±СЂР°СѓР·РµСЂР° РёСЃС‚РѕСЂРёСЏ РЅРµС‡РёС‚Р°РµРјР°
- E2E С‚РѕР»СЊРєРѕ РґР»СЏ DIRECT-С‡Р°С‚РѕРІ (РіСЂСѓРїРїРѕРІС‹Рµ вЂ” plaintext)
- РЎС‚Р°СЂС‹Рµ plaintext-СЃРѕРѕР±С‰РµРЅРёСЏ СЃРѕС…СЂР°РЅРµРЅС‹, РЅРѕРІС‹Рµ вЂ” encrypted

---

## Backlog (СЃР»РµРґСѓСЋС‰РёРµ РёС‚РµСЂР°С†РёРё)

- [ ] Р—Р°РіСЂСѓР·РєР° РјРµРґРёР°С„Р°Р№Р»РѕРІ (S3/Minio)
- [ ] Push-СѓРІРµРґРѕРјР»РµРЅРёСЏ (FCM / APNS)
- [ ] Р РµР°РєС†РёРё РЅР° СЃРѕРѕР±С‰РµРЅРёСЏ
- [ ] РџРµСЂРµСЃС‹Р»РєР° СЃРѕРѕР±С‰РµРЅРёР№
- [ ] Р РѕР»СЊ ADMIN РІ РіСЂСѓРїРїР°С… (РїСЂР°РІР° РЅР° РєРёРє/Р±Р°РЅ)
- [ ] Rate limiting (express-rate-limit)
- [ ] Swagger / OpenAPI РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ
- [ ] Unit Рё РёРЅС‚РµРіСЂР°С†РёРѕРЅРЅС‹Рµ С‚РµСЃС‚С‹ (Jest / Vitest)
- [ ] Docker Compose (postgres + redis + app)
- [ ] CI/CD pipeline
- [ ] Sender Keys РґР»СЏ РіСЂСѓРїРїРѕРІС‹С… E2E С‡Р°С‚РѕРІ
- [ ] РџРѕРїРѕР»РЅРµРЅРёРµ OTP keys РїСЂРё РјР°Р»РѕРј РєРѕР»РёС‡РµСЃС‚РІРµ
- [ ] Р’РµСЂРёС„РёРєР°С†РёСЏ identity РєР»СЋС‡РµР№ (QR-РєРѕРґ / fingerprint)

---

## Р’РµСЂСЃРёРё

| Р’РµСЂСЃРёСЏ | Р”Р°С‚Р° | РћРїРёСЃР°РЅРёРµ |
|--------|------|----------|
| 0.1.0 | 01.03.2026 | Р‘Р°Р·РѕРІС‹Р№ Р±СЌРєРµРЅРґ: auth, users, chats, messages, WS |
| 0.1.1 | 01.03.2026 | Р¤РёРєСЃ Prisma 7 config, Redis optional fallback, СЃРµСЂРІРµСЂ Р·Р°РїСѓС‰РµРЅ |
| 0.2.0 | 01.03.2026 | Р¤СЂРѕРЅС‚РµРЅРґ: SPA РЅР° РІР°РЅРёР»СЊРЅРѕРј JS (auth, С‡Р°С‚С‹, WS, typing, presence) |
| 0.3.0 | 01.03.2026 | Realtime: unread badges, typing animation, checkmarks, sounds, reconnect |
| 0.4.0 | 01.03.2026 | Signal Protocol E2E: X3DH + Double Ratchet, С€РёС„СЂРѕРІР°РЅРёРµ РІСЃРµС… direct-СЃРѕРѕР±С‰РµРЅРёР№ |
| 0.4.1 | 01.03.2026 | Fix: СЂРµРіРёСЃС‚СЂР°С†РёСЏ РЅРµ Р±Р»РѕРєРёСЂСѓРµС‚СЃСЏ РѕС€РёР±РєР°РјРё E2E key init |
| 0.4.2 | 01.03.2026 | Fix: СЂР°СЃС€РёС„СЂРѕРІР°РЅРЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ РІРёРґРЅС‹ РїРѕСЃР»Рµ РїРµСЂРµР·Р°РіСЂСѓР·РєРё (localStorage cache РґР»СЏ РѕС‚РїСЂР°РІРёС‚РµР»СЏ Рё РїРѕР»СѓС‡Р°С‚РµР»СЏ, СЃРѕС…СЂР°РЅРµРЅРёРµ РєСЌС€Р° РїСЂРё logout/reset) |
| 0.5.0 | 01.03.2026 | Security & Reliability Block 1: rate limiting (auth 20/15РјРёРЅ, api 300/РјРёРЅ), race condition OTP ($transaction), message:deleted WS broadcast, ciphertext РѕС‡РёС‰Р°РµС‚СЃСЏ РїСЂРё СѓРґР°Р»РµРЅРёРё, JWT РїР°РґР°РµС‚ Р±РµР· .env СЃРµРєСЂРµС‚РѕРІ, typing РїСЂРѕРІРµСЂСЏРµС‚ С‡Р»РµРЅСЃС‚РІРѕ РІ С‡Р°С‚Рµ, Prisma РѕС€РёР±РєРё РЅРµ СЂР°СЃРєСЂС‹РІР°СЋС‚СЃСЏ РєР»РёРµРЅС‚Сѓ, Р»РёРјРёС‚ JSON С‚РµР»Р° 2mb |
| 0.5.1 | 01.03.2026 | Performance Block 2: 4 РёРЅРґРµРєСЃР° РІ Р‘Р” (messages.chatId+createdAt, messages.senderId, chat_members.userId, one_time_prekeys.userId+keyId, refresh_tokens.userId), cursor-based pagination РґР»СЏ /api/chats (limit=30), РєРЅРѕРїРєР° "Р—Р°РіСЂСѓР·РёС‚СЊ РµС‰С‘" РІ СЃР°Р№РґР±Р°СЂРµ |
| 0.6.0 | 01.03.2026 | Features Block 3: СЂРµР°РєС†РёРё РЅР° СЃРѕРѕР±С‰РµРЅРёСЏ (С‚Р°Р±Р»РёС†Р° reactions, API + WS real-time), Р·Р°РіСЂСѓР·РєР° С„Р°Р№Р»РѕРІ/РјРµРґРёР° (multer, POST /api/upload, РєРЅРѕРїРєР° РІ С‡Р°С‚Рµ), РїРѕРёСЃРє РїРѕ СЃРѕРѕР±С‰РµРЅРёСЏРј (?q=), reply СЃ РѕР±СЉРµРєС‚РѕРј РѕСЂРёРіРёРЅР°Р»Р° РІ API, РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ СЃРѕРѕР±С‰РµРЅРёР№ (reply/edit/delete/copy), РєРЅРѕРїРєР° РїРѕРёСЃРєР° РІ С…РµРґРµСЂРµ С‡Р°С‚Р° |
| 0.6.1 | 01.03.2026 | Fix E2E + presence: Р»С‘РіРєРёР№ endpoint GET /api/keys/has-bundle/:userId (РЅРµ С‚СЂР°С‚РёС‚ OTP prekeys), presence:snapshot РїСЂРё WS-РєРѕРЅРЅРµРєС‚Рµ (СЃРЅРёРјРѕРє РѕРЅР»Р°Р№РЅ-РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№), Р°РІС‚РѕРїРѕРїРѕР»РЅРµРЅРёРµ prekeys РїСЂРё РѕСЃС‚Р°С‚РєРµ <20, trust proxy РґР»СЏ rate limiter |
| 0.6.2 | 01.03.2026 | Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: СЃРѕР·РґР°РЅ API.md вЂ” РїРѕР»РЅР°СЏ РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ РІСЃРµС… REST СЌРЅРґРїРѕРёРЅС‚РѕРІ, WebSocket СЃРѕР±С‹С‚РёР№, СЃС…РµРјС‹ Р‘Р” СЃ РїСЂРёРјРµСЂР°РјРё Р·Р°РїСЂРѕСЃРѕРІ Рё РѕС‚РІРµС‚РѕРІ |
| 0.7.0 | 01.03.2026 | iOS-готовность: DELETE /api/users/me (обязательно для App Store), POST/DELETE /api/users/me/device-token (FCM/APNs push токены), POST /api/messages/:id/read (REST + WS message:read), GET /api/health (детальная проверка БД и Redis), { messages, nextCursor } в ответе истории, модель DeviceToken в БД (миграция 20260301181058) |
| 0.8.0 | 05.03.2026 | Android: Kotlin + Jetpack Compose РїСЂРёР»РѕР¶РµРЅРёРµ вЂ” Auth, ChatList, Chat, Profile. РЎРµСЂРІРµСЂ h2von.com (HTTPS/WSS). MVVM, OkHttp WebSocket, Retrofit, Coil. Glass morphism UI 1:1 СЃ iOS. |

