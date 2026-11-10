#!/usr/bin/env node
/**
 * 全站 UI 审计：用本机 Chrome 在多个视口实际渲染 dist 中的每个页面，检查布局、可点击性、可访问性与性能指标。
 *
 * 用法（需先 npm run build）：
 *   node scripts/ui-audit.mjs                         全部页面 × 全部视口
 *   node scripts/ui-audit.mjs --vp 375,1440           只跑指定宽度（也可写 900、1280 等任意宽度）
 *   node scripts/ui-audit.mjs --pages /,/compare/     只跑指定页面
 *   node scripts/ui-audit.mjs --shots out/dir --shot-vp 375,1440 --shot-pages key   同时保存分段截图
 *   node scripts/ui-audit.mjs --theme dark --vp 1440  深色主题
 *   node scripts/ui-audit.mjs --out report.json       指定报告路径（默认 ui-audit-report.json）
 *
 * 只读检查，不修改任何文件；不访问外网。
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { launchBrowser, serveDist, listPages, Page } from './lib/cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const SITE_HOST = 'jichang-zhinan.blog';

const ALL_VIEWPORTS = [
  { w: 320, h: 640, mobile: true, name: '320 小屏手机' },
  { w: 375, h: 812, mobile: true, name: '375 手机' },
  { w: 390, h: 844, mobile: true, name: '390 手机' },
  { w: 768, h: 1024, mobile: true, name: '768 平板' },
  { w: 1024, h: 768, mobile: false, name: '1024 小型电脑' },
  { w: 1440, h: 900, mobile: false, name: '1440 桌面' },
  { w: 1920, h: 1080, mobile: false, name: '1920 大屏' },
];

/** 截图用的重点页面（每类模板至少一个） */
const KEY_PAGES = [
  '/',
  '/rankings/2026/',
  '/rankings/',
  '/reviews/',
  '/reviews/lingdongyun/',
  '/reviews/twilight/',
  '/compare/',
  '/speed-tests/',
  '/speed-tests/lingdongyun-2026-11-10-japan5/',
  '/tutorials/',
  '/tutorials/clash-verge-rev-jiaocheng/',
  '/guides/',
  '/wiki/',
  '/news/',
  '/search/',
  '/me/',
  '/author/',
  '/contact/',
  '/about/',
  '/__not-found__/',
];

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

/* ------------------------------------------------------------------ */
/* 在页面内执行的审计函数（会被序列化后注入，不能引用外部变量）          */
/* ------------------------------------------------------------------ */
function pageAudit(opts) {
  const out = { issues: [], metrics: {} };
  const docEl = document.documentElement;
  docEl.style.scrollBehavior = 'auto';
  const vw = docEl.clientWidth;
  const vh = window.innerHeight;
  const isMobile = vw < 768;

  const clsName = (el) => (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '');
  const sel = (el) => {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    let cur = el;
    for (let i = 0; cur && cur.nodeType === 1 && i < 4 && cur !== document.body; i++) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(`${s}#${cur.id}`);
        break;
      }
      const cls = clsName(cur)
        .trim()
        .split(/\s+/)
        .filter((c) => c && !c.startsWith('astro-'))
        .slice(0, 2);
      if (cls.length) s += `.${cls.join('.')}`;
      parts.unshift(s);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 36);
  const add = (type, sev, msg, el) => out.issues.push({ type, sev, msg, sel: el ? sel(el) : '', text: el ? txt(el) : '' });
  const styleCache = new WeakMap();
  const styleOf = (el) => {
    let cs = styleCache.get(el);
    if (!cs) {
      cs = getComputedStyle(el);
      styleCache.set(el, cs);
    }
    return cs;
  };
  const visCache = new WeakMap();
  const isVisible = (el) => {
    if (visCache.has(el)) return visCache.get(el);
    let ok = true;
    const r = el.getBoundingClientRect();
    // 小于 2px 的元素（含 .visually-hidden 这类只给读屏器的文字）不算可见；
    // 折叠的 <details> 内容在 Chrome 中仍有布局盒（content-visibility: hidden），需单独排除
    if (r.width < 2 || r.height < 2) ok = false;
    else if (el.closest('details:not([open])') && !el.closest('summary')) ok = false;
    else {
      let op = 1;
      for (let c = el; c && c.nodeType === 1; c = c.parentElement) {
        const cs = styleOf(c);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          ok = false;
          break;
        }
        op *= parseFloat(cs.opacity || '1');
        if (op < 0.05) {
          ok = false;
          break;
        }
      }
    }
    visCache.set(el, ok);
    return ok;
  };
  const ownText = (el) => {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return t.replace(/\s+/g, ' ').trim();
  };
  /** 元素内文字实际占用的行（按行顶聚类），用于判断换行是否自然 */
  const textLines = (el, fs) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .sort((a, b) => a.top - b.top);
    // 按垂直方向是否重叠归并成行：同一行里字号不同的文字（如大标题 + 小号英文名，按基线对齐）
    // 顶边位置不同，但纵向范围重叠，仍算一行
    const lines = [];
    for (const r of rects) {
      const last = lines[lines.length - 1];
      const overlap = last ? Math.min(last.bottom, r.bottom) - Math.max(last.top, r.top) : 0;
      if (last && overlap > Math.min(r.height, last.bottom - last.top) * 0.5) {
        last.width += r.width;
        last.bottom = Math.max(last.bottom, r.bottom);
      } else lines.push({ top: r.top, bottom: r.bottom, width: r.width });
    }
    return lines;
  };
  const clipAncestor = (el, stop) => {
    for (let p = el.parentElement; p && p !== document.body && p !== docEl && p !== stop; p = p.parentElement) {
      if (styleOf(p).overflowX !== 'visible') return p;
    }
    return null;
  };

  const all = Array.from(document.body.querySelectorAll('*')).filter((e) => {
    const tag = e.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'br' || tag === 'option' || tag === 'template' || tag === 'noscript') return false;
    return tag === 'svg' || !e.closest('svg');
  });

  /* ---------- 性能指标（先读，避免后续滚动影响） ---------- */
  out.metrics.cls = +(window.__cls || 0).toFixed(4);
  out.metrics.shifts = (window.__shifts || []).filter((s) => s.v > 0.004).slice(0, 4);
  out.metrics.lcp = Math.round(window.__lcp || 0);
  out.metrics.lcpEl = window.__lcpEl || '';
  out.metrics.domNodes = document.getElementsByTagName('*').length;
  const res = performance.getEntriesByType('resource');
  const nav = performance.getEntriesByType('navigation')[0];
  out.metrics.requests = res.length + 1;
  out.metrics.transferKB = Math.round((res.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0) + (nav ? nav.transferSize || nav.encodedBodySize || 0 : 0)) / 1024);
  out.metrics.docHeight = Math.max(docEl.scrollHeight, document.body.scrollHeight);
  if (out.metrics.cls > 0.1) add('cls', 'P1', `累积布局偏移 CLS=${out.metrics.cls}`, null);
  else if (out.metrics.cls > 0.025) add('cls', 'P2', `累积布局偏移 CLS=${out.metrics.cls}`, null);

  /* ---------- 1. 横向溢出 ---------- */
  const sw = Math.max(docEl.scrollWidth, document.body.scrollWidth);
  out.metrics.overflowX = Math.max(0, sw - vw);
  if (sw > vw + 1) {
    const culprits = all.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > vw + 1 && styleOf(el).position !== 'fixed' && !clipAncestor(el) && isVisible(el);
    });
    const deepest = culprits.filter((el) => !culprits.some((o) => o !== el && el.contains(o)));
    add('h-overflow', 'P0', `页面横向溢出 ${sw - vw}px`, deepest[0] || culprits[0] || null);
    deepest.slice(1, 3).forEach((el) => add('h-overflow', 'P0', `元素超出视口右侧 ${Math.round(el.getBoundingClientRect().right - vw)}px`, el));
  }

  /* ---------- 2. 文字裁切 / 溢出 / 窄列换行 / 标题孤字 ---------- */
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'svg' || !isVisible(el)) continue;
    const t = ownText(el);
    if (!t) continue;
    const cs = styleOf(el);
    if (el.clientWidth > 0) {
      const over = el.scrollWidth - el.clientWidth;
      const clamp = cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
      if (over > 2) {
        if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') {
          if (!clamp) add('text-clipped', 'P1', `文字被裁切 ${over}px（无省略提示）`, el);
          else add('text-truncated', 'P3', '文字被省略号截断（单行）', el);
        } else if (cs.overflowX === 'visible' && !clipAncestor(el)) {
          add('text-spill', 'P1', `文字溢出自身容器 ${over}px`, el);
        }
      } else if (clamp && el.scrollHeight - el.clientHeight > 3 && cs.overflowY === 'hidden') {
        add('text-truncated', 'P3', `文字被多行截断（line-clamp ${cs.webkitLineClamp}）`, el);
      }
    }
    // 被挤成窄列：实际换成 ≥2 行且每行不到 3 个字
    const fs = parseFloat(cs.fontSize);
    // 行内元素只有在它是父元素唯一内容时才检查（否则只是正文中的正常折行）
    const sole = cs.display !== 'inline' || (el.parentElement.children.length === 1 && ownText(el.parentElement) === '');
    if (sole && !el.children.length && t.length >= 3 && cs.writingMode === 'horizontal-tb' && el.getBoundingClientRect().height > fs * 1.9) {
      const lines = textLines(el, fs).length;
      if (lines >= 2 && t.length / lines <= 2.6) {
        add('narrow-wrap', 'P1', `文字被挤成窄列（${lines} 行，每行约 ${Math.max(1, Math.round(t.length / lines))} 字）`, el);
      }
    }
    // 标题末行孤字
    if (/^h[1-3]$/.test(tag)) {
      const lines = textLines(el, fs);
      if (lines.length >= 2 && lines[lines.length - 1].width < fs * 2.3) {
        add('heading-orphan', 'P2', `标题末行只有约 ${Math.max(1, Math.round(lines[lines.length - 1].width / fs))} 个字`, el);
      }
    }
  }

  /* ---------- 3. 卡片：内容出界、底部空白、内部大间隙 ---------- */
  const cards = all.filter((el) => (el.classList.contains('card') || el.classList.contains('card-flat')) && isVisible(el));
  for (const card of cards) {
    const cr = card.getBoundingClientRect();
    const ccs = styleOf(card);
    if (ccs.overflowX === 'visible') {
      for (const el of card.querySelectorAll('*')) {
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const d = Math.max(r.right - cr.right, cr.left - r.left);
        if (d <= 1.5) continue;
        const pos = styleOf(el).position;
        if (pos === 'absolute' || pos === 'fixed' || clipAncestor(el, card) || !isVisible(el)) continue;
        add('card-overflow', 'P1', `内容超出卡片边界 ${Math.round(d)}px`, el);
        break;
      }
    }
    const kids = Array.from(card.children).filter((k) => isVisible(k) && !['absolute', 'fixed'].includes(styleOf(k).position));
    if (kids.length) {
      const rects = kids.map((k) => ({ r: k.getBoundingClientRect(), mb: parseFloat(styleOf(k).marginBottom) || 0 }));
      const maxBottom = Math.max(...rects.map((x) => x.r.bottom + x.mb));
      const blank = cr.bottom - (parseFloat(ccs.paddingBottom) || 0) - (parseFloat(ccs.borderBottomWidth) || 0) - maxBottom;
      if (blank > 64) add('card-blank', blank > 160 ? 'P1' : 'P2', `卡片底部空白 ${Math.round(blank)}px`, card);
      const sorted = rects.map((x) => x.r).sort((a, b) => a.top - b.top);
      for (let i = 1; i < sorted.length; i++) {
        let prev = null;
        for (let j = i - 1; j >= 0; j--) {
          if (sorted[i].left < sorted[j].right - 1 && sorted[i].right > sorted[j].left + 1) {
            prev = sorted[j];
            break;
          }
        }
        if (prev && sorted[i].top - prev.bottom > 72) {
          add('card-gap', 'P2', `卡片内部出现 ${Math.round(sorted[i].top - prev.bottom)}px 的空白`, card);
          break;
        }
      }
    }
  }

  /* ---------- 4. 并排元素高度不一致 / 栏高失衡 ---------- */
  const boxy = (el) => {
    const cs = styleOf(el);
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 60) return false;
    return parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none';
  };
  for (const parent of all) {
    if (parent.children.length < 2 || !isVisible(parent)) continue;
    const pcs = styleOf(parent);
    if (!/grid|flex/.test(pcs.display)) continue;
    const kids = Array.from(parent.children).filter(isVisible);
    if (kids.length < 2) continue;
    const rows = new Map();
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      const key = Math.round(r.top / 3);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ k, r });
    }
    let worst = null;
    for (const items of rows.values()) {
      if (items.length < 2) continue;
      const hs = items.map((x) => x.r.height);
      const max = Math.max(...hs);
      const min = Math.min(...hs);
      if (max < 120) continue;
      const allBoxy = items.every((x) => boxy(x.k));
      const diff = max - min;
      if (allBoxy && diff > 24) {
        if (!worst || diff > worst.diff) worst = { diff, type: 'row-uneven', el: items.find((x) => x.r.height === min).k };
      } else if (!allBoxy && diff > 220 && parent.getBoundingClientRect().width > 700 && items.every((x) => x.r.width >= 240)) {
        const short = items.find((x) => x.r.height === min).k;
        // 吸顶侧栏会随滚动停留在视口内，不构成空白
        const sticky = [short, ...short.children].some((e) => styleOf(e).position === 'sticky');
        if (!sticky && (!worst || diff > worst.diff)) worst = { diff, type: 'col-imbalance', el: short };
      }
    }
    if (worst) {
      add(worst.type, worst.diff > 320 ? 'P1' : 'P2', worst.type === 'row-uneven' ? `同一行卡片高度不一致，相差 ${Math.round(worst.diff)}px` : `并排栏目高度失衡，较矮一栏留白 ${Math.round(worst.diff)}px`, worst.el);
    }
  }

  /* ---------- 5. 区块间距与重叠 ---------- */
  const gaps = [];
  for (const rootEl of document.querySelectorAll('main .container')) {
    const kids = Array.from(rootEl.children).filter(isVisible);
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect();
      const b = kids[i].getBoundingClientRect();
      if (!(b.left < a.right && b.right > a.left)) continue;
      const gap = Math.round(b.top - a.bottom);
      gaps.push(gap);
      if (gap > 88) add('gap-large', 'P2', `相邻区块间距过大 ${gap}px`, kids[i]);
      if (gap < -4 && !['absolute', 'fixed', 'sticky'].includes(styleOf(kids[i]).position)) add('overlap', 'P1', `相邻区块重叠 ${-gap}px`, kids[i]);
    }
  }
  out.metrics.sectionGaps = gaps;

  /* ---------- 6. 页脚 ---------- */
  const footer = document.querySelector('.site-footer');
  if (footer) {
    const fr = footer.getBoundingClientRect();
    const fb = fr.bottom + window.scrollY;
    if (out.metrics.docHeight - fb > 2) add('footer-gap', 'P1', `页脚下方有 ${Math.round(out.metrics.docHeight - fb)}px 空白`, footer);
    if (fb < vh - 2) add('footer-floating', 'P1', `页面不足一屏，页脚未贴底（下方空 ${Math.round(vh - fb)}px）`, footer);
  }

  /* ---------- 7. 图片 ---------- */
  for (const img of document.images) {
    const alt = img.getAttribute('alt');
    if (alt === null) add('img-no-alt', 'P1', '图片缺少 alt 属性', img);
    else if (alt.trim() === '' && img.getAttribute('role') !== 'presentation' && img.getAttribute('aria-hidden') !== 'true') add('img-empty-alt', 'P2', '图片 alt 为空且未声明为装饰图', img);
    if (img.complete && img.naturalWidth === 0) add('img-broken', 'P0', `图片加载失败 ${(img.currentSrc || img.src).split('/').pop()}`, img);
    if (!img.getAttribute('width') || !img.getAttribute('height')) add('img-no-size', 'P2', '图片未声明 width / height（可能引起布局偏移）', img);
    const top = img.getBoundingClientRect().top + window.scrollY;
    const lazy = img.getAttribute('loading') === 'lazy';
    if (top > vh * 1.5 && !lazy) add('img-not-lazy', 'P2', '首屏以下的图片未使用 loading="lazy"', img);
    if (top < vh * 0.9 && lazy && img.getBoundingClientRect().width > 0) add('img-lazy-above-fold', 'P2', '首屏图片使用了 lazy 加载', img);
    if (img.complete && img.naturalWidth > 0 && isVisible(img)) {
      const r = img.getBoundingClientRect();
      const fit = styleOf(img).objectFit;
      const dr = r.width / r.height;
      const nr = img.naturalWidth / img.naturalHeight;
      if (fit === 'fill' && Math.abs(dr - nr) / nr > 0.03) add('img-distorted', 'P1', `图片比例被拉伸（显示 ${dr.toFixed(2)}，原始 ${nr.toFixed(2)}）`, img);
      if (r.width > img.naturalWidth * 1.15) add('img-upscaled', 'P2', `图片被放大显示（${Math.round(r.width)}px > 原始 ${img.naturalWidth}px）`, img);
    }
  }

  /* ---------- 8. 标题层级 ---------- */
  const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter((h) => !h.closest('dialog:not([open])'));
  const h1s = hs.filter((h) => h.tagName === 'H1');
  if (h1s.length !== 1) add('h1-count', 'P1', `H1 数量为 ${h1s.length}（应为 1）`, h1s[1] || null);
  let prevLv = 0;
  let skips = 0;
  for (const h of hs) {
    const lv = +h.tagName[1];
    if (prevLv && lv > prevLv + 1 && skips < 2) {
      add('heading-skip', 'P2', `标题层级跳级 h${prevLv} → h${lv}`, h);
      skips++;
    }
    prevLv = lv;
  }

  /* ---------- 9. 可访问名称与表单标签 ---------- */
  const accName = (el) => {
    const al = (el.getAttribute('aria-label') || '').trim();
    if (al) return al;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb
        .split(/\s+/)
        .map((id) => (document.getElementById(id) ? document.getElementById(id).textContent : ''))
        .join(' ')
        .trim();
      if (t) return t;
    }
    const tc = (el.textContent || '').replace(/\s+/g, '').trim();
    if (tc) return tc;
    const ti = (el.getAttribute('title') || '').trim();
    if (ti) return ti;
    const im = Array.from(el.querySelectorAll('img[alt]'))
      .map((i) => i.alt)
      .join('')
      .trim();
    if (im) return im;
    const st = el.querySelector('svg title');
    return st ? st.textContent.trim() : '';
  };
  for (const el of document.querySelectorAll('a[href], button, [role="button"], [role="tab"], [role="menuitem"], summary')) {
    if (el.closest('[aria-hidden="true"]')) {
      if (el.tabIndex >= 0 && isVisible(el)) add('focusable-in-aria-hidden', 'P2', 'aria-hidden 区域内含可聚焦元素', el);
      continue;
    }
    if (!accName(el)) add('no-acc-name', 'P1', '可交互元素缺少可访问名称', el);
  }
  for (const el of document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea')) {
    const has = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.closest('label') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
    if (!has) add('input-no-label', 'P1', '表单控件缺少标签', el);
  }

  /* ---------- 10. 对比度 ---------- */
  if (opts.contrast) {
    const parseColor = (s) => {
      let m = s.match(/^rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      }
      m = s.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
      if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: m[4] !== undefined ? +m[4] : 1 };
      return null;
    };
    const lum = (c) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
    const bgOf = (el) => {
      const layers = [];
      for (let c = el; c && c.nodeType === 1; c = c.parentElement) {
        const cs = styleOf(c);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') {
          const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)|color\(srgb[^)]+\)/g) || []).map(parseColor).filter((x) => x && x.a >= 0.9);
          if (!stops.length) return null;
          return stops.map((s) => {
            let acc = s;
            for (let i = layers.length - 1; i >= 0; i--) acc = blend(layers[i], acc);
            return acc;
          });
        }
        const col = parseColor(cs.backgroundColor);
        if (col && col.a > 0) {
          layers.push(col);
          if (col.a >= 0.999) break;
        }
      }
      let acc = layers.length && layers[layers.length - 1].a >= 0.999 ? layers[layers.length - 1] : { r: 255, g: 255, b: 255, a: 1 };
      const start = layers.length && layers[layers.length - 1].a >= 0.999 ? layers.length - 2 : layers.length - 1;
      for (let i = start; i >= 0; i--) acc = blend(layers[i], acc);
      return [acc];
    };
    const seen = new Map();
    for (const el of all) {
      if (el.tagName.toLowerCase() === 'svg') continue;
      const t = ownText(el);
      if (!t || !isVisible(el)) continue;
      // 禁用控件、装饰性文字与品牌首字标识（等同 Logo）不适用对比度要求
      if (el.closest('[aria-disabled="true"], :disabled, .is-pending, [aria-hidden="true"], [role="img"]')) continue;
      const cs = styleOf(el);
      const fg = parseColor(cs.color);
      if (!fg) continue;
      let op = 1;
      for (let c = el; c && c.nodeType === 1; c = c.parentElement) op *= parseFloat(styleOf(c).opacity || '1');
      const bgs = bgOf(el);
      if (!bgs) continue;
      let worst = Infinity;
      let worstBg = bgs[0];
      let worstFg = fg;
      for (const b of bgs) {
        const f = blend({ r: fg.r, g: fg.g, b: fg.b, a: fg.a * op }, b);
        const l1 = lum(f);
        const l2 = lum(b);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < worst) {
          worst = ratio;
          worstBg = b;
          worstFg = f;
        }
      }
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      const need = large ? 3 : 4.5;
      if (worst < need - 0.05) {
        const b0 = worstBg;
        const fgTxt = `rgb(${Math.round(worstFg.r)}, ${Math.round(worstFg.g)}, ${Math.round(worstFg.b)})`;
        const key = `${fgTxt}|${Math.round(b0.r)},${Math.round(b0.g)},${Math.round(b0.b)}|${large}`;
        if (!seen.has(key)) seen.set(key, { ratio: worst, need, el, count: 0, fg: fgTxt, bg: `rgb(${Math.round(b0.r)}, ${Math.round(b0.g)}, ${Math.round(b0.b)})` });
        const rec = seen.get(key);
        rec.count++;
        rec.ratio = Math.min(rec.ratio, worst);
      }
    }
    for (const v of seen.values()) add('contrast', v.ratio < 3 ? 'P1' : 'P2', `文字对比度 ${v.ratio.toFixed(2)}:1（需 ≥ ${v.need}:1），前景 ${v.fg} / 背景 ${v.bg}，共 ${v.count} 处`, v.el);
  }

  /* ---------- 11. 设计一致性统计 ---------- */
  if (opts.design) {
    const tally = (arr) => {
      const m = {};
      for (const v of arr) m[v] = (m[v] || 0) + 1;
      return m;
    };
    const vis = (q) => Array.from(document.querySelectorAll(q)).filter(isVisible);
    out.metrics.design = {
      cardRadius: tally(cards.map((c) => styleOf(c).borderTopLeftRadius)),
      cardShadow: tally(cards.map((c) => (styleOf(c).boxShadow === 'none' ? 'none' : 'shadow'))),
      cardPadding: tally(cards.map((c) => `${styleOf(c).paddingTop}/${styleOf(c).paddingLeft}`)),
      btn: tally(vis('.btn').map((b) => `${b.classList.contains('btn-sm') ? 'sm' : 'md'}:${Math.round(b.getBoundingClientRect().height)}`)),
      h1: h1s.map((h) => `${styleOf(h).fontSize}/${styleOf(h).fontWeight}`),
      h2: tally(vis('h2').map((h) => styleOf(h).fontSize)),
      h3: tally(vis('h3').map((h) => styleOf(h).fontSize)),
      icon: tally(vis('svg.icon').map((s) => Math.round(s.getBoundingClientRect().width))),
      radius: tally(all.filter((e) => isVisible(e) && parseFloat(styleOf(e).borderTopWidth) > 0 && parseFloat(styleOf(e).borderTopLeftRadius) > 0).map((e) => styleOf(e).borderTopLeftRadius)),
    };
  }

  /* ---------- 12. 点击区域与遮挡（会滚动页面，放在最后） ---------- */
  const interactive = Array.from(
    document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], label.chip'),
  ).filter(isVisible);
  out.metrics.interactive = interactive.length;
  if (isMobile) {
    const rects = interactive.map((el) => ({ el, r: el.getBoundingClientRect() }));
    for (const { el, r } of rects) {
      const cs = styleOf(el);
      if (el.tagName === 'A' && cs.display === 'inline') {
        const p = el.parentElement;
        const inText = Array.from(p.childNodes).some((n) => n !== el && n.nodeType === 3 && n.nodeValue.trim().length > 1);
        if (inText) continue; // 行内文字链接按 WCAG 2.5.8 豁免
      }
      const m = Math.min(r.width, r.height);
      if (m >= 24) {
        if (m < 36 && (el.tagName === 'BUTTON' || el.classList.contains('btn'))) add('tap-smallish', 'P2', `按钮点击区域偏小 ${Math.round(r.width)}×${Math.round(r.height)}px`, el);
        continue;
      }
      // 间距豁免：以中心为准的 24px 方块不与其他目标相交
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const box = { l: cx - Math.max(12, r.width / 2), r: cx + Math.max(12, r.width / 2), t: cy - Math.max(12, r.height / 2), b: cy + Math.max(12, r.height / 2) };
      const clash = rects.some((o) => o.el !== el && !o.el.contains(el) && !el.contains(o.el) && o.r.left < box.r && o.r.right > box.l && o.r.top < box.b && o.r.bottom > box.t);
      if (clash) add('tap-small', 'P1', `点击区域过小且紧邻其他目标 ${Math.round(r.width)}×${Math.round(r.height)}px`, el);
      else add('tap-small', 'P2', `点击区域小于 24px（${Math.round(r.width)}×${Math.round(r.height)}px）`, el);
    }
  }
  for (const el of interactive) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    if (el.classList.contains('skip-link')) continue; // 仅在键盘聚焦时移入视口
    el.scrollIntoView({ block: 'center', inline: 'center' });
    // 折成多行的行内链接：外接矩形的中心可能落在两行之间的别的元素上，
    // 改用面积最大的那一段（用户实际会点的位置；包着图片的链接则取图片所在的那一段）
    const frags = Array.from(el.getClientRects()).filter((f) => f.width > 0 && f.height > 0);
    const r = frags.length > 1 ? frags.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a)) : el.getBoundingClientRect();
    if (r.bottom <= 0 || r.right <= 0) continue;
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
    const hit = document.elementFromPoint(cx, cy);
    if (!hit) {
      add('unreachable', 'P1', '元素中心不在可视区域内', el);
      continue;
    }
    if (el === hit || el.contains(hit) || hit.contains(el)) continue;
    const lab = el.closest('label');
    if (lab && (lab === hit || lab.contains(hit))) continue;
    add('covered', 'P0', `被其他元素遮挡：${sel(hit)}`, el);
  }
  // scrollIntoView 会连带滚动 overflow:hidden 的容器，检查后全部复位，避免影响截图
  for (const el of all) {
    if (el.scrollLeft) el.scrollLeft = 0;
    if (el.scrollTop) el.scrollTop = 0;
  }
  window.scrollTo(0, 0);

  /* ---------- 13. 展开全部折叠内容后的横向溢出 ---------- */
  const closed = Array.from(document.querySelectorAll('details:not([open])'));
  if (closed.length) {
    closed.forEach((d) => (d.open = true));
    const sw2 = Math.max(docEl.scrollWidth, document.body.scrollWidth);
    if (sw2 > vw + 1 && sw <= vw + 1) add('h-overflow', 'P0', `展开折叠内容后页面横向溢出 ${sw2 - vw}px`, closed[0]);
    closed.forEach((d) => (d.open = false));
  }
  return out;
}

const OBSERVERS = `
  window.__cls = 0; window.__shifts = []; window.__lcp = 0; window.__lcpEl = '';
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).slice(0, 3).map((s) => s.node && s.node.nodeType === 1 ? s.node.tagName.toLowerCase() + (s.node.className && typeof s.node.className === 'string' ? '.' + s.node.className.split(' ')[0] : '') : '?') }); } }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { const es = l.getEntries(); const last = es[es.length - 1]; window.__lcp = last.startTime; window.__lcpEl = last.element ? last.element.tagName.toLowerCase() + (typeof last.element.className === 'string' && last.element.className ? '.' + last.element.className.split(' ')[0] : '') : ''; }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
`;

/* ------------------------------------------------------------------ */
/* 静态检查：外链属性、假链接、按钮类型                                  */
/* ------------------------------------------------------------------ */
async function staticLinkAudit(pages) {
  const brands = JSON.parse(await fsp.readFile(path.join(root, 'src/data/brands.json'), 'utf8'));
  const affiliateHosts = new Set(
    brands
      .flatMap((b) => [b.affiliateUrl, b.officialWebsite])
      .filter(Boolean)
      .map((u) => new URL(u).hostname),
  );
  const issues = [];
  const external = new Map();
  for (const p of pages) {
    if (p === '/__not-found__/') continue;
    const file = path.join(dist, p, 'index.html');
    const html = await fsp.readFile(file, 'utf8');
    const doc = parse(html);
    for (const a of doc.querySelectorAll('a')) {
      const href = a.getAttribute('href');
      const rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
      const target = a.getAttribute('target') || '';
      const text = a.text.replace(/\s+/g, ' ').trim().slice(0, 30);
      if (href === undefined || href === null) continue;
      if (href === '' || href === '#' || /^javascript:/i.test(href)) {
        issues.push({ type: 'fake-link', sev: 'P1', page: p, msg: `链接没有真实目标 href="${href}"`, text });
        continue;
      }
      if (/^https?:\/\//i.test(href)) {
        const u = new URL(href);
        if (u.hostname === SITE_HOST) continue;
        const key = `${href}|${rel.join(' ')}|${target}`;
        if (!external.has(key)) external.set(key, { href, rel: rel.join(' '), target, pages: 0, text });
        external.get(key).pages++;
        if (target === '_blank' && !rel.includes('noopener')) issues.push({ type: 'ext-noopener', sev: 'P1', page: p, msg: `新窗口外链缺少 rel="noopener" ${href}`, text });
        if (affiliateHosts.has(u.hostname) && !(rel.includes('sponsored') && rel.includes('nofollow'))) issues.push({ type: 'affiliate-rel', sev: 'P1', page: p, msg: `推广链接缺少 sponsored / nofollow ${href}`, text });
        if (target !== '_blank') issues.push({ type: 'ext-same-tab', sev: 'P3', page: p, msg: `外链在当前标签页打开 ${href}`, text });
      }
    }
    for (const b of doc.querySelectorAll('button')) {
      if (!b.getAttribute('type')) issues.push({ type: 'button-no-type', sev: 'P2', page: p, msg: '<button> 未声明 type', text: b.text.replace(/\s+/g, ' ').trim().slice(0, 30) });
    }
  }
  return { issues, external: [...external.values()].sort((a, b) => b.pages - a.pages) };
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */
async function main() {
  const vpArg = arg('vp');
  // --vp 可写预设宽度，也可写任意宽度（如 900,1280）：非预设宽度按 <768 手机 / ≥768 桌面处理
  const viewports =
    vpArg && vpArg !== true
      ? String(vpArg)
          .split(',')
          .map(Number)
          .filter((w) => w >= 240)
          .map((w) => ALL_VIEWPORTS.find((v) => v.w === w) ?? { w, h: w < 768 ? 800 : 900, mobile: w < 768, name: `${w} 自定义` })
      : ALL_VIEWPORTS;
  const allPages = await listPages(dist);
  const pagesArg = arg('pages');
  const pages = pagesArg && pagesArg !== true ? (pagesArg === 'key' ? KEY_PAGES : String(pagesArg).split(',')) : allPages;
  const theme = arg('theme', 'light');
  const outFile = path.resolve(root, String(arg('out', 'ui-audit-report.json')));
  const shotsDir = arg('shots') && arg('shots') !== true ? path.resolve(root, String(arg('shots'))) : null;
  const shotVps = String(arg('shot-vp', '375,768,1440')).split(',').map(Number);
  const shotPagesArg = arg('shot-pages', 'key');
  const shotPages = shotPagesArg === 'key' ? KEY_PAGES : shotPagesArg === 'all' ? pages : String(shotPagesArg).split(',');
  const contrastVps = new Set(String(arg('contrast-vp', '375,1440')).split(',').map(Number));
  const quiet = !!arg('quiet');

  const { server, origin } = await serveDist(dist);
  const browser = await launchBrowser();
  const page = await Page.create(browser.cdp, browser.desktopUA);
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `${OBSERVERS}; try { localStorage.setItem('jz-theme', ${JSON.stringify(theme)}); } catch (e) {}`,
  });
  await page.setMedia({ scheme: theme === 'dark' ? 'dark' : 'light' });

  const results = [];
  const started = Date.now();
  try {
    for (const vp of viewports) {
      await page.setViewport({ width: vp.w, height: vp.h, mobile: vp.mobile });
      for (const p of pages) {
        const url = origin + p;
        let rec = { url: p, vp: vp.w, issues: [], metrics: {}, consoleErrors: [], failedRequests: [] };
        try {
          await page.goto(url);
          const r = await page.eval(`(${pageAudit.toString()})(${JSON.stringify({ contrast: contrastVps.has(vp.w), design: vp.w === 1440 })})`);
          rec.issues = r.issues;
          rec.metrics = r.metrics;
          rec.status = page.lastStatus;
          // 404 页自身的文档请求返回 404 属预期，不计入控制台错误
          rec.consoleErrors = [...new Set(page.consoleErrors)].filter((e) => !(p === '/__not-found__/' && /Failed to load resource/.test(e) && e.includes(p)));
          rec.failedRequests = [...new Set(page.failedRequests)].filter((f) => !(p === '/__not-found__/' && f.startsWith('404 ') && f.endsWith(p)));
          for (const e of rec.consoleErrors) rec.issues.push({ type: 'console-error', sev: 'P1', msg: e.slice(0, 160), sel: '', text: '' });
          for (const f of rec.failedRequests) rec.issues.push({ type: 'request-failed', sev: 'P1', msg: f.slice(0, 160), sel: '', text: '' });
          if (shotsDir && shotVps.includes(vp.w) && shotPages.includes(p)) {
            const slug = p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '__');
            await page.eval('window.scrollTo(0, 0)');
            await page.tiles(path.join(shotsDir, String(vp.w), slug), { tileHeight: vp.w < 768 ? 1500 : 1400 });
          }
        } catch (e) {
          rec.issues.push({ type: 'audit-error', sev: 'P0', msg: String(e.message || e).slice(0, 200), sel: '', text: '' });
        }
        results.push(rec);
      }
      if (!quiet) console.log(`[ui-audit] ${vp.name}：${pages.length} 页完成（累计 ${Math.round((Date.now() - started) / 1000)}s）`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  const staticAudit = await staticLinkAudit(pages.filter((p) => allPages.includes(p)));

  /* 汇总：同一类型 + 同一选择器的问题跨页面、跨视口合并 */
  const groups = new Map();
  for (const r of results) {
    for (const i of r.issues) {
      const key = `${i.type}|${i.sel}`;
      if (!groups.has(key)) groups.set(key, { type: i.type, sev: i.sev, sel: i.sel, msg: i.msg, text: i.text, pages: new Set(), vps: new Set(), count: 0 });
      const g = groups.get(key);
      g.pages.add(r.url);
      g.vps.add(r.vp);
      g.count++;
      if (i.sev < g.sev) g.sev = i.sev;
    }
  }
  const grouped = [...groups.values()]
    .map((g) => ({ ...g, pages: [...g.pages], vps: [...g.vps].sort((a, b) => a - b) }))
    .sort((a, b) => a.sev.localeCompare(b.sev) || b.pages.length - a.pages.length || b.count - a.count);
  const bySev = {};
  for (const g of grouped) bySev[g.sev] = (bySev[g.sev] || 0) + 1;
  for (const i of staticAudit.issues) bySev[i.sev] = (bySev[i.sev] || 0) + 1;

  const summary = {
    generatedAt: new Date().toISOString(),
    browser: browser.product,
    theme,
    pages: pages.length,
    viewports: viewports.map((v) => v.w),
    renders: results.length,
    issueGroups: grouped.length,
    bySeverity: bySev,
    maxOverflowX: Math.max(0, ...results.map((r) => r.metrics.overflowX || 0)),
    maxCLS: Math.max(0, ...results.map((r) => r.metrics.cls || 0)),
    seconds: Math.round((Date.now() - started) / 1000),
  };
  await fsp.mkdir(path.dirname(outFile), { recursive: true });
  await fsp.writeFile(outFile, JSON.stringify({ summary, grouped, static: staticAudit, results }, null, 1));

  console.log(`[ui-audit] ${summary.pages} 页 × ${summary.viewports.length} 视口 = ${summary.renders} 次渲染，${summary.seconds}s；主题 ${theme}`);
  console.log(`[ui-audit] 问题分组 ${grouped.length}：${Object.entries(bySev).sort().map(([k, v]) => `${k}=${v}`).join('，') || '无'}；最大横向溢出 ${summary.maxOverflowX}px，最大 CLS ${summary.maxCLS}`);
  const limit = Number(arg('top', 60));
  for (const g of grouped.filter((x) => x.sev !== 'P3').slice(0, limit)) {
    console.log(`  ${g.sev} ${g.type} ×${g.count}｜${g.pages.length} 页（如 ${g.pages[0]}）｜视口 ${g.vps.join('/')}｜${g.sel}｜${g.msg}${g.text ? `｜“${g.text}”` : ''}`);
  }
  const st = {};
  for (const i of staticAudit.issues) st[`${i.sev} ${i.type}`] = (st[`${i.sev} ${i.type}`] || 0) + 1;
  console.log(`[ui-audit] 静态检查：外链 ${staticAudit.external.length} 种；${Object.entries(st).map(([k, v]) => `${k}×${v}`).join('，') || '无问题'}`);
  console.log(`[ui-audit] 报告已写入 ${path.relative(root, outFile)}`);
  if (arg('strict') && (bySev.P0 || 0) > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[ui-audit] 失败：', e);
  process.exit(1);
});
