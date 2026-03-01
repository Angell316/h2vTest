# H2V Messenger — Roadmap

## Версия 0.1.0 — Базовый бэкенд (01.03.2026)

### Что сделано

#### Структура проекта
- `messenger-backend/` — Node.js + TypeScript + Express
- Prisma 7 (PostgreSQL) + Redis (ioredis) + WebSocket (ws)
- JWT авторизация (access + refresh токены)

#### Аутентификация (`/api/auth`)
- [x] `POST /register` — регистрация (nickname, email, password)
- [x] `POST /login` — вход, возврат access + refresh токена
- [x] `POST /refresh` — обновление access-токена по refresh
- [x] `POST /logout` — инвалидация refresh-токена

#### Пользователи (`/api/users`)
- [x] `GET /me` — свой профиль
- [x] `PATCH /me` — обновить nickname / avatar / bio
- [x] `GET /search?q=` — поиск по nickname
- [x] `GET /:id` — профиль любого пользователя

#### Чаты (`/api/chats`)
- [x] `GET /` — список чатов с последним сообщением
- [x] `GET /:id` — детали чата
- [x] `POST /direct` — создать личный чат (DIRECT)
- [x] `POST /group` — создать групповой чат
- [x] `DELETE /:id/leave` — покинуть чат

#### Сообщения (`/api/chats/:chatId/messages`, `/api/messages/:id`)
- [x] `GET /chats/:chatId/messages` — история (cursor pagination)
- [x] `PATCH /messages/:id` — редактировать сообщение
- [x] `DELETE /messages/:id` — soft-delete сообщения

#### WebSocket (`ws://host/ws?token=JWT`)
| Event (клиент → сервер) | Описание |
|------------------------|----------|
| `message:send` | Отправить сообщение в чат |
| `message:read` | Отметить сообщение прочитанным |
| `typing:start` | Начал набирать текст |
| `typing:stop` | Перестал набирать |
| `presence:ping` | Heartbeat онлайн-статуса |

| Event (сервер → клиент) | Описание |
|------------------------|----------|
| `message:new` | Новое сообщение в чате |
| `message:read` | Кто-то прочитал сообщение |
| `message:deleted` | Сообщение удалено |
| `typing:started` | Пользователь печатает |
| `typing:stopped` | Перестал печатать |
| `user:online` | Пользователь онлайн |
| `user:offline` | Пользователь офлайн |
| `error` | Ошибка |

#### Структура БД (Prisma / PostgreSQL)
- `users` — id, nickname, email, password_hash, avatar, bio, last_online, is_online
- `refresh_tokens` — id, token, user_id, expires_at
- `chats` — id, type (DIRECT/GROUP), name, avatar, description
- `chat_members` — id, chat_id, user_id, role (OWNER/ADMIN/MEMBER)
- `messages` — id, chat_id, sender_id, text, type, media_url, reply_to_id, is_edited, is_deleted
- `read_receipts` — id, message_id, user_id, read_at

#### Redis (присутствие)
- `user:{id}:online` — TTL 60s, продлевается heartbeat каждые 30s
- `user:{id}:last_online` — ISO-дата последнего онлайна
- `chat:{id}:typing:{userId}` — TTL 5s, обновляется при наборе

---

## Backlog (следующие итерации)

- [ ] Загрузка медиафайлов (S3/Minio)
- [ ] Push-уведомления (FCM / APNS)
- [ ] Реакции на сообщения
- [ ] Пересылка сообщений
- [ ] Роль ADMIN в группах (права на кик/бан)
- [ ] Rate limiting (express-rate-limit)
- [ ] Swagger / OpenAPI документация
- [ ] Unit и интеграционные тесты (Jest / Vitest)
- [ ] Docker Compose (postgres + redis + app)
- [ ] CI/CD pipeline

---

## Версии

| Версия | Дата | Описание |
|--------|------|----------|
| 0.1.0 | 01.03.2026 | Базовый бэкенд: auth, users, chats, messages, WS |
| 0.1.1 | 01.03.2026 | Фикс Prisma 7 config, Redis optional fallback, сервер запущен |
| 0.2.0 | 01.03.2026 | Фронтенд: SPA на ванильном JS (auth, чаты, WS, typing, presence) |
