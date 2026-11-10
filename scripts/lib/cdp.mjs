/**
 * 极简 Chrome DevTools Protocol 客户端（零依赖，Node ≥ 22）。
 * 用本机已安装的 Chrome / Edge 以无头模式渲染 dist，供 ui-audit / ui-interactions 脚本使用。
 * 只连接 127.0.0.1 上由本脚本启动的浏览器与静态服务，不访问外网。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export function findBrowser() {
  return CANDIDATES.find((p) => fs.existsSync(p)) ?? null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** 以接近 Cloudflare Pages 的规则托管 dist：目录取 index.html，找不到时返回 404.html（状态码 404）。 */
export function serveDist(distDir) {
  const root = path.resolve(distDir);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(root, `.${rel}`);
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const stat = await fsp.stat(file).catch(() => null);
      if (stat?.isDirectory()) {
        res.writeHead(308, { Location: `${url.pathname}/${url.search}` });
        res.end();
        return;
      }
      if (!stat) {
        const body = await fsp.readFile(path.join(root, '404.html')).catch(() => Buffer.from('404'));
        res.writeHead(404, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        res.end(body);
        return;
      }
      const body = await fsp.readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

export class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else {
        for (const l of this.listeners) l(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify(payload));
    });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

const KEY_CODES = { Escape: 27, Enter: 13, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35, ' ': 32 };

export class Page {
  static async create(cdp, desktopUA) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(cdp, targetId, sessionId, desktopUA);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Log.enable');
    await page.send('Network.enable');
    return page;
  }

  constructor(cdp, targetId, sessionId, desktopUA) {
    this.cdp = cdp;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.desktopUA = desktopUA;
    this.waiters = [];
    this.consoleErrors = [];
    this.failedRequests = [];
    this.lastStatus = null;
    cdp.on((msg) => {
      if (msg.sessionId === sessionId && msg.method) this.onEvent(msg.method, msg.params);
    });
  }

  onEvent(method, params) {
    if (method === 'Runtime.exceptionThrown') {
      const d = params.exceptionDetails;
      this.consoleErrors.push(d?.exception?.description ?? d?.text ?? 'exception');
    } else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
      this.consoleErrors.push(`${params.entry.text} ${params.entry.url ?? ''}`.trim());
    } else if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      this.consoleErrors.push(params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (method === 'Network.responseReceived') {
      if (params.type === 'Document') this.lastStatus = params.response.status;
      if (params.response.status >= 400) this.failedRequests.push(`${params.response.status} ${params.response.url}`);
    }
    for (const w of [...this.waiters]) {
      if (w.method === method && (!w.pred || w.pred(params))) {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        clearTimeout(w.timer);
        w.resolve(params);
      }
    }
  }

  send(method, params = {}) {
    return this.cdp.send(method, params, this.sessionId);
  }

  waitFor(method, timeout = 20000, pred) {
    return new Promise((resolve, reject) => {
      const w = { method, pred, resolve };
      w.timer = setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error(`等待 ${method} 超时`));
      }, timeout);
      this.waiters.push(w);
    });
  }

  async goto(url, { settle = 120 } = {}) {
    this.consoleErrors = [];
    this.failedRequests = [];
    this.lastStatus = null;
    const loaded = this.waitFor('Page.loadEventFired');
    await this.send('Page.navigate', { url });
    await loaded;
    await this.eval('document.fonts ? document.fonts.ready.then(() => true) : true');
    await sleep(settle);
  }

  /** 等待由点击 / 表单提交触发的跳转完成 */
  async waitForNavigation(action) {
    const loaded = this.waitFor('Page.loadEventFired');
    await action();
    await loaded;
    await sleep(150);
  }

  async eval(expression, { awaitPromise = true } = {}) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }

  async setViewport({ width, height, mobile = false, dpr = 1 }) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile,
      screenWidth: width,
      screenHeight: height,
    });
    await this.send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await this.send('Emulation.setUserAgentOverride', { userAgent: mobile ? MOBILE_UA : this.desktopUA });
  }

  async setMedia({ scheme = 'light', reducedMotion = 'no-preference' } = {}) {
    await this.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [
        { name: 'prefers-color-scheme', value: scheme },
        { name: 'prefers-reduced-motion', value: reducedMotion },
      ],
    });
  }

  /** 取元素中心并确认它没有被其他元素遮挡；返回点击坐标 */
  async locate(selector, nth = 0) {
    const box = await this.eval(`(() => {
      const el = document.querySelectorAll(${JSON.stringify(selector)})[${nth}];
      if (!el) return null;
      document.documentElement.style.scrollBehavior = 'auto';
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      const lab = el.closest('label');
      const ok = !!hit && (el === hit || el.contains(hit) || hit.contains(el) || (lab && (lab === hit || lab.contains(hit))));
      return { x, y, w: r.width, h: r.height, ok, hit: hit ? hit.tagName.toLowerCase() + '.' + String(hit.className && hit.className.baseVal !== undefined ? hit.className.baseVal : hit.className).slice(0, 40) : null };
    })()`);
    if (!box) throw new Error(`找不到元素 ${selector}[${nth}]`);
    if (box.w < 1 || box.h < 1) throw new Error(`元素不可见 ${selector}[${nth}]`);
    if (!box.ok) throw new Error(`元素被遮挡 ${selector}[${nth}]，命中 ${box.hit}`);
    return box;
  }

  async hover(selector, nth = 0) {
    const box = await this.locate(selector, nth);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await sleep(80);
    return box;
  }

  /** 真实鼠标点击（按下 + 抬起），被遮挡时抛错 */
  async click(selector, nth = 0) {
    const box = await this.locate(selector, nth);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await sleep(80);
    return box;
  }

  async clickAt(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(80);
  }

  async press(key) {
    const code = KEY_CODES[key];
    const base = { key, code: key === ' ' ? 'Space' : key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(key === 'Enter' ? { text: '\r' } : key === ' ' ? { text: ' ' } : {}) });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    await sleep(80);
  }

  async type(text) {
    await this.send('Input.insertText', { text });
    await sleep(80);
  }

  async screenshot(file, { clip, quality = 72 } = {}) {
    const params = { format: 'jpeg', quality, captureBeyondViewport: !!clip };
    if (clip) params.clip = { scale: 1, ...clip };
    const { data } = await this.send('Page.captureScreenshot', params);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, Buffer.from(data, 'base64'));
  }

  /** 把整页按固定高度切成若干张图，便于逐段查看 */
  async tiles(prefix, { tileHeight = 1500, maxTiles = 10, quality = 70 } = {}) {
    // 懒加载图片在整页截图里不会自己触发加载：先全部改为立即加载并等待解码，否则截图里是空白块
    await this.eval(`(async () => {
      const imgs = [...document.querySelectorAll('img[loading="lazy"]')];
      for (const img of imgs) img.loading = 'eager';
      await Promise.race([
        Promise.all(imgs.map((img) => (img.complete && img.naturalWidth > 0 ? null : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); })))),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
      await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
      window.scrollTo(0, 0);
    })()`);
    const m = await this.eval(
      '({ w: document.documentElement.clientWidth, h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) })',
    );
    const files = [];
    for (let i = 0, y = 0; y < m.h && i < maxTiles; i++, y += tileHeight) {
      const file = `${prefix}-${String(i + 1).padStart(2, '0')}.jpg`;
      await this.screenshot(file, { clip: { x: 0, y, width: m.w, height: Math.min(tileHeight, m.h - y) }, quality });
      files.push(file);
    }
    return files;
  }
}

export async function launchBrowser() {
  const exe = findBrowser();
  if (!exe) throw new Error('未找到 Chrome / Edge。可用环境变量 CHROME_PATH 指定浏览器路径。');
  const userDataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'jz-ui-audit-'));
  const args = [
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-port=0',
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    '--mute-audio',
    '--force-color-profile=srgb',
    'about:blank',
  ];
  const proc = spawn(exe, args, { stdio: 'ignore' });
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  let wsUrl = null;
  for (let i = 0; i < 150 && !wsUrl; i++) {
    await sleep(100);
    const txt = await fsp.readFile(portFile, 'utf8').catch(() => '');
    const [port, wsPath] = txt.trim().split(/\r?\n/);
    if (port && wsPath) wsUrl = `ws://127.0.0.1:${port.trim()}${wsPath.trim()}`;
  }
  if (!wsUrl) {
    proc.kill();
    throw new Error('浏览器启动超时');
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('无法连接浏览器 DevTools 端口')), { once: true });
  });
  const cdp = new CDP(ws);
  const version = await cdp.send('Browser.getVersion');
  const desktopUA = version.userAgent.replace('HeadlessChrome', 'Chrome');
  const close = async () => {
    try {
      await cdp.send('Browser.close');
    } catch {
      /* 已关闭 */
    }
    await sleep(400);
    try {
      proc.kill();
    } catch {
      /* 已退出 */
    }
    await fsp.rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  };
  return { cdp, close, exe, desktopUA, product: version.product };
}

/** 列出 dist 中全部页面的 URL 路径（目录式 URL），另加一个不存在的地址用于检查 404 页 */
export async function listPages(distDir) {
  const pages = [];
  const walk = async (dir) => {
    for (const ent of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(full);
      else if (ent.name === 'index.html') {
        const rel = path.relative(distDir, dir).split(path.sep).filter(Boolean).join('/');
        pages.push(rel ? `/${rel}/` : '/');
      }
    }
  };
  await walk(distDir);
  pages.sort();
  pages.push('/__not-found__/');
  return pages;
}
