(() => {
  'use strict';

  const EXPECTED_USER = 'njordadev';
  const EXPECTED_HASH_HEX = 'c3fa8f68c6660dff692dace7f41eb7543f56b0776bbe9b567b5ca42977d046d8';
  const SALT_PREFIX = 'ld-studio-salt-v1:';
  const DEFAULT_SERVER_URL = 'https://studio.lumendelve.com';
  const LOCAL_SERVER_URL = 'http://127.0.0.1:4321';
  const SERVER_PRESETS = [
    { label: 'Remote (studio.lumendelve.com)', url: DEFAULT_SERVER_URL },
    { label: 'Local (127.0.0.1:4321)', url: LOCAL_SERVER_URL },
  ];

  const STORAGE_AUTH_KEY = 'ld_studio_auth_ok';
  const STORAGE_SERVER_KEY = 'ld_studio_server_url';
  const STORAGE_TOKEN_KEY = 'ld_studio_token';

  const REWRITE_PREFIXES = [
    '/api/',
    '/models/',
    '/models_totk/',
    '/weapons_totk/',
    '/armor_totk/',
    '/sprites/',
    '/animations/',
    '/audio/',
    '/ui/',
    '/art-reference/',
  ];

  function normalizeServerUrl(value) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const base = trimmed || DEFAULT_SERVER_URL;
    return base.replace(/\/+$/, '');
  }

  function getServerUrl() {
    try {
      return normalizeServerUrl(localStorage.getItem(STORAGE_SERVER_KEY));
    } catch {
      return DEFAULT_SERVER_URL;
    }
  }

  function getStoredToken() {
    try {
      return localStorage.getItem(STORAGE_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  }

  function isAuthenticated() {
    try {
      return localStorage.getItem(STORAGE_AUTH_KEY) === '1';
    } catch {
      return false;
    }
  }

  function shouldRewritePath(pathname) {
    return REWRITE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  }

  function formatHost(url) {
    try {
      const parsed = new URL(url);
      return parsed.host || url;
    } catch {
      return url.replace(/^https?:\/\//i, '');
    }
  }

  // Wrap window.fetch immediately on load before app.js initializes
  const originalFetch = window.fetch.bind(window);

  window.fetch = function wrappedStudioFetch(input, init) {
    const serverUrl = getServerUrl();
    const token = getStoredToken();

    if (typeof input === 'string') {
      if (shouldRewritePath(input)) {
        const nextInit = init ? { ...init } : {};
        const headers = new Headers(nextInit.headers || undefined);
        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        nextInit.headers = headers;
        return originalFetch(`${serverUrl}${input}`, nextInit);
      }
      return originalFetch(input, init);
    }

    if (input instanceof Request) {
      const originPrefix = `${window.location.origin}/`;
      if (input.url.startsWith(originPrefix)) {
        const relPath = input.url.slice(window.location.origin.length);
        if (shouldRewritePath(relPath)) {
          const headers = new Headers(init?.headers || input.headers);
          if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          const rewrittenRequest = new Request(`${serverUrl}${relPath}`, {
            method: init?.method || input.method,
            headers,
            body: init?.body !== undefined ? init.body : input.body,
            mode: init?.mode || (input.mode === 'navigate' ? 'cors' : input.mode),
            credentials: init?.credentials || input.credentials,
            cache: init?.cache || input.cache,
            redirect: init?.redirect || input.redirect,
            referrer: init?.referrer || input.referrer,
            integrity: init?.integrity || input.integrity,
            keepalive: init?.keepalive !== undefined ? init.keepalive : input.keepalive,
            signal: init?.signal || input.signal,
          });
          return originalFetch(rewrittenRequest);
        }
      }
      return originalFetch(input, init);
    }

    if (input instanceof URL) {
      const originPrefix = `${window.location.origin}/`;
      const href = input.toString();
      if (href.startsWith(originPrefix)) {
        const relPath = href.slice(window.location.origin.length);
        if (shouldRewritePath(relPath)) {
          const nextInit = init ? { ...init } : {};
          const headers = new Headers(nextInit.headers || undefined);
          if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          nextInit.headers = headers;
          return originalFetch(`${serverUrl}${relPath}`, nextInit);
        }
      }
    }

    return originalFetch(input, init);
  };

  async function sha256Hex(value) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API is unavailable in this browser context.');
    }
    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  async function verifyCredentialsLocally(username, password) {
    if (!constantTimeEqual(username.trim(), EXPECTED_USER)) {
      return false;
    }
    const computedHex = await sha256Hex(`${SALT_PREFIX}${password}`);
    return constantTimeEqual(computedHex, EXPECTED_HASH_HEX);
  }

  async function loginToStudioServer(serverUrl, username, password) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);
    try {
      const res = await originalFetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      if (!res.ok) {
        return { connected: false, token: '' };
      }
      const data = await res.json().catch(() => null);
      if (data && data.ok && typeof data.token === 'string' && data.token) {
        return { connected: true, token: data.token };
      }
      return { connected: false, token: '' };
    } catch {
      return { connected: false, token: '' };
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function probeServerConnection(serverUrl) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);
    const token = getStoredToken();
    try {
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await originalFetch(`${serverUrl}/api/auth/verify`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function injectStyles() {
    if (document.getElementById('ld-bridge-styles')) return;
    const style = document.createElement('style');
    style.id = 'ld-bridge-styles';
    style.textContent = `
      #ld-auth-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(circle at 50% 25%, rgba(245, 158, 11, 0.14) 0%, rgba(14, 11, 10, 0.96) 55%),
          #0e0b0a;
        backdrop-filter: blur(10px);
        color: #f7f0dc;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .ld-auth-card {
        width: 100%;
        max-width: 440px;
        background: linear-gradient(180deg, #1b1512 0%, #14100e 100%);
        border: 1px solid #4d3b2f;
        border-radius: 16px;
        padding: 28px 26px 24px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75), 0 0 36px rgba(245, 158, 11, 0.12);
      }
      .ld-auth-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }
      .ld-auth-back {
        color: #d7ccb4;
        text-decoration: none;
        font-size: 12px;
        font-weight: 600;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid #362a23;
        background: rgba(36, 28, 24, 0.8);
        transition: border-color 0.15s, color 0.15s;
      }
      .ld-auth-back:hover {
        color: #fde68a;
        border-color: #f59e0b;
      }
      .ld-auth-badge {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #fbbf24;
        padding: 4px 9px;
        border-radius: 999px;
        border: 1px solid rgba(245, 158, 11, 0.35);
        background: rgba(245, 158, 11, 0.12);
      }
      .ld-auth-title {
        margin: 0 0 6px;
        font-family: 'Cinzel', 'Palatino Linotype', Georgia, serif;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: #fde68a;
      }
      .ld-auth-subtitle {
        margin: 0 0 20px;
        font-size: 13px;
        line-height: 1.45;
        color: #9e8e75;
      }
      .ld-auth-field {
        margin-bottom: 14px;
      }
      .ld-auth-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      .ld-auth-label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: #d7ccb4;
        margin-bottom: 6px;
      }
      .ld-auth-label-row .ld-auth-label {
        margin-bottom: 0;
      }
      .ld-auth-input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid #362a23;
        background: #0e0b0a;
        color: #f7f0dc;
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .ld-auth-input:focus {
        border-color: #f59e0b;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.16);
      }
      .ld-auth-input-mono {
        font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }
      .ld-auth-quickfill {
        border: 1px solid #362a23;
        background: #241c18;
        color: #fbbf24;
        border-radius: 6px;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .ld-auth-quickfill:hover {
        border-color: #f59e0b;
        background: rgba(245, 158, 11, 0.15);
      }
      .ld-auth-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .ld-auth-error {
        min-height: 18px;
        margin: 4px 0 12px;
        font-size: 12px;
        color: #fb7185;
      }
      .ld-auth-submit {
        width: 100%;
        padding: 11px 16px;
        border: none;
        border-radius: 10px;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: #1a1207;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.02em;
        cursor: pointer;
        box-shadow: 0 8px 20px rgba(245, 158, 11, 0.25);
        transition: filter 0.15s, transform 0.1s;
      }
      .ld-auth-submit:hover:not(:disabled) {
        filter: brightness(1.06);
      }
      .ld-auth-submit:disabled {
        opacity: 0.65;
        cursor: wait;
      }
      #ld-bridge-bar {
        position: fixed;
        top: 54px;
        right: 12px;
        z-index: 99990;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(20, 16, 14, 0.92);
        border: 1px solid #4d3b2f;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        color: #f7f0dc;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
      }
      .ld-bridge-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid transparent;
        background: transparent;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }
      .ld-bridge-status.is-connected {
        color: #34d399;
        background: rgba(16, 185, 129, 0.12);
        border-color: rgba(16, 185, 129, 0.35);
      }
      .ld-bridge-status.is-offline {
        color: #fbbf24;
        background: rgba(245, 158, 11, 0.14);
        border-color: rgba(245, 158, 11, 0.4);
      }
      .ld-bridge-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
      }
      .ld-bridge-host {
        color: #9e8e75;
        font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        max-width: 190px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ld-bridge-btn {
        border: 1px solid #362a23;
        background: #241c18;
        color: #d7ccb4;
        border-radius: 999px;
        padding: 3px 9px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .ld-bridge-btn:hover {
        border-color: #f59e0b;
        color: #fde68a;
      }
      #ld-bridge-settings-modal {
        position: fixed;
        inset: 0;
        z-index: 99998;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(6, 4, 3, 0.78);
        backdrop-filter: blur(6px);
      }
      #ld-bridge-settings-modal.hidden {
        display: none;
      }
      .ld-settings-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  function logout() {
    try {
      localStorage.removeItem(STORAGE_AUTH_KEY);
      localStorage.removeItem(STORAGE_TOKEN_KEY);
    } catch {
      // ignore
    }
    window.location.reload();
  }

  function renderPresetButtonsHtml() {
    return SERVER_PRESETS.map(
      (preset) =>
        `<button type="button" class="ld-auth-quickfill" data-server-url="${preset.url}">${preset.label}</button>`
    ).join('');
  }

  function bindPresetButtons(container, input) {
    container.querySelectorAll('.ld-auth-quickfill[data-server-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        input.value = btn.getAttribute('data-server-url') || DEFAULT_SERVER_URL;
        input.focus();
      });
    });
  }

  function ensureSettingsModal(onSave) {
    let modal = document.getElementById('ld-bridge-settings-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'ld-bridge-settings-modal';
    modal.className = 'hidden';
    modal.innerHTML = `
      <div class="ld-auth-card" role="dialog" aria-modal="true" aria-labelledby="ld-settings-title">
        <div class="ld-auth-top">
          <a class="ld-auth-back" href="/">&#8592; lumendelve.com</a>
          <span class="ld-auth-badge">Bridge Settings</span>
        </div>
        <h2 id="ld-settings-title" class="ld-auth-title" style="font-size:20px;">LD Studio Server</h2>
        <p class="ld-auth-subtitle">Configure the LD Studio backend URL used to load 3D assets, audio, and LiveOps APIs.</p>
        <form id="ld-settings-form">
          <div class="ld-auth-field">
            <label class="ld-auth-label" for="ld-settings-server">LD Studio Server URL</label>
            <input id="ld-settings-server" class="ld-auth-input ld-auth-input-mono" type="url" required />
            <div class="ld-auth-presets">${renderPresetButtonsHtml()}</div>
          </div>
          <div class="ld-settings-actions">
            <button type="button" class="ld-bridge-btn" id="ld-settings-cancel" style="padding:8px 14px;">Cancel</button>
            <button type="submit" class="ld-auth-submit" style="width:auto;padding:8px 16px;font-size:12px;">Save &amp; Reload</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#ld-settings-server');
    const cancelBtn = modal.querySelector('#ld-settings-cancel');
    const form = modal.querySelector('#ld-settings-form');

    bindPresetButtons(modal, input);

    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.classList.add('hidden');
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const nextUrl = normalizeServerUrl(input.value);
      try {
        localStorage.setItem(STORAGE_SERVER_KEY, nextUrl);
      } catch {
        // ignore
      }
      modal.classList.add('hidden');
      onSave(nextUrl);
    });

    return modal;
  }

  function renderBridgeBar(initialConnected) {
    let bar = document.getElementById('ld-bridge-bar');
    if (bar) bar.remove();

    const serverUrl = getServerUrl();
    bar = document.createElement('div');
    bar.id = 'ld-bridge-bar';

    const statusBtn = document.createElement('button');
    statusBtn.type = 'button';
    statusBtn.className = `ld-bridge-status ${initialConnected ? 'is-connected' : 'is-offline'}`;
    statusBtn.innerHTML = `<span class="ld-bridge-dot"></span><span class="ld-bridge-status-text">${initialConnected ? 'Connected' : 'Server Offline — click to configure'}</span>`;

    const hostLabel = document.createElement('span');
    hostLabel.className = 'ld-bridge-host';
    hostLabel.title = serverUrl;
    hostLabel.textContent = `Server: ${formatHost(serverUrl)}`;

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'ld-bridge-btn';
    settingsBtn.textContent = 'Settings';

    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'ld-bridge-btn';
    logoutBtn.textContent = 'Log out';

    bar.append(statusBtn, hostLabel, settingsBtn, logoutBtn);
    document.body.appendChild(bar);

    const openSettings = () => {
      const modal = ensureSettingsModal(() => {
        window.location.reload();
      });
      const input = modal.querySelector('#ld-settings-server');
      if (input) input.value = getServerUrl();
      modal.classList.remove('hidden');
    };

    statusBtn.addEventListener('click', openSettings);
    settingsBtn.addEventListener('click', openSettings);
    logoutBtn.addEventListener('click', logout);

    return {
      setConnected(connected) {
        statusBtn.className = `ld-bridge-status ${connected ? 'is-connected' : 'is-offline'}`;
        const textEl = statusBtn.querySelector('.ld-bridge-status-text');
        if (textEl) {
          textEl.textContent = connected ? 'Connected' : 'Server Offline — click to configure';
        }
      },
    };
  }

  function renderLoginOverlay() {
    const serverUrl = getServerUrl();
    const overlay = document.createElement('div');
    overlay.id = 'ld-auth-overlay';
    overlay.innerHTML = `
      <div class="ld-auth-card" role="dialog" aria-modal="true" aria-labelledby="ld-auth-title">
        <div class="ld-auth-top">
          <a class="ld-auth-back" href="/">&#8592; lumendelve.com</a>
          <span class="ld-auth-badge">Authorized Studio</span>
        </div>
        <h1 id="ld-auth-title" class="ld-auth-title">LD Studio Access</h1>
        <p class="ld-auth-subtitle">Sign in to unlock the Lumendelve 3D Asset &amp; LiveOps workbench and connect to your local or remote LD Studio server.</p>
        <form id="ld-auth-form" novalidate>
          <div class="ld-auth-field">
            <label class="ld-auth-label" for="ld-auth-user">Username</label>
            <input id="ld-auth-user" class="ld-auth-input" type="text" placeholder="Username" autocomplete="username" required />
          </div>
          <div class="ld-auth-field">
            <label class="ld-auth-label" for="ld-auth-pass">Password</label>
            <input id="ld-auth-pass" class="ld-auth-input" type="password" placeholder="Enter password" autocomplete="current-password" required />
          </div>
          <div class="ld-auth-field">
            <label class="ld-auth-label" for="ld-auth-server">LD Studio Server URL</label>
            <input id="ld-auth-server" class="ld-auth-input ld-auth-input-mono" type="url" value="${serverUrl.replace(/"/g, '&quot;')}" required />
            <div class="ld-auth-presets">${renderPresetButtonsHtml()}</div>
          </div>
          <div id="ld-auth-error" class="ld-auth-error" role="alert"></div>
          <button type="submit" id="ld-auth-submit" class="ld-auth-submit">Unlock LD Studio</button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#ld-auth-form');
    const userInput = overlay.querySelector('#ld-auth-user');
    const passInput = overlay.querySelector('#ld-auth-pass');
    const serverInput = overlay.querySelector('#ld-auth-server');
    const errorEl = overlay.querySelector('#ld-auth-error');
    const submitBtn = overlay.querySelector('#ld-auth-submit');

    bindPresetButtons(overlay, serverInput);

    userInput.focus();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorEl.textContent = '';

      const username = userInput.value || '';
      const password = passInput.value || '';
      const targetServer = normalizeServerUrl(serverInput.value);

      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying…';

      try {
        const ok = await verifyCredentialsLocally(username, password);
        if (!ok) {
          errorEl.textContent = 'Invalid username or password.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Unlock LD Studio';
          return;
        }

        submitBtn.textContent = 'Connecting to server…';
        const loginResult = await loginToStudioServer(targetServer, username.trim(), password);

        try {
          localStorage.setItem(STORAGE_SERVER_KEY, targetServer);
          localStorage.setItem(STORAGE_AUTH_KEY, '1');
          if (loginResult.token) {
            localStorage.setItem(STORAGE_TOKEN_KEY, loginResult.token);
          } else {
            localStorage.removeItem(STORAGE_TOKEN_KEY);
          }
        } catch {
          // ignore storage quota issues
        }

        overlay.remove();
        renderBridgeBar(loginResult.connected);
        window.location.reload();
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : 'Unable to verify credentials.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Unlock LD Studio';
      }
    });
  }

  function initBridgeUi() {
    injectStyles();
    if (!isAuthenticated()) {
      renderLoginOverlay();
      return;
    }
    const bar = renderBridgeBar(false);
    probeServerConnection(getServerUrl()).then((connected) => {
      bar.setConnected(connected);
    });
  }

  if (document.body) {
    initBridgeUi();
  } else {
    document.addEventListener('DOMContentLoaded', initBridgeUi, { once: true });
  }
})();
