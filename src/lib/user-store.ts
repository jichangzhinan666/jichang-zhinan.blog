/**
 * 个人中心（游客模式）的浏览器本地数据：收藏、阅读记录、偏好。
 * 只使用 localStorage，不上传、不写入任何静态文件；读写全部 try/catch，隐私窗口或禁用存储时静默降级。
 */
export interface SavedItem {
  url: string;
  title: string;
  /** 展示用类型，如“品牌测评”“套餐对比”“使用教程” */
  type: string;
  ts: number;
}

export type ThemePref = 'light' | 'dark' | 'system';
export type FontPref = 'normal' | 'large';

export interface Prefs {
  theme?: ThemePref;
  font?: FontPref;
}

export const STORE_KEYS = {
  favorites: 'jz-favorites',
  history: 'jz-history',
  prefs: 'jz-prefs',
  theme: 'jz-theme',
} as const;

const HISTORY_LIMIT = 30;
const FAVORITES_LIMIT = 200;
export const STORE_EVENT = 'jz:store-change';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as T;
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    emit();
    return true;
  } catch {
    return false;
  }
}

function emit(): void {
  try {
    window.dispatchEvent(new CustomEvent(STORE_EVENT));
  } catch {
    /* 忽略 */
  }
}

function isItem(x: unknown): x is SavedItem {
  return !!x && typeof x === 'object' && typeof (x as SavedItem).url === 'string' && typeof (x as SavedItem).title === 'string';
}

function readList(key: string): SavedItem[] {
  const list = read<unknown>(key, []);
  return Array.isArray(list) ? list.filter(isItem) : [];
}

/* ---------------- 收藏 ---------------- */

export function getFavorites(): SavedItem[] {
  return readList(STORE_KEYS.favorites);
}

export function isFavorite(url: string): boolean {
  return getFavorites().some((f) => f.url === url);
}

/** 切换收藏状态；返回切换后是否已收藏 */
export function toggleFavorite(item: Omit<SavedItem, 'ts'>): boolean {
  const list = getFavorites();
  const index = list.findIndex((f) => f.url === item.url);
  if (index >= 0) {
    list.splice(index, 1);
    write(STORE_KEYS.favorites, list);
    return false;
  }
  list.unshift({ ...item, ts: Date.now() });
  write(STORE_KEYS.favorites, list.slice(0, FAVORITES_LIMIT));
  return true;
}

export function removeFavorite(url: string): void {
  write(
    STORE_KEYS.favorites,
    getFavorites().filter((f) => f.url !== url),
  );
}

/* ---------------- 阅读记录 ---------------- */

export function getHistory(): SavedItem[] {
  return readList(STORE_KEYS.history);
}

export function pushHistory(item: Omit<SavedItem, 'ts'>): void {
  const list = getHistory().filter((h) => h.url !== item.url);
  list.unshift({ ...item, ts: Date.now() });
  write(STORE_KEYS.history, list.slice(0, HISTORY_LIMIT));
}

export function clearHistory(): void {
  write(STORE_KEYS.history, []);
}

/* ---------------- 偏好 ---------------- */

export function getPrefs(): Prefs {
  const p = read<Prefs>(STORE_KEYS.prefs, {});
  return p && typeof p === 'object' ? p : {};
}

export function setPrefs(patch: Prefs): Prefs {
  const next = { ...getPrefs(), ...patch };
  write(STORE_KEYS.prefs, next);
  return next;
}

/** 当前主题偏好：显式保存过浅色/深色，否则视为跟随系统 */
export function currentTheme(): ThemePref {
  try {
    const s = localStorage.getItem(STORE_KEYS.theme);
    return s === 'dark' || s === 'light' ? s : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: ThemePref): void {
  const root = document.documentElement;
  if (theme === 'system') {
    try {
      localStorage.removeItem(STORE_KEYS.theme);
    } catch {
      /* 忽略 */
    }
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    try {
      localStorage.setItem(STORE_KEYS.theme, theme);
    } catch {
      /* 忽略 */
    }
    root.setAttribute('data-theme', theme);
  }
  emit();
}

export function applyFont(font: FontPref): void {
  if (font === 'large') document.documentElement.setAttribute('data-font', 'large');
  else document.documentElement.removeAttribute('data-font');
}

/* ---------------- 其他 ---------------- */

export function clearAll(): void {
  try {
    Object.values(STORE_KEYS).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* 忽略 */
  }
  emit();
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (!Number.isFinite(min) || min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
