/* ─── Error codes → русский ─────────────────────────────────────── */
const ERROR_MESSAGES = {
  EMAIL_TAKEN:           'Этот email уже занят',
  NICKNAME_TAKEN:        'Этот никнейм уже занят',
  INVALID_CREDENTIALS:   'Неверный email или пароль',
  NICKNAME_TOO_SHORT:    'Никнейм минимум 3 символа',
  NICKNAME_INVALID_CHARS:'Никнейм: только латиница, цифры и _',
  PASSWORD_TOO_SHORT:    'Пароль минимум 8 символов',
  EMAIL_INVALID:         'Неверный формат email',
  FIELD_REQUIRED:        'Заполните все поля',
};
function tr(code) { return ERROR_MESSAGES[code] ?? code ?? 'Ошибка'; }

/* ─── Config ────────────────────────────────────────────────────── */
const API = window.location.origin;
const WS_PROTO = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTO}//${window.location.host}/ws`;

/* ─── State ──────────────────────────────────────────────────────── */
const state = {
  accessToken:     localStorage.getItem('accessToken') || null,
  refreshToken:    localStorage.getItem('refreshToken') || null,
  me:              JSON.parse(localStorage.getItem('me') || 'null'),
  chats:           [],
  nextChatCursor:  null,
  activeChatId:    null,
  onlineUsers:     new Set(),
  ws:              null,
  wsHeartbeat:     null,
  typingTimers:    {},
  unread:          {},
  signalStore:     null,
};

/* ════════════════════════════════════════════════════════════════════
   Signal Protocol E2E Encryption
   ════════════════════════════════════════════════════════════════════ */
function _sl() { return window.SignalLib || {}; }
function _su() { return window.SignalUtils || {}; }

const PREKEY_COUNT = 100;
const pendingPlaintext = {};

// ── Plaintext cache (sender sees own messages after reload) ──────────────────
function savePlaintext(msgId, text) {
  try {
    const cache = JSON.parse(localStorage.getItem('e2e_pt') || '{}');
    cache[msgId] = text;
    const keys = Object.keys(cache);
    if (keys.length > 500) { for (let i = 0; i < keys.length - 500; i++) delete cache[keys[i]]; }
    localStorage.setItem('e2e_pt', JSON.stringify(cache));
  } catch {}
}
function getPlaintext(msgId) {
  try { return (JSON.parse(localStorage.getItem('e2e_pt') || '{}'))[msgId] || null; }
  catch { return null; }
}

// ── Store ────────────────────────────────────────────────────────────────────
function getSignalStore() {
  if (!state.signalStore && state.me && window.SignalStore) {
    state.signalStore = new window.SignalStore(state.me.id);
  }
  return state.signalStore;
}

function isE2EAvailable() {
  return !!(window.SignalLib && window.SignalStore && window.SignalUtils);
}

function getAddress(userId) {
  return new (_sl().SignalProtocolAddress)(userId, 1);
}

// ── Reset: wipe local keys + tell server to reset OTP keys ──────────────────
async function resetE2E() {
  if (!state.me) return;
  const dbName = `signal-store-${state.me.id}`;
  try {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = resolve;
      req.onerror = reject;
      req.onblocked = resolve;
    });
  } catch {}
  // NOTE: e2e_pt (plaintext cache) is intentionally NOT cleared —
  // so old decrypted messages remain readable after key reset
  state.signalStore = null;
  console.log('[E2E] Reset done, generating fresh keys...');
  await initSignalKeys();
}

// Called from window.load after signal-protocol.js finishes loading
window.initE2EAfterLoad = function() {
  if (!state.me || !state.accessToken || !isE2EAvailable()) return;
  const E2E_VER = '4';
  if (localStorage.getItem('e2e_version') !== E2E_VER) {
    console.log('[E2E] Resetting to version', E2E_VER);
    resetE2E()
      .then(() => localStorage.setItem('e2e_version', E2E_VER))
      .catch(err => console.error('[E2E] Reset error:', err));
  } else {
    initSignalKeys().catch(() => {});
  }
};

// ── Auto-replenish OTP prekeys when running low ──────────────────────────────
const PREKEY_MIN_THRESHOLD = 20; // пополнять если осталось меньше
let replenishInProgress = false;

async function checkAndReplenishPreKeys() {
  if (replenishInProgress || !isE2EAvailable()) return;
  try {
    const res = await api('GET', '/api/keys/count');
    if (!res?.success) return;
    if (res.data.count >= PREKEY_MIN_THRESHOLD) return;

    replenishInProgress = true;
    const store = getSignalStore();
    if (!store) return;

    const KH = _sl().KeyHelper;
    const ab2b64 = _su().arrayBufferToBase64;

    // Генерируем от текущего макс. keyId + 1
    const newKeys = [];
    const startId = Date.now() % 100000; // уникальный стартовый ID
    for (let i = 0; i < PREKEY_COUNT; i++) {
      const pk = await KH.generatePreKey(startId + i);
      await store.storePreKey(startId + i, pk.keyPair);
      newKeys.push({ keyId: startId + i, publicKey: ab2b64(pk.keyPair.pubKey) });
    }
    await api('POST', '/api/keys/replenish', { preKeys: newKeys });
    console.log(`[E2E] Replenished ${newKeys.length} prekeys`);
  } catch (err) {
    console.warn('[E2E] Replenish failed:', err);
  } finally {
    replenishInProgress = false;
  }
}

// ── Key generation + upload ──────────────────────────────────────────────────
async function initSignalKeys() {
  const KH = _sl().KeyHelper;
  if (!KH) { console.warn('[E2E] SignalLib not loaded yet'); return; }
  const store = getSignalStore();
  if (!store) return;

  try {
    if (await store.hasIdentityKeyPair()) { console.log('[E2E] Keys ready'); return; }

    console.log('[E2E] Generating keys...');
    const identityKeyPair = await KH.generateIdentityKeyPair();
    const registrationId  = KH.generateRegistrationId();
    const signedPreKey    = await KH.generateSignedPreKey(identityKeyPair, 1);

    await store.storeIdentityKeyPair(identityKeyPair);
    await store.storeLocalRegistrationId(registrationId);
    await store.storeSignedPreKey(1, signedPreKey.keyPair);

    const ab2b64 = _su().arrayBufferToBase64;
    const preKeys = [];
    for (let i = 1; i <= PREKEY_COUNT; i++) {
      const pk = await KH.generatePreKey(i);
      await store.storePreKey(i, pk.keyPair);
      preKeys.push({ keyId: i, publicKey: ab2b64(pk.keyPair.pubKey) });
    }

    await api('POST', '/api/keys/bundle', {
      registrationId,
      identityKey:     ab2b64(identityKeyPair.pubKey),
      signedPreKeyId:  signedPreKey.keyId,
      signedPreKey:    ab2b64(signedPreKey.keyPair.pubKey),
      signedPreKeySig: ab2b64(signedPreKey.signature),
      oneTimePreKeys:  preKeys,
    });
    console.log('[E2E] Keys uploaded OK');
  } catch (err) {
    console.error('[E2E] initSignalKeys:', err);
  }
}

// ── Session: only the SENDER builds it before first message ─────────────────
async function ensureSession(partnerId) {
  const store = getSignalStore();
  if (!store) return false;

  const addr = getAddress(partnerId);
  const existing = await store.loadSession(addr.toString());
  if (existing) return true;  // already have a session

  try {
    const res = await api('GET', `/api/keys/bundle/${partnerId}`);
    if (!res?.success || !res.data) { console.warn('[E2E] No bundle for', partnerId); return false; }

    const bundle = res.data;
    const b64ab  = _su().base64ToArrayBuffer;

    const pkBundle = {
      registrationId: bundle.registrationId,
      identityKey:    b64ab(bundle.identityKey),
      signedPreKey: {
        keyId:     bundle.signedPreKeyId,
        publicKey: b64ab(bundle.signedPreKey),
        signature: b64ab(bundle.signedPreKeySig),
      },
    };
    if (bundle.preKey) {
      pkBundle.preKey = { keyId: bundle.preKey.keyId, publicKey: b64ab(bundle.preKey.publicKey) };
    }

    const builder = new (_sl().SessionBuilder)(store, addr);
    await builder.processPreKey(pkBundle);
    console.log('[E2E] Session established with', partnerId);
    return true;
  } catch (err) {
    console.error('[E2E] ensureSession failed:', err);
    return false;
  }
}

// ── Encrypt ──────────────────────────────────────────────────────────────────
async function encryptMessage(partnerId, plaintext) {
  const store = getSignalStore();
  if (!store) return null;
  try {
    const addr    = getAddress(partnerId);
    const cipher  = new (_sl().SessionCipher)(store, addr);
    const enc     = await cipher.encrypt(_su().textToArrayBuffer(plaintext));
    // enc.body is always a binary string from this library
    const ct = (typeof enc.body === 'string') ? btoa(enc.body) : _su().arrayBufferToBase64(enc.body);
    return { ciphertext: ct, signalType: enc.type };
  } catch (err) {
    console.error('[E2E] encrypt:', err);
    return null;
  }
}

// ── Decrypt: try correct method, then fallback ───────────────────────────────
async function decryptMessage(senderId, ciphertext, signalType) {
  const store = getSignalStore();
  if (!store) return null;
  try {
    const addr   = getAddress(senderId);
    const cipher = new (_sl().SessionCipher)(store, addr);

    // Convert base64 → binary string → ArrayBuffer
    const binStr = atob(ciphertext);
    const bytes  = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    const body   = bytes.buffer;

    // type 3 = PreKeyWhisperMessage (first message), type 1 = WhisperMessage
    const tryPreKey   = () => cipher.decryptPreKeyWhisperMessage(body);
    const tryWhisper  = () => cipher.decryptWhisperMessage(body);

    let plainBuf;
    if (signalType === 3) {
      try { plainBuf = await tryPreKey(); }
      catch { plainBuf = await tryWhisper(); }
    } else {
      try { plainBuf = await tryWhisper(); }
      catch { plainBuf = await tryPreKey(); }
    }

    return _su().arrayBufferToText(plainBuf);
  } catch (err) {
    console.error('[E2E] decrypt:', err.message);
    return null;
  }
}

/* ─── API ────────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.accessToken) headers['Authorization'] = `Bearer ${state.accessToken}`;

  let res;
  try {
    res = await fetch(API + path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Нет соединения с сервером');
  }

  const json = await res.json().catch(() => ({}));

  if (res.status === 401 && state.refreshToken) {
    const ok = await refreshTokens();
    if (ok) return api(method, path, body);
    logout();
    return null;
  }

  if (!res.ok) throw new Error(tr(json?.message));
  return json;
}

async function refreshTokens() {
  try {
    const res = await fetch(`${API}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });
    if (!res.ok) return false;
    const { data } = await res.json();
    saveTokens(data);
    return true;
  } catch { return false; }
}

function saveTokens({ accessToken, refreshToken }) {
  state.accessToken  = accessToken;
  state.refreshToken = refreshToken;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

/* ════════════════════════════════════════════════════════════════════
   WebSocket — connect / reconnect / heartbeat
   ════════════════════════════════════════════════════════════════════ */
function connectWS() {
  if (state.ws) { state.ws.onclose = null; state.ws.close(); }
  clearInterval(state.wsHeartbeat);

  showConnectionStatus('connecting');

  const ws = new WebSocket(`${WS_URL}?token=${state.accessToken}`);
  state.ws = ws;

  ws.onopen = () => {
    console.log('[WS] connected');
    showConnectionStatus('online');

    // Heartbeat каждые 25 сек
    state.wsHeartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ event: 'presence:ping' }));
    }, 25_000);
  };

  ws.onmessage = ({ data }) => {
    try { handleWsEvent(JSON.parse(data)); } catch {}
  };

  ws.onclose = (e) => {
    clearInterval(state.wsHeartbeat);
    if (e.code === 4001) {
      // Невалидный токен — не реконнектим
      showConnectionStatus('offline');
      return;
    }
    showConnectionStatus('reconnecting');
    setTimeout(connectWS, 2000);
  };

  ws.onerror = () => {};
}

function wsSend(event, payload) {
  if (state.ws?.readyState === WebSocket.OPEN)
    state.ws.send(JSON.stringify({ event, payload }));
}

function showConnectionStatus(status) {
  let el = document.getElementById('conn-status');
  if (!el) return;

  const map = {
    online:       { text: '',                    cls: '' },
    connecting:   { text: 'Подключение...',      cls: 'conn-warn' },
    reconnecting: { text: 'Переподключение...', cls: 'conn-warn' },
    offline:      { text: 'Нет связи',           cls: 'conn-err' },
  };
  const s = map[status] || map.offline;
  el.textContent = s.text;
  el.className = 'conn-status ' + s.cls;
}

/* ════════════════════════════════════════════════════════════════════
   WS Event Router
   ════════════════════════════════════════════════════════════════════ */
function handleWsEvent({ event, payload }) {
  switch (event) {
    case 'message:new':       onNewMessage(payload);       break;
    case 'message:delivered': onMessageDelivered(payload); break;
    case 'message:read':      onMessageRead(payload);      break;
    case 'message:deleted':   onMessageDeleted(payload);   break;
    case 'reaction:added':    onReactionAdded(payload);    break;
    case 'reaction:removed':  onReactionRemoved(payload);  break;
    case 'typing:started':    onTypingStarted(payload);    break;
    case 'typing:stopped':    onTypingStopped(payload);    break;
    case 'user:online':        onUserOnline(payload);         break;
    case 'user:offline':       onUserOffline(payload);        break;
    case 'presence:snapshot':  onPresenceSnapshot(payload);   break;
  }
}

/* ─── reaction:added / removed ──────────────────────────────────── */
function updateReactBar(messageId, updater) {
  const group = document.querySelector(`[data-msg-id="${messageId}"]`);
  if (!group) return;
  const bar = group.querySelector('.msg-react-bar');
  if (!bar) return;
  // Rebuild reactions from current chips + update
  const reactions = collectReactionsFromBar(bar);
  updater(reactions);
  renderReactions(bar, reactions, messageId);
}

function collectReactionsFromBar(bar) {
  const chips = bar.querySelectorAll('.react-chip');
  const reactions = [];
  chips.forEach(chip => {
    const parts = chip.textContent.trim().split(' ');
    const emoji = parts[0]; const cnt = parseInt(parts[1]) || 1;
    const isActive = chip.classList.contains('active');
    for (let i = 0; i < cnt; i++) {
      reactions.push({ emoji, userId: isActive && i === 0 ? state.me.id : '__other__' });
    }
  });
  return reactions;
}

function onReactionAdded({ reaction, chatId }) {
  if (state.activeChatId !== chatId) return;
  updateReactBar(reaction.messageId, (reactions) => {
    if (!reactions.find(r => r.userId === reaction.userId && r.emoji === reaction.emoji)) {
      reactions.push(reaction);
    }
  });
}

function onReactionRemoved({ messageId, userId, emoji, chatId }) {
  if (state.activeChatId !== chatId) return;
  updateReactBar(messageId, (reactions) => {
    const idx = reactions.findIndex(r => r.userId === userId && r.emoji === emoji);
    if (idx !== -1) reactions.splice(idx, 1);
  });
}

/* ─── message:deleted ────────────────────────────────────────────── */
function onMessageDeleted({ messageId, chatId }) {
  // Удаляем из DOM если чат открыт
  if (state.activeChatId === chatId) {
    const el = document.querySelector(`[data-msg-id="${messageId}"]`);
    if (el) {
      const textEl = el.querySelector('.msg-text');
      if (textEl) textEl.textContent = '[удалено]';
      el.classList.add('msg-deleted');
    }
  }
  // Обновляем превью в сайдбаре если это последнее сообщение
  const chat = state.chats.find(c => c.id === chatId);
  if (chat && chat.lastMsg) {
    chat.lastMsg = '[удалено]';
    renderChatList();
  }
}

/* ─── message:new ───────────────────────────────────────────────── */
async function onNewMessage(msg) {
  const isMine = msg.sender?.id === state.me.id;
  const isEncrypted = !!(msg.ciphertext && msg.signalType > 0);

  let chat = state.chats.find(c => c.id === msg.chatId);
  if (!chat) {
    loadChats();
    return;
  }

  let previewText = msg.text || '[медиа]';
  if (isEncrypted) {
    if (isMine && pendingPlaintext[msg.chatId]) {
      previewText = pendingPlaintext[msg.chatId];
      msg._decryptedText = previewText;
      savePlaintext(msg.id, previewText);
      delete pendingPlaintext[msg.chatId];
    } else if (isMine) {
      const cached = getPlaintext(msg.id);
      previewText = cached || msg._decryptedText || '🔒 Зашифрованное сообщение';
      if (cached) msg._decryptedText = cached;
    } else if (isE2EAvailable() && msg.sender?.id) {
      const cached2 = getPlaintext(msg.id);
      if (cached2) {
        previewText = cached2;
        msg._decryptedText = cached2;
      } else {
        const dec = await decryptMessage(msg.sender.id, msg.ciphertext, msg.signalType);
        if (dec) {
          previewText = dec;
          msg._decryptedText = dec;
          savePlaintext(msg.id, dec);
        } else {
          previewText = '🔒 Зашифрованное сообщение';
        }
      }
    } else {
      previewText = '🔒 Зашифрованное сообщение';
    }
  }

  chat.lastMsg = previewText;
  chat.lastMsgTime = msg.createdAt;
  chat.lastSenderNick = msg.sender?.nickname || '';

  if (!isMine && state.activeChatId !== msg.chatId) {
    state.unread[msg.chatId] = (state.unread[msg.chatId] || 0) + 1;
    playNotificationSound();
  }

  sortChats();
  renderChatList();

  if (state.activeChatId === msg.chatId) {
    await appendMessage(msg);
    scrollToBottom();
    if (!isMine) wsSend('message:read', { messageId: msg.id, chatId: msg.chatId });
  }
}

/* ─── message:delivered — получатель онлайн, сообщение дошло ──── */
function onMessageDelivered({ messageId }) {
  const el = document.querySelector(`[data-msg-id="${messageId}"] .msg-check`);
  if (el && !el.classList.contains('read')) {
    el.classList.add('delivered');
    el.innerHTML = '✓✓';
    el.title = 'Доставлено';
  }
}

/* ─── message:read ──────────────────────────────────────────────── */
function onMessageRead({ messageId }) {
  const el = document.querySelector(`[data-msg-id="${messageId}"] .msg-check`);
  if (el) {
    el.classList.remove('delivered');
    el.classList.add('read');
    el.innerHTML = '✓✓';
    el.title = 'Прочитано';
  }
}

/* ─── typing ────────────────────────────────────────────────────── */
function onTypingStarted({ chatId, userId }) {
  if (userId === state.me.id) return;

  // В sidebar показываем "печатает..." вместо last msg
  const chat = state.chats.find(c => c.id === chatId);
  if (chat) chat._typing = true;
  renderChatList();

  // В окне чата
  if (chatId === state.activeChatId) {
    const bar = document.getElementById('cw-typing');
    const name = chat ? getChatPartnerName(chat) : '...';
    if (bar) bar.innerHTML = `<span class="typing-dots">${escHtml(name)} печатает<span>.</span><span>.</span><span>.</span></span>`;
  }

  // Автоочистка через 5 сек
  clearTimeout(state.typingTimers[chatId]);
  state.typingTimers[chatId] = setTimeout(() => onTypingStopped({ chatId }), 5000);
}

function onTypingStopped({ chatId }) {
  clearTimeout(state.typingTimers[chatId]);

  const chat = state.chats.find(c => c.id === chatId);
  if (chat) { chat._typing = false; renderChatList(); }

  if (chatId === state.activeChatId) {
    const bar = document.getElementById('cw-typing');
    if (bar) bar.innerHTML = '';
  }
}

/* ─── presence ──────────────────────────────────────────────────── */
// userId → ISO дата последнего выхода
const lastOnlineCache = {};

function onUserOnline({ userId }) {
  state.onlineUsers.add(userId);
  refreshPresenceUI(userId);
}

function onUserOffline({ userId, lastOnline }) {
  state.onlineUsers.delete(userId);
  if (lastOnline) lastOnlineCache[userId] = lastOnline;
  refreshPresenceUI(userId);
}

function onPresenceSnapshot({ onlineUserIds }) {
  // Инициализируем онлайн-статус всех кто уже был в сети до нашего коннекта
  for (const uid of onlineUserIds) {
    state.onlineUsers.add(uid);
  }
  renderChatList();
  const chat = state.chats.find(c => c.id === state.activeChatId);
  if (chat) updateChatHeaderStatus(getPartnerUserId(chat));
}

function refreshPresenceUI(userId) {
  renderChatList();

  if (!state.activeChatId) return;
  const chat = state.chats.find(c => c.id === state.activeChatId);
  if (!chat) return;
  const partnerId = getPartnerUserId(chat);
  if (partnerId !== userId) return;

  updateChatHeaderStatus(partnerId);
}

function updateChatHeaderStatus(partnerId) {
  const el = document.getElementById('cw-status');
  if (!el || !partnerId) return;

  if (state.onlineUsers.has(partnerId)) {
    el.textContent = 'онлайн';
    el.className = 'chat-status online';
  } else {
    const lastSeen = lastOnlineCache[partnerId] || getPartnerLastOnline(partnerId);
    el.textContent = lastSeen ? formatLastSeen(lastSeen) : 'офлайн';
    el.className = 'chat-status';
  }
}

function getPartnerLastOnline(partnerId) {
  for (const chat of state.chats) {
    const m = chat.members?.find(m => (m.user?.id || m.userId) === partnerId);
    if (m?.user?.lastOnline) return m.user.lastOnline;
  }
  return null;
}

function formatLastSeen(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'был(а) только что';
  if (diffMin < 60) return `был(а) ${diffMin} мин. назад`;

  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `был(а) в ${time}`;
  if (isYesterday) return `был(а) вчера в ${time}`;
  return `был(а) ${d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}`;
}

/* ─── Notification sound (generated) ────────────────────────────── */
let audioCtx;
function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {}
}

/* ════════════════════════════════════════════════════════════════════
   Auth
   ════════════════════════════════════════════════════════════════════ */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`${name}-screen`).classList.add('active');
}

async function login(email, password) {
  const res = await api('POST', '/api/auth/login', { email, password });
  await finishAuth(res.data);
}

async function register(nickname, email, password) {
  if (!nickname) throw new Error(tr('FIELD_REQUIRED'));
  if (nickname.length < 3) throw new Error(tr('NICKNAME_TOO_SHORT'));
  if (!/^[a-zA-Z0-9_]+$/.test(nickname)) throw new Error(tr('NICKNAME_INVALID_CHARS'));
  if (password.length < 8) throw new Error(tr('PASSWORD_TOO_SHORT'));
  const res = await api('POST', '/api/auth/register', { nickname, email, password });
  await finishAuth(res.data);
}

async function finishAuth({ user, tokens }) {
  saveTokens(tokens);
  state.me = user;
  localStorage.setItem('me', JSON.stringify(user));
  state.signalStore = null;
  await bootApp();
}

function logout() {
  api('POST', '/api/auth/logout', { refreshToken: state.refreshToken }).catch(() => {});
  clearInterval(state.wsHeartbeat);
  if (state.ws) { state.ws.onclose = null; state.ws.close(); }
  // Preserve plaintext cache and e2e version across logout
  const pt  = localStorage.getItem('e2e_pt');
  const ver = localStorage.getItem('e2e_version');
  localStorage.clear();
  if (pt)  localStorage.setItem('e2e_pt', pt);
  if (ver) localStorage.setItem('e2e_version', ver);
  Object.assign(state, {
    accessToken: null, refreshToken: null, me: null,
    chats: [], activeChatId: null, ws: null, onlineUsers: new Set(), unread: {},
    signalStore: null,
  });
  showScreen('auth');
}

/* ════════════════════════════════════════════════════════════════════
   Boot
   ════════════════════════════════════════════════════════════════════ */
async function bootApp() {
  showScreen('app');

  const $nick = document.getElementById('my-nickname');
  const $av   = document.getElementById('my-avatar');
  $nick.textContent = state.me.nickname;
  $av.textContent = state.me.nickname[0].toUpperCase();
  $av.className = `my-avatar av-${charColor(state.me.nickname[0])}`;

  await loadChats();
  connectWS();
}

/* ════════════════════════════════════════════════════════════════════
   Chats
   ════════════════════════════════════════════════════════════════════ */
function mapChat(chat) {
  const lastMsg = chat.messages?.[0];
  let preview = lastMsg?.text || '';
  if (lastMsg?.ciphertext && lastMsg?.signalType > 0) {
    const cached = lastMsg.id ? getPlaintext(lastMsg.id) : null;
    preview = cached || '🔒 Зашифрованное сообщение';
  }
  return {
    ...chat,
    lastMsg:        preview,
    lastMsgTime:    lastMsg?.createdAt || chat.updatedAt,
    lastSenderNick: lastMsg?.sender?.nickname || '',
    _typing:        false,
  };
}

async function loadChats(cursor = null, append = false) {
  const url = '/api/chats?limit=30' + (cursor ? `&cursor=${cursor}` : '');
  const res = await api('GET', url);
  if (!res?.success) return;

  // Новый формат: { chats: [...], nextCursor: string|null }
  const rawChats = Array.isArray(res.data) ? res.data : (res.data.chats ?? []);
  state.nextChatCursor = res.data?.nextCursor ?? null;

  const mapped = rawChats.map(mapChat);
  if (append) {
    // Добавляем старые чаты в конец, не дублируя уже существующие
    const existingIds = new Set(state.chats.map(c => c.id));
    state.chats.push(...mapped.filter(c => !existingIds.has(c.id)));
  } else {
    state.chats = mapped;
  }

  sortChats();
  renderChatList();
}

function sortChats() {
  state.chats.sort((a, b) =>
    new Date(b.lastMsgTime || 0) - new Date(a.lastMsgTime || 0));
}

function renderChatList() {
  const el = document.getElementById('chat-list');
  if (!state.chats.length) {
    el.innerHTML = '<div class="empty-state">Нет чатов — найди собеседника через поиск</div>';
    return;
  }

  el.innerHTML = state.chats.map(chat => {
    const name      = getChatName(chat);
    const initial   = name[0]?.toUpperCase() || '?';
    const colorCls  = `av-${charColor(initial)}`;
    const partnerId = getPartnerUserId(chat);
    const isOnline  = partnerId && state.onlineUsers.has(partnerId);
    const isActive  = chat.id === state.activeChatId ? 'active' : '';
    const unread    = state.unread[chat.id] || 0;

    // Подстрока — typing или lastMsg
    let subtitle;
    if (chat._typing) {
      subtitle = '<span class="typing-label">печатает...</span>';
    } else {
      const prefix = chat.lastSenderNick ? `${chat.lastSenderNick}: ` : '';
      subtitle = escHtml(prefix + (chat.lastMsg || 'Нет сообщений'));
    }

    // Время
    const timeStr = chat.lastMsgTime ? formatTime(chat.lastMsgTime) : '';

    return `
      <div class="chat-item ${isActive}" data-chat-id="${chat.id}" onclick="openChat('${chat.id}')">
        <div class="chat-item-avatar ${colorCls}" data-user-id="${partnerId}">
          ${initial}
          ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-item-info">
          <div class="chat-item-top">
            <div class="chat-item-name">${escHtml(name)}${(chat.type !== 'GROUP') ? '<span class="e2e-icon">🔒</span>' : ''}</div>
            <div class="chat-item-time">${timeStr}</div>
          </div>
          <div class="chat-item-bottom">
            <div class="chat-item-last">${subtitle}</div>
            ${unread ? `<div class="unread-badge">${unread}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  // Кнопка "Загрузить ещё" если есть следующая страница
  if (state.nextChatCursor) {
    el.insertAdjacentHTML('beforeend', `
      <div class="load-more-wrap">
        <button class="load-more-btn" onclick="loadChats('${state.nextChatCursor}', true)">
          Загрузить ещё чаты
        </button>
      </div>`);
  }
}

/* ════════════════════════════════════════════════════════════════════
   Open Chat
   ════════════════════════════════════════════════════════════════════ */
async function openChat(chatId) {
  state.activeChatId = chatId;
  state.unread[chatId] = 0;
  renderChatList();

  const chat = state.chats.find(c => c.id === chatId);
  const area = document.getElementById('chat-area');

  const tpl = document.getElementById('chat-window-tpl');
  const clone = tpl.content.cloneNode(true);
  area.innerHTML = '';
  area.appendChild(clone);

  const name      = getChatName(chat);
  const initial   = name[0]?.toUpperCase() || '?';
  const partnerId = getPartnerUserId(chat);

  document.getElementById('cw-name').textContent = name;
  document.getElementById('cw-avatar').textContent = initial;
  document.getElementById('cw-avatar').className = `chat-avatar av-${charColor(initial)}`;

  updateChatHeaderStatus(partnerId);

  // E2E: check if partner has keys — use lightweight endpoint that does NOT consume OTP prekeys
  let partnerHasBundle = false;
  if (isE2EAvailable() && partnerId && chat?.type !== 'GROUP') {
    const store = getSignalStore();
    if (store) {
      // First check local session (free)
      const existing = await store.loadSession(getAddress(partnerId).toString());
      if (existing) {
        partnerHasBundle = true;
      } else {
        // Lightweight server check — no OTP key consumed
        const r = await api('GET', `/api/keys/has-bundle/${partnerId}`).catch(() => null);
        partnerHasBundle = !!(r?.success && r?.data?.hasBundle);
      }
    }
  }

  const e2eBadge = document.getElementById('cw-e2e');
  if (e2eBadge) e2eBadge.style.display = partnerHasBundle ? 'inline-flex' : 'none';

  // История
  const res = await api('GET', `/api/chats/${chatId}/messages?limit=50`);
  const container = document.getElementById('cw-messages');

  if (!res?.success) {
    container.innerHTML = `<div class="empty-state" style="color:var(--text-secondary);padding:24px">
      Не удалось загрузить сообщения. Попробуй перезагрузить страницу.
    </div>`;
    // Убираем битый чат из списка
    state.chats = state.chats.filter(c => c.id !== chatId);
    renderChatList();
    return;
  }

  const msgs = (res.data || []).reverse();
  container.innerHTML = '';
  for (const m of msgs) {
    await appendMessage(m);
  }
  scrollToBottom();

  // Форма
  const form       = document.getElementById('cw-form');
  const input      = document.getElementById('cw-input');
  const fileBtn    = document.getElementById('cw-file-btn');
  const fileInput  = document.getElementById('cw-file-input');
  const searchBtn  = document.getElementById('cw-search-btn');
  let typingActive = false, typingTimer = null;
  let replyToMsg   = null;  // текущий reply

  // ── Reply: функции ────────────────────────────────────────────────
  window.setReplyTo = (msg) => {
    replyToMsg = msg;
    let preview = form.querySelector('.reply-bar');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'reply-bar';
      form.insertBefore(preview, form.firstChild);
    }
    const nick = msg.sender?.nickname || '';
    const txt  = msg.text || (msg.ciphertext ? '🔒 Зашифровано' : '[медиа]');
    preview.innerHTML = `<span>↩ ${escHtml(nick)}: ${escHtml(txt.slice(0, 60))}</span>
      <button type="button" onclick="clearReply()">✕</button>`;
    input.focus();
  };

  window.clearReply = () => {
    replyToMsg = null;
    form.querySelector('.reply-bar')?.remove();
  };

  // ── Удаление из контекстного меню ────────────────────────────────
  window.deleteMsg = async (msgId) => {
    await api('DELETE', `/api/messages/${msgId}`);
  };

  // ── Редактирование из контекстного меню ──────────────────────────
  window.startEditMessage = (msg) => {
    input.value = msg.text || '';
    input.focus();
    input.dataset.editId = msg.id;
    let bar = form.querySelector('.edit-bar');
    if (!bar) { bar = document.createElement('div'); bar.className = 'edit-bar'; form.insertBefore(bar, form.firstChild); }
    bar.innerHTML = `<span>✏️ Редактирование</span><button type="button" onclick="cancelEdit()">✕</button>`;
  };

  window.cancelEdit = () => {
    input.value = '';
    delete input.dataset.editId;
    form.querySelector('.edit-bar')?.remove();
  };

  // ── Отправка формы ────────────────────────────────────────────────
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();

    // Режим редактирования
    if (input.dataset.editId) {
      if (!text) return;
      await api('PATCH', `/api/messages/${input.dataset.editId}`, { text });
      window.cancelEdit();
      return;
    }

    if (!text) return;
    input.value = '';
    clearTimeout(typingTimer);
    if (typingActive) { wsSend('typing:stop', { chatId }); typingActive = false; }

    const replyToId = replyToMsg?.id || undefined;
    window.clearReply();

    // E2E
    if (isE2EAvailable() && partnerId && chat?.type !== 'GROUP') {
      const sessionReady = await ensureSession(partnerId);
      if (sessionReady) {
        const enc = await encryptMessage(partnerId, text);
        if (enc) {
          pendingPlaintext[chatId] = text;
          wsSend('message:send', { chatId, ciphertext: enc.ciphertext, signalType: enc.signalType, replyToId });
          // Проверяем остаток prekeys в фоне
          setTimeout(() => checkAndReplenishPreKeys(), 3000);
          return;
        }
      }
    }
    wsSend('message:send', { chatId, text, replyToId });
  };

  // ── Файл ──────────────────────────────────────────────────────────
  if (fileBtn && fileInput) {
    fileBtn.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      fileInput.value = '';
      const fd = new FormData();
      fd.append('file', file);

      const token = state.accessToken;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const json = await res.json();
        if (json?.success) {
          wsSend('message:send', { chatId, text: '', mediaUrl: json.data.url, type: json.data.type });
        }
      } catch {}
    };
  }

  // ── Поиск по сообщениям ────────────────────────────────────────────
  if (searchBtn) {
    searchBtn.onclick = () => {
      const existing = document.getElementById('msg-search-bar');
      if (existing) { existing.remove(); return; }
      const bar = document.createElement('div');
      bar.id = 'msg-search-bar';
      bar.className = 'msg-search-bar';
      bar.innerHTML = `<input type="text" placeholder="Поиск в чате..." id="msg-search-input" />
        <button type="button" id="msg-search-go">🔍</button>
        <button type="button" id="msg-search-close">✕</button>`;
      document.getElementById('cw-messages').before(bar);
      document.getElementById('msg-search-close').onclick = () => bar.remove();
      document.getElementById('msg-search-go').onclick = () => runMsgSearch(chatId);
      document.getElementById('msg-search-input').onkeydown = (ev) => { if (ev.key === 'Enter') runMsgSearch(chatId); };
      document.getElementById('msg-search-input').focus();
    };
  }

  input.oninput = () => {
    if (!typingActive) { wsSend('typing:start', { chatId }); typingActive = true; }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { wsSend('typing:stop', { chatId }); typingActive = false; }, 2500);
  };

  input.focus();
}

async function runMsgSearch(chatId) {
  const q = document.getElementById('msg-search-input')?.value.trim();
  if (!q) return;
  const res = await api('GET', `/api/chats/${chatId}/messages?q=${encodeURIComponent(q)}&limit=50`);
  const msgs = (res?.data || []).reverse();
  const container = document.getElementById('cw-messages');
  container.innerHTML = `<div class="search-results-header">Результаты поиска: «${escHtml(q)}» (${msgs.length})</div>`;
  for (const m of msgs) await appendMessage(m);
}

/* ════════════════════════════════════════════════════════════════════
   Message rendering
   ════════════════════════════════════════════════════════════════════ */
async function appendMessage(msg) {
  const container = document.getElementById('cw-messages');
  if (!container) return;

  if (container.querySelector(`[data-msg-id="${msg.id}"]`)) return;

  const isMine = msg.sender?.id === state.me.id;
  const isEncrypted = !!(msg.ciphertext && msg.signalType > 0);
  let text;

  if (msg.isDeleted) {
    text = '[удалено]';
  } else if (isEncrypted) {
    const cached = getPlaintext(msg.id);
    if (cached) {
      text = cached;
    } else if (msg._decryptedText) {
      text = msg._decryptedText;
      savePlaintext(msg.id, msg._decryptedText);
    } else if (!isMine && isE2EAvailable() && msg.sender?.id) {
      const decrypted = await decryptMessage(msg.sender.id, msg.ciphertext, msg.signalType);
      text = decrypted || '🔒 Не удалось расшифровать';
      if (decrypted) savePlaintext(msg.id, decrypted);
    } else if (isMine) {
      text = '🔒 Зашифрованное сообщение';
    } else {
      text = '🔒 Зашифрованное сообщение';
    }
  } else {
    text = msg.text || '[медиа]';
  }

  const time = new Date(msg.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  const hasRead = msg.readReceipts?.some(r => r.userId !== state.me.id);

  const group = document.createElement('div');
  group.className = `msg-group ${isMine ? 'mine' : 'theirs'}`;
  group.dataset.msgId = msg.id;

  if (!isMine) {
    const sn = document.createElement('div');
    sn.className = 'msg-sender-name';
    sn.textContent = msg.sender?.nickname || '';
    group.appendChild(sn);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';

  if (isEncrypted) {
    const lock = document.createElement('span');
    lock.className = 'msg-lock';
    lock.title = 'E2E зашифровано';
    lock.textContent = '🔒';
    meta.appendChild(lock);
  }

  const timeEl = document.createElement('span');
  timeEl.className = 'msg-time';
  timeEl.textContent = time;
  meta.appendChild(timeEl);

  if (isMine) {
    const check = document.createElement('span');
    if (hasRead) {
      check.className = 'msg-check read';
      check.innerHTML = '✓✓';
      check.title = 'Прочитано';
    } else {
      check.className = 'msg-check sent';
      check.innerHTML = '✓';
      check.title = 'Отправлено';
    }
    meta.appendChild(check);
  }

  // Reply preview
  if (msg.replyTo && !msg.replyTo.isDeleted) {
    const replyEl = document.createElement('div');
    replyEl.className = 'msg-reply-preview';
    const replyText = msg.replyTo.text || (msg.replyTo.ciphertext ? '🔒 Зашифрованное' : '[медиа]');
    replyEl.innerHTML = `<span class="reply-nick">${escHtml(msg.replyTo.sender?.nickname || '')}</span> ${escHtml(replyText)}`;
    bubble.insertBefore(replyEl, bubble.firstChild);
  }

  // Media
  if (msg.mediaUrl && !msg.isDeleted) {
    const mediaEl = buildMediaElement(msg);
    if (mediaEl) bubble.appendChild(mediaEl);
  }

  // Reactions bar
  const reactBar = buildReactBar(msg);
  group.appendChild(bubble);
  group.appendChild(reactBar);
  group.appendChild(meta);

  // Context menu on right-click / long-press
  group.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showMsgContextMenu(e, msg, isMine, group);
  });

  container.appendChild(group);
}

function buildMediaElement(msg) {
  const url = msg.mediaUrl;
  if (!url) return null;
  const type = msg.type;
  if (type === 'IMAGE') {
    const img = document.createElement('img');
    img.src = url; img.className = 'msg-media-img';
    img.onclick = () => window.open(url, '_blank');
    return img;
  }
  if (type === 'VIDEO') {
    const vid = document.createElement('video');
    vid.src = url; vid.controls = true; vid.className = 'msg-media-video';
    return vid;
  }
  if (type === 'AUDIO') {
    const aud = document.createElement('audio');
    aud.src = url; aud.controls = true; aud.className = 'msg-media-audio';
    return aud;
  }
  // Generic file
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.className = 'msg-media-file';
  a.textContent = '📎 ' + (url.split('/').pop() || 'Файл');
  return a;
}

function buildReactBar(msg) {
  const bar = document.createElement('div');
  bar.className = 'msg-react-bar';
  bar.dataset.msgId = msg.id;
  renderReactions(bar, msg.reactions || [], msg.id);
  return bar;
}

function renderReactions(bar, reactions, msgId) {
  // Group by emoji
  const counts = {};
  const myReacts = new Set();
  for (const r of reactions) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (r.userId === state.me.id) myReacts.add(r.emoji);
  }
  bar.innerHTML = '';
  for (const [emoji, cnt] of Object.entries(counts)) {
    const btn = document.createElement('button');
    btn.className = 'react-chip' + (myReacts.has(emoji) ? ' active' : '');
    btn.textContent = `${emoji} ${cnt}`;
    btn.title = myReacts.has(emoji) ? 'Убрать реакцию' : 'Добавить реакцию';
    btn.onclick = () => toggleReaction(msgId, emoji, myReacts.has(emoji));
    bar.appendChild(btn);
  }
  // "+" кнопка
  const addBtn = document.createElement('button');
  addBtn.className = 'react-add-btn';
  addBtn.textContent = '+';
  addBtn.title = 'Добавить реакцию';
  addBtn.onclick = (e) => { e.stopPropagation(); showEmojiPicker(e, msgId); };
  bar.appendChild(addBtn);
}

const EMOJI_LIST = ['👍','❤️','😂','😮','😢','🔥'];

function showEmojiPicker(e, msgId) {
  document.querySelector('.emoji-picker-popup')?.remove();
  const picker = document.createElement('div');
  picker.className = 'emoji-picker-popup';
  EMOJI_LIST.forEach(em => {
    const btn = document.createElement('button');
    btn.textContent = em;
    btn.onclick = () => { toggleReaction(msgId, em, false); picker.remove(); };
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);
  const rect = e.target.getBoundingClientRect();
  picker.style.left = rect.left + 'px';
  picker.style.top = (rect.top - picker.offsetHeight - 4) + 'px';
  setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 0);
}

async function toggleReaction(msgId, emoji, remove) {
  if (remove) {
    await api('DELETE', `/api/messages/${msgId}/reactions/${encodeURIComponent(emoji)}`);
  } else {
    await api('POST', `/api/messages/${msgId}/reactions`, { emoji });
  }
}

function showMsgContextMenu(e, msg, isMine, groupEl) {
  document.querySelector('.msg-ctx-menu')?.remove();
  const menu = document.createElement('div');
  menu.className = 'msg-ctx-menu';

  const addOpt = (label, fn) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => { fn(); menu.remove(); };
    menu.appendChild(btn);
  };

  addOpt('↩ Ответить', () => setReplyTo(msg));
  if (isMine && !msg.isDeleted) {
    addOpt('✏️ Редактировать', () => startEditMessage(msg));
    addOpt('🗑 Удалить', () => deleteMsg(msg.id));
  }
  addOpt('📋 Копировать', () => {
    const txt = groupEl.querySelector('.msg-bubble')?.textContent || '';
    navigator.clipboard.writeText(txt).catch(() => {});
  });

  document.body.appendChild(menu);
  menu.style.left = Math.min(e.clientX, window.innerWidth - 160) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 4) + 'px';
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function scrollToBottom() {
  const c = document.getElementById('cw-messages');
  if (c) requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; });
}

/* ════════════════════════════════════════════════════════════════════
   User search
   ════════════════════════════════════════════════════════════════════ */
let searchTimer = null;

document.getElementById('user-search').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  const box = document.getElementById('search-results');
  if (q.length < 2) { box.classList.add('hidden'); return; }

  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const res = await api('GET', `/api/users/search?q=${encodeURIComponent(q)}`);
    const users = (res?.data || []).filter(u => u.id !== state.me.id);

    if (!users.length) {
      box.innerHTML = '<div class="search-empty">Не найдено</div>';
    } else {
      box.innerHTML = users.map(u => {
        const online = state.onlineUsers.has(u.id);
        return `
          <div class="search-user-item" onclick="startChat('${u.id}')">
            <div class="chat-item-avatar av-${charColor(u.nickname[0])}" style="width:32px;height:32px;font-size:13px">
              ${u.nickname[0].toUpperCase()}
            </div>
            <span style="font-size:14px;flex:1">${escHtml(u.nickname)}</span>
            ${online ? '<span class="online-label">онлайн</span>' : ''}
          </div>`;
      }).join('');
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
  if (!state.chats.find(c => c.id === chat.id)) {
    state.chats.unshift({ ...chat, lastMsg: '', lastMsgTime: chat.updatedAt, lastSenderNick: '', _typing: false });
  }
  sortChats();
  renderChatList();
  openChat(chat.id);
}

/* ════════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════════ */
function getChatName(chat) {
  if (chat.type === 'GROUP') return chat.name || 'Группа';
  const p = chat.members?.find(m => (m.user?.id || m.userId) !== state.me.id);
  return p?.user?.nickname || p?.nickname || 'Чат';
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

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate())
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000)
    return d.toLocaleDateString('ru', { weekday: 'short' });
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function escHtml(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function charColor(ch = '') { return (ch.toUpperCase().charCodeAt(0) || 0) % 6; }

/* ════════════════════════════════════════════════════════════════════
   Auth UI
   ════════════════════════════════════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
  });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Входим...';
  try {
    await login(
      document.getElementById('login-email').value.trim(),
      document.getElementById('login-password').value,
    );
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false; btn.textContent = 'Войти';
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  const btn = document.getElementById('reg-btn');
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Создаём...';
  try {
    await register(
      document.getElementById('reg-nickname').value.trim(),
      document.getElementById('reg-email').value.trim(),
      document.getElementById('reg-password').value,
    );
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false; btn.textContent = 'Создать аккаунт';
  }
});

document.getElementById('logout-btn').addEventListener('click', logout);

/* ─── Init ────────────────────────────────────────────────────────── */
(async () => {
  if (state.accessToken && state.me) {
    try { await bootApp(); }
    catch { logout(); }
  } else {
    showScreen('auth');
  }
})();
