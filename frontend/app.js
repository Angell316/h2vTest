/* ─── Config ─────────────────────────────────────────────────────── */
const API  = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';

/* ─── State ──────────────────────────────────────────────────────── */
const state = {
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  me: JSON.parse(localStorage.getItem('me') || 'null'),
  chats: [],
  activeChatId: null,
  onlineUsers: new Set(),
  typingTimers: {},   // chatId → timeoutId
  ws: null,
};

/* ─── API helpers ─────────────────────────────────────────────────── */
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.accessToken) headers['Authorization'] = `Bearer ${state.accessToken}`;

  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (res.status === 401 && state.refreshToken) {
    const ok = await tryRefresh();
    if (ok) return api(method, path, body);
    logout();
    return null;
  }

  return json;
}

async function tryRefresh() {
  const res = await fetch(`${API}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: state.refreshToken }),
  });
  if (!res.ok) return false;
  const json = await res.json();
  saveTokens(json.data);
  return true;
}

function saveTokens({ accessToken, refreshToken }) {
  state.accessToken  = accessToken;
  state.refreshToken = refreshToken;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

/* ─── WebSocket ───────────────────────────────────────────────────── */
function connectWS() {
  if (state.ws) state.ws.close();

  const ws = new WebSocket(`${WS_URL}?token=${state.accessToken}`);
  state.ws = ws;

  ws.onopen = () => console.log('[WS] connected');

  ws.onmessage = ({ data }) => {
    try { handleWsEvent(JSON.parse(data)); }
    catch {}
  };

  ws.onclose = (e) => {
    if (e.code !== 4001) setTimeout(connectWS, 3000);
  };

  // Heartbeat
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'presence:ping' }));
    }
  }, 25000);
}

function wsSend(event, payload) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ event, payload }));
  }
}

function handleWsEvent({ event, payload }) {
  switch (event) {
    case 'message:new':       onNewMessage(payload);   break;
    case 'message:read':      onMessageRead(payload);  break;
    case 'typing:started':    onTypingStarted(payload);break;
    case 'typing:stopped':    onTypingStopped(payload);break;
    case 'user:online':       onUserOnline(payload);   break;
    case 'user:offline':      onUserOffline(payload);  break;
  }
}

/* ─── WS event handlers ──────────────────────────────────────────── */
function onNewMessage(msg) {
  // Обновить lastMessage в списке чатов
  const chat = state.chats.find(c => c.id === msg.chatId);
  if (chat) {
    chat.lastMsg = msg.text || '[медиа]';
    renderChatList();
  }

  // Добавить в окно если открыт этот чат
  if (state.activeChatId === msg.chatId) {
    appendMessage(msg);
    scrollToBottom();

    // Отметить прочитанным если это чужое сообщение
    if (msg.sender.id !== state.me.id) {
      wsSend('message:read', { messageId: msg.id, chatId: msg.chatId });
    }
  }
}

function onMessageRead({ messageId }) {
  const el = document.querySelector(`[data-msg-id="${messageId}"]`);
  if (el) el.querySelector('.msg-time')?.classList.add('read');
}

function onTypingStarted({ chatId, userId }) {
  if (chatId !== state.activeChatId || userId === state.me.id) return;

  const chat = state.chats.find(c => c.id === chatId);
  const name = chat ? getChatPartnerName(chat) : '...';

  const bar = document.getElementById('cw-typing');
  if (bar) bar.textContent = `${name} печатает...`;

  clearTimeout(state.typingTimers[chatId]);
  state.typingTimers[chatId] = setTimeout(() => {
    if (bar) bar.textContent = '';
  }, 5000);
}

function onTypingStopped({ chatId }) {
  const bar = document.getElementById('cw-typing');
  if (bar && chatId === state.activeChatId) bar.textContent = '';
}

function onUserOnline({ userId }) {
  state.onlineUsers.add(userId);
  updateOnlineUI(userId, true);
}

function onUserOffline({ userId }) {
  state.onlineUsers.delete(userId);
  updateOnlineUI(userId, false);
}

function updateOnlineUI(userId, online) {
  // Обновить статус в заголовке чата
  if (state.activeChatId) {
    const chat = state.chats.find(c => c.id === state.activeChatId);
    if (chat && getPartnerUserId(chat) === userId) {
      const statusEl = document.getElementById('cw-status');
      if (statusEl) {
        statusEl.textContent = online ? 'онлайн' : 'офлайн';
        statusEl.className = 'chat-status' + (online ? ' online' : '');
      }
    }
  }
  // Обновить точку в списке
  const dot = document.querySelector(`.chat-item[data-chat-id] [data-user-id="${userId}"] .online-dot`);
  // Перерисуем список
  renderChatList();
}

/* ─── Auth logic ─────────────────────────────────────────────────── */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`${name}-screen`).classList.add('active');
}

async function login(email, password) {
  const res = await api('POST', '/api/auth/login', { email, password });
  if (!res?.success) throw new Error(res?.message || 'Ошибка входа');
  finishAuth(res.data);
}

async function register(nickname, email, password) {
  const res = await api('POST', '/api/auth/register', { nickname, email, password });
  if (!res?.success) throw new Error(res?.message || 'Ошибка регистрации');
  finishAuth(res.data);
}

async function finishAuth({ user, tokens }) {
  saveTokens(tokens);
  state.me = user;
  localStorage.setItem('me', JSON.stringify(user));
  await bootApp();
}

function logout() {
  if (state.refreshToken) {
    api('POST', '/api/auth/logout', { refreshToken: state.refreshToken }).catch(() => {});
  }
  state.ws?.close();
  localStorage.clear();
  Object.assign(state, {
    accessToken: null, refreshToken: null, me: null,
    chats: [], activeChatId: null, ws: null,
  });
  showScreen('auth');
}

/* ─── Boot ────────────────────────────────────────────────────────── */
async function bootApp() {
  showScreen('app');

  // My info
  document.getElementById('my-nickname').textContent = state.me.nickname;
  document.getElementById('my-avatar').textContent = state.me.nickname[0].toUpperCase();
  document.getElementById('my-avatar').className =
    `my-avatar av-${charColor(state.me.nickname[0])}`;

  // Load chats
  await loadChats();

  // Connect WS
  connectWS();
}

/* ─── Chats ───────────────────────────────────────────────────────── */
async function loadChats() {
  const res = await api('GET', '/api/chats');
  if (!res?.success) return;

  state.chats = res.data.map(chat => ({
    ...chat,
    lastMsg: chat.messages?.[0]?.text || '',
  }));

  renderChatList();
}

function renderChatList() {
  const el = document.getElementById('chat-list');

  if (!state.chats.length) {
    el.innerHTML = '<div class="empty-state">Нет чатов</div>';
    return;
  }

  el.innerHTML = state.chats.map(chat => {
    const name    = getChatName(chat);
    const initial = name[0]?.toUpperCase() || '?';
    const colorCls = `av-${charColor(initial)}`;
    const partnerId = getPartnerUserId(chat);
    const isOnline = partnerId && state.onlineUsers.has(partnerId);
    const isActive = chat.id === state.activeChatId ? 'active' : '';

    return `
      <div class="chat-item ${isActive}" data-chat-id="${chat.id}" onclick="openChat('${chat.id}')">
        <div class="chat-item-avatar ${colorCls}" data-user-id="${partnerId}">
          ${initial}
          ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-item-info">
          <div class="chat-item-name">${escHtml(name)}</div>
          <div class="chat-item-last">${escHtml(chat.lastMsg || 'Нет сообщений')}</div>
        </div>
      </div>`;
  }).join('');
}

/* ─── Open chat ───────────────────────────────────────────────────── */
async function openChat(chatId) {
  state.activeChatId = chatId;
  renderChatList();

  const chat = state.chats.find(c => c.id === chatId);
  const area = document.getElementById('chat-area');

  // Клонируем шаблон
  const tpl = document.getElementById('chat-window-tpl');
  const clone = tpl.content.cloneNode(true);
  area.innerHTML = '';
  area.appendChild(clone);

  const name = getChatName(chat);
  const initial = name[0]?.toUpperCase() || '?';
  const partnerId = getPartnerUserId(chat);
  const isOnline = partnerId && state.onlineUsers.has(partnerId);

  document.getElementById('cw-name').textContent = name;
  document.getElementById('cw-avatar').textContent = initial;
  document.getElementById('cw-avatar').className =
    `chat-avatar av-${charColor(initial)}`;

  const statusEl = document.getElementById('cw-status');
  statusEl.textContent = isOnline ? 'онлайн' : 'офлайн';
  statusEl.className = 'chat-status' + (isOnline ? ' online' : '');

  // Загрузить историю
  const res = await api('GET', `/api/chats/${chatId}/messages?limit=50`);
  const msgs = (res?.data || []).reverse(); // API возвращает desc
  const container = document.getElementById('cw-messages');
  container.innerHTML = '';
  msgs.forEach(m => appendMessage(m));
  scrollToBottom();

  // Форма отправки
  const form = document.getElementById('cw-form');
  const input = document.getElementById('cw-input');

  form.onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    wsSend('message:send', { chatId, text });
    input.value = '';
    wsSend('typing:stop', { chatId });
  };

  let typingActive = false;
  let typingTimer = null;

  input.oninput = () => {
    if (!typingActive) {
      wsSend('typing:start', { chatId });
      typingActive = true;
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      wsSend('typing:stop', { chatId });
      typingActive = false;
    }, 2500);
  };

  input.focus();
}

/* ─── Messages render ────────────────────────────────────────────── */
function appendMessage(msg) {
  const container = document.getElementById('cw-messages');
  if (!container) return;

  const isMine = msg.sender?.id === state.me.id || msg.senderId === state.me.id;
  const text = msg.isDeleted ? '[удалено]' : (msg.text || '[медиа]');
  const time = new Date(msg.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

  const group = document.createElement('div');
  group.className = `msg-group ${isMine ? 'mine' : 'theirs'}`;
  group.dataset.msgId = msg.id;

  if (!isMine) {
    const senderName = document.createElement('div');
    senderName.className = 'msg-sender-name';
    senderName.textContent = msg.sender?.nickname || '';
    group.appendChild(senderName);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  const timeEl = document.createElement('div');
  timeEl.className = 'msg-time';
  timeEl.textContent = time;

  group.appendChild(bubble);
  group.appendChild(timeEl);
  container.appendChild(group);
}

function scrollToBottom() {
  const c = document.getElementById('cw-messages');
  if (c) c.scrollTop = c.scrollHeight;
}

/* ─── User search ─────────────────────────────────────────────────── */
let searchTimer = null;

document.getElementById('user-search').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  const box = document.getElementById('search-results');

  if (q.length < 2) { box.classList.add('hidden'); return; }

  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const res = await api('GET', `/api/users/search?q=${encodeURIComponent(q)}`);
    const users = res?.data || [];

    if (!users.length) {
      box.innerHTML = '<div style="padding:12px 14px;color:var(--muted);font-size:13px">Не найдено</div>';
    } else {
      box.innerHTML = users
        .filter(u => u.id !== state.me.id)
        .map(u => `
          <div class="search-user-item" onclick="startChat('${u.id}','${escHtml(u.nickname)}')">
            <div class="chat-item-avatar av-${charColor(u.nickname[0])} " style="width:32px;height:32px;font-size:13px">
              ${u.nickname[0].toUpperCase()}
            </div>
            <span style="font-size:14px">${escHtml(u.nickname)}</span>
            ${u.isOnline ? '<span style="color:var(--online);font-size:11px;margin-left:auto">онлайн</span>' : ''}
          </div>`).join('');
    }

    box.classList.remove('hidden');
  }, 300);
});

document.getElementById('user-search').addEventListener('blur', () => {
  setTimeout(() => document.getElementById('search-results').classList.add('hidden'), 200);
});

async function startChat(userId) {
  document.getElementById('user-search').value = '';
  document.getElementById('search-results').classList.add('hidden');

  const res = await api('POST', '/api/chats/direct', { targetUserId: userId });
  if (!res?.success) return;

  const chat = res.data;
  // Добавить в список если нет
  if (!state.chats.find(c => c.id === chat.id)) {
    state.chats.unshift({ ...chat, lastMsg: '' });
  }
  renderChatList();
  openChat(chat.id);
}

/* ─── Helpers ─────────────────────────────────────────────────────── */
function getChatName(chat) {
  if (chat.type === 'GROUP') return chat.name || 'Группа';
  const partner = chat.members?.find(m => m.userId !== state.me.id || m.user?.id !== state.me.id);
  return partner?.user?.nickname || partner?.nickname || 'Чат';
}

function getChatPartnerName(chat) {
  const m = chat.members?.find(m => (m.user?.id || m.userId) !== state.me.id);
  return m?.user?.nickname || 'пользователь';
}

function getPartnerUserId(chat) {
  if (chat.type === 'GROUP') return null;
  const m = chat.members?.find(m => (m.user?.id || m.userId) !== state.me.id);
  return m?.user?.id || m?.userId || null;
}

function escHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function charColor(ch = '') {
  return (ch.toUpperCase().charCodeAt(0) || 0) % 6;
}

/* ─── Auth UI events ─────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
  });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    await login(
      document.getElementById('login-email').value,
      document.getElementById('login-password').value,
    );
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  try {
    await register(
      document.getElementById('reg-nickname').value,
      document.getElementById('reg-email').value,
      document.getElementById('reg-password').value,
    );
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', logout);

/* ─── Init ────────────────────────────────────────────────────────── */
(async () => {
  if (state.accessToken && state.me) {
    await bootApp();
  } else {
    showScreen('auth');
  }
})();
