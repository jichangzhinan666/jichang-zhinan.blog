#!/usr/bin/env node
/**
 * 全站交互实测：用本机 Chrome 以真实的鼠标 / 键盘事件操作 dist 中的页面，
 * 验证每个可交互控件“点了确实生效”（而不是只改了计数或状态文字）。
 *
 * 用法（需先 npm run build）：
 *   node scripts/ui-interactions.mjs                 全部用例
 *   node scripts/ui-interactions.mjs --only 筛选      只跑名称含关键词的分组
 *   node scripts/ui-interactions.mjs --out report.json
 *
 * 只读检查：不修改任何文件，不访问外网（外部链接只检查 href / rel / target，不实际打开）。
 * 有用例失败时进程以非 0 退出。
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, serveDist, Page, sleep } from './lib/cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const only = arg('only');
const outFile = path.resolve(root, String(arg('out', 'ui-interactions-report.json')));
const results = [];
let currentGroup = '';

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** 在页面里执行一个自包含函数并取回结果 */
const js = (page, fn, ...args) => page.eval(`(${fn.toString()})(...${JSON.stringify(args)})`);

/** 页面内：选择器命中的元素里实际可见的个数 */
const shown = (page, sel) =>
  js(
    page,
    (s) =>
      [...document.querySelectorAll(s)].filter((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      }).length,
    sel,
  );

const where = (page) => page.eval('location.pathname + location.search + location.hash');

async function main() {
  const { server, origin } = await serveDist(dist);
  const browser = await launchBrowser();
  const page = await Page.create(browser.cdp, browser.desktopUA);
  const dialogs = [];
  browser.cdp.on((msg) => {
    if (msg.sessionId === page.sessionId && msg.method === 'Page.javascriptDialogOpening') {
      dialogs.push(msg.params.message);
      page.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  });
  await browser.cdp.send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
  await page.setMedia({ scheme: 'light' });

  const desktop = () => page.setViewport({ width: 1440, height: 900, mobile: false });
  const phone = (w = 375) => page.setViewport({ width: w, height: 812, mobile: true });
  const open = async (p) => {
    await page.goto(origin + p);
  };
  const fresh = async (p) => {
    await open(p);
    await page.eval('localStorage.clear(); document.documentElement.style.scrollBehavior = "auto"; true');
    await open(p);
  };

  async function group(name, fn) {
    if (only && only !== true && !name.includes(String(only))) return;
    currentGroup = name;
    console.log(`\n■ ${name}`);
    try {
      await fn();
    } catch (e) {
      results.push({ group: name, name: '分组执行中断', ok: false, error: String(e.message || e) });
      console.log(`  ✗ 分组执行中断：${e.message}`);
    }
  }

  async function t(name, fn) {
    const started = Date.now();
    try {
      const note = await fn();
      results.push({ group: currentGroup, name, ok: true, note: note ?? '', ms: Date.now() - started });
      console.log(`  ✓ ${name}${note ? `（${note}）` : ''}`);
    } catch (e) {
      results.push({ group: currentGroup, name, ok: false, error: String(e.message || e), ms: Date.now() - started });
      console.log(`  ✗ ${name}：${e.message}`);
    }
  }

  try {
    /* ------------------------------------------------------------ */
    await group('桌面：页头导航（1440px）', async () => {
      await desktop();
      await fresh('/');

      await t('首页加载无脚本错误', async () => {
        expect(page.lastStatus === 200, `状态码 ${page.lastStatus}`);
        expect(page.consoleErrors.length === 0, `控制台错误：${page.consoleErrors.join(' | ').slice(0, 200)}`);
      });

      await t('鼠标悬停展开下拉菜单，点击子项可跳转', async () => {
        await page.hover('.nav-item.has-children > .nav-link', 0);
        await sleep(150);
        const info = await js(page, () => {
          const item = document.querySelector('.nav-item.has-children');
          const dd = item.querySelector('.nav-dropdown');
          const r = dd.getBoundingClientRect();
          return { visible: r.height > 0 && getComputedStyle(dd).display !== 'none', links: dd.querySelectorAll('a').length, inView: r.left >= 0 && r.right <= innerWidth };
        });
        expect(info.visible, '悬停后下拉菜单未显示');
        expect(info.inView, '下拉菜单超出视口');
        const href = await js(page, () => document.querySelector('.nav-item.has-children .nav-dropdown a').getAttribute('href'));
        await page.waitForNavigation(() => page.click('.nav-item.has-children .nav-dropdown a', 0));
        expect((await where(page)) === href, `跳转到 ${await where(page)}，期望 ${href}`);
        return `${info.links} 个子项，跳转 ${href}`;
      });

      await t('下拉箭头按钮可用键盘 / 点击展开，Esc 关闭', async () => {
        await open('/');
        await page.click('.nav-toggle', 1);
        let s = await js(page, () => {
          const b = document.querySelectorAll('.nav-toggle')[1];
          const dd = b.closest('.nav-item').querySelector('.nav-dropdown');
          return { exp: b.getAttribute('aria-expanded'), h: dd.getBoundingClientRect().height };
        });
        expect(s.exp === 'true' && s.h > 0, `展开失败 aria-expanded=${s.exp} 高度=${s.h}`);
        // 此时鼠标仍停在按钮上、焦点也在按钮上：Esc 必须立刻关掉（不依赖移开鼠标）
        await page.press('Escape');
        await sleep(120);
        s = await js(page, () => {
          const b = document.querySelectorAll('.nav-toggle')[1];
          const dd = b.closest('.nav-item').querySelector('.nav-dropdown');
          return { exp: b.getAttribute('aria-expanded'), h: dd.getBoundingClientRect().height };
        });
        expect(s.exp === 'false' && s.h === 0, `Esc 后未关闭 aria-expanded=${s.exp} 高度=${s.h}`);
        // 鼠标与焦点离开后，悬停应能再次展开
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 500 });
        await js(page, () => document.activeElement && document.activeElement.blur());
        await sleep(150);
        await page.hover('.nav-item.has-children > .nav-link', 1);
        await sleep(150);
        const again = await js(page, () => document.querySelectorAll('.nav-item.has-children')[1].querySelector('.nav-dropdown').getBoundingClientRect().height);
        expect(again > 0, '离开后再次悬停未能展开');
      });

      await t('键盘 Tab 聚焦导航项时下拉菜单展开，Esc 可关闭', async () => {
        await open('/');
        await js(page, () => document.querySelector('.nav-item.has-children > .nav-link').focus());
        await sleep(100);
        const h1 = await js(page, () => document.querySelector('.nav-item.has-children .nav-dropdown').getBoundingClientRect().height);
        expect(h1 > 0, '聚焦后下拉菜单未展开');
        await page.press('Escape');
        await sleep(100);
        const h2 = await js(page, () => document.querySelector('.nav-item.has-children .nav-dropdown').getBoundingClientRect().height);
        expect(h2 === 0, `Esc 后下拉菜单仍显示（高度 ${h2}）`);
      });

      await t('一级导航全部可点击并到达对应栏目', async () => {
        const links = await js(page, () => [...document.querySelectorAll('.nav-list > .nav-item > .nav-link')].map((a) => a.getAttribute('href')));
        for (let i = 0; i < links.length; i++) {
          await open('/');
          await page.waitForNavigation(() => page.click('.nav-list > .nav-item > .nav-link', i));
          const at = await where(page);
          expect(at === links[i], `第 ${i + 1} 项跳转到 ${at}，期望 ${links[i]}`);
          expect(page.lastStatus === 200, `${links[i]} 状态码 ${page.lastStatus}`);
          const cur = await js(page, () => document.querySelectorAll('.nav-link[aria-current="page"]').length);
          expect(cur === 1, `${links[i]} 高亮的导航项数量为 ${cur}`);
        }
        return `${links.length} 项`;
      });

      await t('站点标识返回首页', async () => {
        await open('/compare/');
        await page.waitForNavigation(() => page.click('a.brand'));
        expect((await where(page)) === '/', `到达 ${await where(page)}`);
      });
    });

    /* ------------------------------------------------------------ */
    await group('桌面：站内搜索', async () => {
      await desktop();
      await fresh('/');

      await t('搜索按钮打开对话框并聚焦输入框，Esc 关闭', async () => {
        await page.click('#search-open');
        await sleep(150);
        let s = await js(page, () => ({ open: document.getElementById('search-dialog').open, focus: document.activeElement && document.activeElement.id }));
        expect(s.open, '对话框未打开');
        expect(s.focus === 'search-dialog-input', `焦点在 ${s.focus}`);
        await page.press('Escape');
        await sleep(120);
        s = await js(page, () => ({ open: document.getElementById('search-dialog').open }));
        expect(!s.open, 'Esc 未关闭对话框');
      });

      await t('关闭按钮可关闭对话框', async () => {
        await page.click('#search-open');
        await sleep(150);
        await page.click('.search-close');
        await sleep(120);
        expect(!(await js(page, () => document.getElementById('search-dialog').open)), '关闭按钮无效');
      });

      await t('输入关键词出现即时结果，回车进入结果页', async () => {
        await page.click('#search-open');
        await sleep(150);
        await page.type('Clash');
        await sleep(600);
        const live = await js(page, () => document.querySelectorAll('#search-live a').length);
        expect(live > 0, '没有即时结果');
        await page.waitForNavigation(() => page.press('Enter'));
        const at = await where(page);
        expect(at.startsWith('/search/?q=Clash'), `到达 ${at}`);
        await sleep(400);
        const r = await js(page, () => ({ n: document.querySelectorAll('#search-results li').length, status: document.getElementById('search-status').textContent, marks: document.querySelectorAll('#search-results mark').length }));
        expect(r.n > 0, `结果页无结果：${r.status}`);
        expect(r.marks > 0, '结果未高亮关键词');
        return `即时结果 ${live} 条，结果页 ${r.n} 条`;
      });

      await t('结果页：点击结果可进入文章', async () => {
        const href = await js(page, () => document.querySelector('#search-results a.r-title').getAttribute('href'));
        await page.waitForNavigation(() => page.click('#search-results a.r-title', 0));
        expect((await where(page)) === href, `到达 ${await where(page)}`);
        expect(page.lastStatus === 200, `状态码 ${page.lastStatus}`);
      });

      await t('结果页：中文关键词与无结果提示', async () => {
        await open('/search/');
        await page.click('#search-page-input');
        await page.type('优惠码');
        await page.press('Enter');
        await sleep(500);
        let r = await js(page, () => ({ n: document.querySelectorAll('#search-results li').length, q: new URLSearchParams(location.search).get('q') }));
        expect(r.n > 0 && r.q === '优惠码', `“优惠码”结果 ${r.n} 条，地址参数 ${r.q}`);
        const n1 = r.n;
        await js(page, () => {
          const i = document.getElementById('search-page-input');
          i.focus();
          i.select();
        });
        await page.type('zzzqqqxxx');
        await page.press('Enter');
        await sleep(400);
        r = await js(page, () => ({ n: document.querySelectorAll('#search-results li').length, status: document.getElementById('search-status').textContent }));
        expect(r.n === 0 && /没有找到/.test(r.status), `无结果提示不正确：${r.status}`);
        return `“优惠码” ${n1} 条；无结果时显示提示`;
      });
    });

    /* ------------------------------------------------------------ */
    await group('桌面：主题与个人中心菜单', async () => {
      await desktop();
      await fresh('/');

      await t('主题按钮切换深色并在刷新后保持', async () => {
        await page.click('#theme-toggle');
        let s = await js(page, () => ({ theme: document.documentElement.getAttribute('data-theme'), pressed: document.getElementById('theme-toggle').getAttribute('aria-pressed'), saved: localStorage.getItem('jz-theme'), bg: getComputedStyle(document.body).backgroundColor }));
        expect(s.theme === 'dark' && s.pressed === 'true' && s.saved === 'dark', `切换后 ${JSON.stringify(s)}`);
        const darkBg = s.bg;
        await open('/reviews/');
        s = await js(page, () => ({ theme: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor }));
        expect(s.theme === 'dark', '换页后主题未保持');
        await page.click('#theme-toggle');
        s = await js(page, () => ({ theme: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor }));
        expect(s.theme === 'light' && s.bg !== darkBg, `切回浅色失败 ${JSON.stringify(s)}`);
      });

      await t('个人中心菜单：点击展开、方向键移动、Esc 关闭并归还焦点', async () => {
        await open('/');
        await page.click('#account-btn');
        let s = await js(page, () => ({ hidden: document.getElementById('account-menu').hidden, exp: document.getElementById('account-btn').getAttribute('aria-expanded'), h: document.getElementById('account-menu').getBoundingClientRect().height }));
        expect(!s.hidden && s.exp === 'true' && s.h > 0, `未展开 ${JSON.stringify(s)}`);
        await page.press('ArrowDown');
        const f1 = await js(page, () => document.activeElement.textContent.trim());
        await page.press('ArrowDown');
        const f2 = await js(page, () => document.activeElement.textContent.trim());
        expect(f1 && f2 && f1 !== f2, `方向键未移动焦点（${f1} → ${f2}）`);
        await page.press('Escape');
        s = await js(page, () => ({ hidden: document.getElementById('account-menu').hidden, focus: document.activeElement.id }));
        expect(s.hidden && s.focus === 'account-btn', `Esc 后 ${JSON.stringify(s)}`);
        return `焦点 ${f1} → ${f2}`;
      });

      await t('个人中心菜单：点击外部关闭，菜单项可跳转', async () => {
        await page.click('#account-btn');
        await page.clickAt(300, 600);
        expect(await js(page, () => document.getElementById('account-menu').hidden), '点击外部未关闭');
        await page.click('#account-btn');
        await page.waitForNavigation(() => page.click('#account-menu a[href="/me/"]'));
        expect((await where(page)) === '/me/', `到达 ${await where(page)}`);
      });
    });

    /* ------------------------------------------------------------ */
    await group('首页：栏目切换、轮播与入口', async () => {
      await desktop();
      await fresh('/');

      await t('“最新文章”栏目标签真的筛掉其他栏目', async () => {
        const cats = await js(page, () => [...document.querySelectorAll('.tabs .tab')].map((b) => b.dataset.filter));
        const notes = [];
        for (let i = 1; i < cats.length; i++) {
          await page.click('.tabs .tab', i);
          const s = await js(page, (cat) => {
            const cards = [...document.querySelectorAll('#latest-list .article-card')];
            const vis = cards.filter((c) => c.getBoundingClientRect().height > 0);
            return { total: cards.length, vis: vis.length, wrong: vis.filter((c) => c.dataset.category !== cat).length, expected: cards.filter((c) => c.dataset.category === cat).length, selected: document.querySelector('.tabs .tab[aria-selected="true"]').dataset.filter, empty: !document.querySelector('.tab-empty').hidden };
          }, cats[i]);
          expect(s.selected === cats[i], `标签 ${cats[i]} 未选中`);
          expect(s.wrong === 0 && s.vis === s.expected, `标签 ${cats[i]}：可见 ${s.vis} 篇，其中 ${s.wrong} 篇不属于该栏目（应为 ${s.expected} 篇）`);
          expect(s.expected > 0 || s.empty, `标签 ${cats[i]} 无文章时未显示空状态`);
          notes.push(`${cats[i]} ${s.vis}`);
        }
        await page.click('.tabs .tab', 0);
        const all = await js(page, () => [...document.querySelectorAll('#latest-list .article-card')].filter((c) => c.getBoundingClientRect().height > 0).length);
        const total = await js(page, () => document.querySelectorAll('#latest-list .article-card').length);
        expect(all === total, `“全部”只显示 ${all}/${total}`);
        return `全部 ${total}；${notes.join('，')}`;
      });

      await t('轮播：左右箭头方向正确，箭头与圆点可切换', async () => {
        const dir = await js(page, () => [...document.querySelectorAll('.carousel-btn svg')].map((s) => getComputedStyle(s).transform));
        expect(dir.length === 2 && dir[0] !== 'none' && dir[1] !== 'none' && dir[0] !== dir[1], `箭头图标未旋转：${JSON.stringify(dir)}`);
        const idx = () => js(page, () => [...document.querySelectorAll('#feature-track .slide')].findIndex((s) => s.classList.contains('active')));
        const n = await js(page, () => document.querySelectorAll('#feature-track .slide').length);
        const a = await idx();
        await page.click('.carousel-btn[data-dir="1"]');
        const b = await idx();
        expect(b === (a + 1) % n, `下一张：${a} → ${b}`);
        await page.click('.carousel-btn[data-dir="-1"]');
        expect((await idx()) === a, '上一张未回到原位');
        await page.click('.carousel-dots .dot', n - 1);
        const c = await idx();
        expect(c === n - 1, `圆点跳转：到了 ${c}`);
        const sel = await js(page, () => [...document.querySelectorAll('.carousel-dots .dot')].map((d) => d.getAttribute('aria-selected')).join(','));
        return `${n} 张；aria-selected=${sel}`;
      });

      await t('轮播当前幻灯片链接可点击进入', async () => {
        const href = await js(page, () => document.querySelector('#feature-track .slide.active a').getAttribute('href'));
        await page.waitForNavigation(() => page.click('#feature-track .slide.active a'));
        expect((await where(page)) === href, `到达 ${await where(page)}，期望 ${href}`);
      });

      await t('Hero 主按钮与快捷入口可跳转', async () => {
        await open('/');
        await page.waitForNavigation(() => page.click('.hero-actions a.btn-primary'));
        expect((await where(page)) === '/rankings/2026/', `到达 ${await where(page)}`);
        await open('/');
        const links = await js(page, () => [...document.querySelectorAll('.quick-links a, .quicklinks a, nav.quick a')].map((a) => a.getAttribute('href')));
        return links.length ? `快捷入口 ${links.length} 个` : '';
      });

      await t('侧栏搜索框提交到结果页', async () => {
        await open('/');
        await page.click('.side-search input[name="q"]');
        await page.type('IEPL');
        await page.waitForNavigation(() => page.press('Enter'));
        const at = await where(page);
        expect(at.startsWith('/search/?q=IEPL'), `到达 ${at}`);
      });

      await t('“新手快速上手”箭头指向右侧（是链接不是折叠）', async () => {
        await open('/');
        const tr = await js(page, () => {
          const s = document.querySelector('.quickstart .qs-chevron');
          return s ? getComputedStyle(s).transform : null;
        });
        expect(tr && tr !== 'none', `箭头未旋转：${tr}`);
      });
    });

    /* ------------------------------------------------------------ */
    await group('榜单页：筛选与折叠说明', async () => {
      await desktop();
      await fresh('/rankings/2026/');

      await t('按“实测证据”筛选后只显示符合的品牌卡片', async () => {
        await js(page, () => {
          const s = document.querySelector('#rank-filter select[name="evidence"]');
          s.value = 'owner';
          s.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const s = await js(page, () => {
          const cards = [...document.querySelectorAll('#rank-cards .rc-card')];
          const vis = cards.filter((c) => c.getBoundingClientRect().height > 0);
          return { total: cards.length, vis: vis.length, wrong: vis.filter((c) => c.dataset.evidence !== 'owner').length, text: document.getElementById('rank-filter-result').textContent };
        });
        expect(s.vis > 0 && s.vis < s.total && s.wrong === 0, `可见 ${s.vis}/${s.total}，不符合 ${s.wrong}`);
        expect(s.text.includes(String(s.vis)), `计数文字与实际不符：${s.text}`);
        return s.text;
      });

      await t('多条件组合到无结果时显示空状态，“清除筛选”恢复全部', async () => {
        await js(page, () => {
          const f = document.getElementById('rank-filter');
          f.querySelector('select[name="price"]').value = '20';
          f.querySelector('select[name="gb"]').value = '200';
          f.querySelector('select[name="gb"]').dispatchEvent(new Event('change', { bubbles: true }));
        });
        let s = await js(page, () => ({ vis: [...document.querySelectorAll('#rank-cards .rc-card')].filter((c) => c.getBoundingClientRect().height > 0).length, empty: !document.getElementById('rank-empty').hidden }));
        expect(s.vis === 0 ? s.empty : true, '无结果时未显示空状态');
        await page.click('#rank-filter button[type="reset"]');
        await sleep(120);
        s = await js(page, () => ({ vis: [...document.querySelectorAll('#rank-cards .rc-card')].filter((c) => c.getBoundingClientRect().height > 0).length, total: document.querySelectorAll('#rank-cards .rc-card').length, empty: !document.getElementById('rank-empty').hidden }));
        expect(s.vis === s.total && !s.empty, `清除后可见 ${s.vis}/${s.total}`);
      });

      await t('下拉选择框可用真实点击 + 键盘操作', async () => {
        await page.click('#rank-filter select[name="region"]');
        await page.press('Escape');
        await js(page, () => document.querySelector('#rank-filter select[name="region"]').focus());
        await page.press('ArrowDown');
        await sleep(120);
        const s = await js(page, () => ({ v: document.querySelector('#rank-filter select[name="region"]').value, vis: [...document.querySelectorAll('#rank-cards .rc-card')].filter((c) => c.getBoundingClientRect().height > 0).length }));
        expect(s.v !== '', '键盘未改变选项');
        await page.click('#rank-filter button[type="reset"]');
        return `选中“${s.v}”，可见 ${s.vis} 个`;
      });

      await t('“评选方法”折叠块可展开 / 收起', async () => {
        await page.click('details.method > summary');
        expect(await js(page, () => document.querySelector('details.method').open), '未展开');
        await page.click('details.method > summary');
        expect(!(await js(page, () => document.querySelector('details.method').open)), '未收起');
      });

      await t('卡片按钮：资料页链接可进入，推广入口带 sponsored 属性', async () => {
        const a = await js(page, () => {
          const out = [...document.querySelectorAll('#rank-cards .rc-actions a[target="_blank"]')].map((x) => x.getAttribute('rel') || '');
          return { n: out.length, bad: out.filter((r) => !['sponsored', 'nofollow', 'noopener', 'noreferrer'].every((k) => r.split(/\s+/).includes(k))).length };
        });
        expect(a.n > 0 && a.bad === 0, `推广入口 ${a.n} 个，其中 ${a.bad} 个 rel 不完整`);
        const href = await js(page, () => document.querySelector('#rank-cards .rc-actions a.btn-primary').getAttribute('href'));
        await page.waitForNavigation(() => page.click('#rank-cards .rc-actions a.btn-primary', 0));
        expect((await where(page)) === href, `到达 ${await where(page)}`);
        return `推广入口 ${a.n} 个`;
      });
    });

    /* ------------------------------------------------------------ */
    await group('品牌资料库：筛选与排序', async () => {
      await desktop();
      await fresh('/reviews/');

      const visInfo = () =>
        js(page, () => {
          const cards = [...document.querySelectorAll('#brand-list .brand-item')];
          const vis = cards.filter((c) => c.getBoundingClientRect().height > 0);
          return { total: cards.length, vis: vis.length, regions: vis.map((c) => c.dataset.regions), entries: vis.map((c) => Number(c.dataset.entry)), ranks: vis.map((c) => Number(c.dataset.rank)), text: document.getElementById('filter-result').textContent, empty: !document.getElementById('brand-empty').hidden };
        });

      await t('地区筛选（真实点击）只保留包含该地区的品牌', async () => {
        const idx = await js(page, () => [...document.querySelectorAll('#brand-filter input[name="region"]')].findIndex((i) => i.value === '韩国'));
        expect(idx >= 0, '找不到“韩国”筛选项');
        await page.click('#brand-filter input[name="region"] + span', idx);
        const s = await visInfo();
        expect(s.vis > 0 && s.vis < s.total, `可见 ${s.vis}/${s.total}`);
        expect(s.regions.every((r) => r.split('|').includes('韩国')), '存在不含“韩国”的可见品牌');
        expect(s.text.includes(String(s.vis)), `计数文字与实际不符：${s.text}`);
        return s.text.trim();
      });

      await t('“清除筛选”恢复全部并按榜单顺序', async () => {
        await page.click('#filter-reset');
        await sleep(150);
        const s = await visInfo();
        expect(s.vis === s.total, `可见 ${s.vis}/${s.total}`);
        expect(s.ranks.join(',') === [...s.ranks].sort((a, b) => a - b).join(','), `顺序 ${s.ranks.join(',')}`);
      });

      await t('价格上限与排序', async () => {
        const pi = await js(page, () => [...document.querySelectorAll('#brand-filter input[name="price"]')].findIndex((i) => i.value === '20'));
        expect(pi >= 0, '找不到 ≤¥20 选项');
        await page.click('#brand-filter input[name="price"] + span', pi);
        let s = await visInfo();
        expect(s.vis > 0 && s.entries.every((e) => e <= 20), `≤¥20 后入门价：${s.entries.join(',')}`);
        const n20 = s.vis;
        await page.click('#filter-reset');
        await sleep(120);
        const opts = await js(page, () => [...document.querySelectorAll('#brand-sort option')].map((o) => o.value));
        const priceOpt = opts.find((o) => /price|entry/.test(o));
        if (priceOpt) {
          await js(page, (v) => {
            const sel = document.getElementById('brand-sort');
            sel.value = v;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }, priceOpt);
          s = await visInfo();
          expect(s.entries.join(',') === [...s.entries].sort((a, b) => a - b).join(','), `按入门价排序后：${s.entries.join(',')}`);
        }
        await page.click('#filter-reset');
        return `≤¥20：${n20} 个；排序选项 ${opts.join('/')}`;
      });

      await t('品牌卡片标题与按钮进入对应品牌页', async () => {
        await sleep(120);
        const href = await js(page, () => document.querySelector('#brand-list .brand-item .bi-cta').getAttribute('href'));
        await page.waitForNavigation(() => page.click('#brand-list .brand-item .bi-cta', 0));
        expect((await where(page)) === href && page.lastStatus === 200, `到达 ${await where(page)}（${page.lastStatus}）`);
        return href;
      });
    });

    /* ------------------------------------------------------------ */
    await group('套餐对比：筛选、排序与计算器', async () => {
      await desktop();
      await fresh('/compare/');

      const rows = () =>
        js(page, () => {
          const all = [...document.querySelectorAll('#cmp-table tbody tr')];
          const vis = all.filter((r) => r.getBoundingClientRect().height > 0);
          return { total: all.length, vis: vis.length, brands: [...new Set(vis.map((r) => r.dataset.brand))], gb: vis.map((r) => Number(r.dataset.gb)), monthly: vis.map((r) => (r.dataset.monthly === '' ? null : Number(r.dataset.monthly))), count: document.getElementById('cmp-count').textContent };
        });

      await t('取消勾选品牌后该品牌的行消失', async () => {
        const first = await js(page, () => document.querySelector('#cmp-form input[name="brand"]').value);
        await page.click('#cmp-form input[name="brand"] + span', 0);
        const s = await rows();
        expect(!s.brands.includes(first) && s.vis < s.total, `品牌 ${first} 仍在表中（可见 ${s.vis}/${s.total}）`);
        await page.click('#cmp-form input[name="brand"] + span', 0);
        const s2 = await rows();
        expect(s2.vis === s2.total, '重新勾选后未恢复');
        return `${first}：${s.vis}/${s.total} 行`;
      });

      await t('流量下限、月付上限与排序', async () => {
        await js(page, () => {
          const f = document.getElementById('cmp-form');
          f.querySelector('select[name="mingb"]').value = '500';
          f.querySelector('select[name="sort"]').value = 'monthly';
          f.querySelector('select[name="sort"]').dispatchEvent(new Event('change', { bubbles: true }));
        });
        const s = await rows();
        expect(s.vis > 0 && s.gb.every((g) => g >= 500), `月流量：${s.gb.join(',')}`);
        const m = s.monthly.filter((x) => x !== null);
        expect(m.join(',') === [...m].sort((a, b) => a - b).join(','), `月付排序：${m.join(',')}`);
        expect(s.count.includes(String(s.vis)), `计数文字：${s.count}`);
        await page.click('#cmp-form button[type="reset"]');
        await sleep(150);
        const s2 = await rows();
        expect(s2.vis === s2.total, `清除后 ${s2.vis}/${s2.total}`);
        return `≥500 GB：${s.vis} 档`;
      });

      await t('页内跳转链接滚动到对应表格且不被页头遮住', async () => {
        const n = await js(page, () => document.querySelectorAll('.cmp-jump a').length);
        for (let i = 0; i < n; i++) {
          await page.click('.cmp-jump a', i);
          await sleep(250);
          const s = await js(page, () => {
            const id = location.hash.slice(1);
            const el = document.getElementById(id);
            const hb = document.querySelector('.site-header').getBoundingClientRect().bottom;
            return { id, top: el ? el.getBoundingClientRect().top : null, hb, vh: innerHeight };
          });
          expect(s.top !== null, `锚点 #${s.id} 不存在`);
          expect(s.top >= s.hb - 1 && s.top < s.vh, `#${s.id} 位置 ${Math.round(s.top)}（页头底边 ${Math.round(s.hb)}）`);
        }
        return `${n} 个锚点`;
      });

      await t('每 GB 计算器按输入实时换算', async () => {
        const before = await js(page, () => document.getElementById('calc-out').textContent.trim());
        await js(page, () => {
          const i = document.querySelector('#calc-form input[name="price"]');
          i.focus();
          i.select();
        });
        await page.type('100');
        await js(page, () => {
          const i = document.querySelector('#calc-form input[name="gb"]');
          i.focus();
          i.select();
        });
        await page.type('200');
        await sleep(150);
        const after = await js(page, () => document.getElementById('calc-out').textContent.trim());
        expect(after && after !== before, '输出未变化');
        expect(/0\.50?0?\b/.test(after), `¥100 / 200 GB 应得 0.5 元/GB，实际输出：${after}`);
        await js(page, () => {
          const s = document.querySelector('#calc-form select[name="months"]');
          s.value = '12';
          s.dispatchEvent(new Event('input', { bubbles: true }));
          s.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await sleep(120);
        const yearly = await js(page, () => document.getElementById('calc-out').textContent.trim());
        expect(yearly !== after, '切换周期后输出未变化');
        return after.replace(/\s+/g, ' ').slice(0, 60);
      });
    });

    /* ------------------------------------------------------------ */
    await group('常见问题（FAQ）折叠', async () => {
      await desktop();
      await fresh('/rankings/2026/');

      await t('点击问题展开答案，再点另一题时前一题收起，箭头翻转', async () => {
        const n = await js(page, () => document.querySelectorAll('details.faq-item').length);
        expect(n >= 2, `FAQ 只有 ${n} 条`);
        await page.click('details.faq-item > summary', 0);
        await sleep(300);
        let s = await js(page, () => {
          const d = [...document.querySelectorAll('details.faq-item')];
          return { open: d.map((x) => x.open), ans: d[0].querySelector('.faq-a').getBoundingClientRect().height, tr: getComputedStyle(d[0].querySelector('.faq-chevron')).transform, tr2: getComputedStyle(d[1].querySelector('.faq-chevron')).transform };
        });
        expect(s.open[0] && s.ans > 0, '第一题未展开');
        expect(s.tr !== 'none' && s.tr !== s.tr2, `展开后箭头未翻转（${s.tr}）`);
        await page.click('details.faq-item > summary', 1);
        await sleep(300);
        s = await js(page, () => ({ open: [...document.querySelectorAll('details.faq-item')].map((x) => x.open) }));
        expect(s.open[1] && !s.open[0], `第二题展开后状态：${s.open.join(',')}`);
        await page.click('details.faq-item > summary', 1);
        await sleep(200);
        s = await js(page, () => ({ open: [...document.querySelectorAll('details.faq-item')].map((x) => x.open) }));
        expect(!s.open[1], '再次点击未收起');
        return `${n} 条`;
      });

      await t('键盘可操作：Tab 聚焦后回车展开', async () => {
        await js(page, () => document.querySelector('details.faq-item > summary').focus());
        await page.press('Enter');
        await sleep(200);
        expect(await js(page, () => document.querySelector('details.faq-item').open), '回车未展开');
      });
    });

    /* ------------------------------------------------------------ */
    await group('收藏、阅读记录与偏好（个人中心）', async () => {
      await desktop();
      await fresh('/reviews/lingdongyun/');

      await t('品牌页“收藏”按钮切换状态', async () => {
        await page.click('.fav-btn');
        const s = await js(page, () => ({ pressed: document.querySelector('.fav-btn').getAttribute('aria-pressed'), label: document.querySelector('.fav-btn .fav-label').textContent, saved: JSON.parse(localStorage.getItem('jz-favorites') || '[]').length }));
        expect(s.pressed === 'true' && s.label === '已收藏' && s.saved === 1, JSON.stringify(s));
      });

      await t('文章页收藏 + 自动记录阅读', async () => {
        await open('/tutorials/clash-verge-rev-jiaocheng/');
        await page.click('.fav-btn');
        const s = await js(page, () => ({ fav: JSON.parse(localStorage.getItem('jz-favorites') || '[]').length, his: JSON.parse(localStorage.getItem('jz-history') || '[]').length }));
        expect(s.fav === 2 && s.his >= 2, JSON.stringify(s));
        return `收藏 ${s.fav}，阅读记录 ${s.his}`;
      });

      await t('个人中心列出收藏与阅读记录，首屏无布局跳动', async () => {
        await open('/me/');
        const s = await js(page, () => ({ fav: document.querySelectorAll('#fav-list li').length, his: document.querySelectorAll('#his-list li').length, statFav: document.getElementById('stat-fav').textContent, statHis: document.getElementById('stat-his').textContent, favEmpty: document.getElementById('fav-empty').hidden, removeBtns: document.querySelectorAll('#fav-list li button').length, titles: [...document.querySelectorAll('#fav-list li a')].map((a) => a.textContent) }));
        expect(s.fav === 2 && s.statFav === '2' && s.favEmpty && s.removeBtns === 2, JSON.stringify(s));
        expect(s.his >= 2 && s.statHis === String(s.his), `阅读记录 ${s.his}，概览 ${s.statHis}`);
        return s.titles.join('｜').slice(0, 60);
      });

      await t('页头菜单显示收藏 / 记录数量', async () => {
        await page.click('#account-btn');
        const c = await js(page, () => [...document.querySelectorAll('#account-menu .am-count')].map((e) => e.textContent));
        expect(c[0] === '2' && Number(c[1]) >= 2, `数量显示 ${c.join('/')}`);
        await page.press('Escape');
      });

      await t('“移除”收藏、“清空记录”生效', async () => {
        await page.click('#fav-list li button', 0);
        let s = await js(page, () => ({ fav: document.querySelectorAll('#fav-list li').length, saved: JSON.parse(localStorage.getItem('jz-favorites') || '[]').length, stat: document.getElementById('stat-fav').textContent }));
        expect(s.fav === 1 && s.saved === 1 && s.stat === '1', JSON.stringify(s));
        await page.click('#his-clear');
        s = await js(page, () => ({ his: document.querySelectorAll('#his-list li').length, empty: !document.getElementById('his-empty').hidden, stat: document.getElementById('stat-his').textContent }));
        expect(s.his === 0 && s.empty && s.stat === '0', JSON.stringify(s));
      });

      await t('偏好：主题与字号立即生效', async () => {
        const ti = await js(page, () => [...document.querySelectorAll('#prefs-form input[name="theme"]')].findIndex((i) => i.value === 'dark'));
        await page.click('#prefs-form input[name="theme"] + span', ti);
        let s = await js(page, () => ({ theme: document.documentElement.getAttribute('data-theme'), stat: document.getElementById('stat-theme').textContent, pressed: document.getElementById('theme-toggle').getAttribute('aria-pressed') }));
        expect(s.theme === 'dark' && s.stat === '深色', JSON.stringify(s));
        const fi = await js(page, () => [...document.querySelectorAll('#prefs-form input[name="font"]')].findIndex((i) => i.value === 'large'));
        const fsBefore = await js(page, () => getComputedStyle(document.querySelector('.callout p, .me-note p')).fontSize);
        await page.click('#prefs-form input[name="font"] + span', fi);
        s = await js(page, () => ({ font: document.documentElement.getAttribute('data-font'), fs: getComputedStyle(document.querySelector('.callout p, .me-note p')).fontSize }));
        expect(s.font === 'large', `data-font=${s.font}`);
        return `字号 ${fsBefore} → ${s.fs}`;
      });

      await t('“清除全部个人数据”经确认后清空并恢复默认', async () => {
        dialogs.length = 0;
        await page.click('#clear-all');
        await sleep(300);
        const s = await js(page, () => ({ keys: Object.keys(localStorage).filter((k) => k.startsWith('jz-')), fav: document.querySelectorAll('#fav-list li').length, font: document.documentElement.getAttribute('data-font'), stat: document.getElementById('stat-theme').textContent }));
        expect(dialogs.length === 1, `确认对话框出现 ${dialogs.length} 次`);
        expect(s.keys.length === 0 && s.fav === 0 && !s.font && s.stat === '跟随系统', JSON.stringify(s));
      });
    });

    /* ------------------------------------------------------------ */
    await group('联系方式与外部链接', async () => {
      await desktop();
      await fresh('/contact/');

      await t('“复制地址”把邮箱写入剪贴板并给出反馈', async () => {
        const email = await js(page, () => document.querySelector('.cc-copy').dataset.copy);
        await page.click('.cc-copy', 0);
        await sleep(250);
        const s = await js(page, async () => ({ label: document.querySelector('.cc-copy .cc-copy-label').textContent, status: document.querySelector('.cc-status').textContent, clip: await navigator.clipboard.readText().catch((e) => `ERR ${e.message}`) }));
        expect(s.label === '已复制', `按钮文字：${s.label}`);
        expect(s.clip === email, `剪贴板内容不是邮箱地址（读取结果：${String(s.clip).slice(0, 40)}）`);
        return '剪贴板内容与页面邮箱一致';
      });

      await t('邮件链接为 mailto，社交主页在新标签页打开且带 noopener noreferrer', async () => {
        const s = await js(page, () => {
          const cards = [...document.querySelectorAll('.contact-channels .cc-card')];
          const mail = cards.flatMap((c) => [...c.querySelectorAll('a[href^="mailto:"]')]).map((a) => a.getAttribute('href'));
          const ext = cards.flatMap((c) => [...c.querySelectorAll('a[target="_blank"]')]).map((a) => ({ host: new URL(a.href).hostname, rel: a.getAttribute('rel') || '' }));
          const fake = cards.flatMap((c) => [...c.querySelectorAll('a')]).filter((a) => !a.getAttribute('href') || a.getAttribute('href') === '#').length;
          return { n: cards.length, mail, ext, fake };
        });
        expect(s.mail.length === 2 && s.mail.every((m) => /^mailto:[^@\s]+@[^@\s]+$/.test(m)), `mailto 链接：${s.mail.length} 个`);
        expect(s.ext.length >= 1 && s.ext.every((e) => /noopener/.test(e.rel) && /noreferrer/.test(e.rel)), `外链 rel：${JSON.stringify(s.ext)}`);
        expect(s.fake === 0, `存在 ${s.fake} 个空链接`);
        return `${s.n} 个渠道：${s.ext.map((e) => e.host).join('、')}`;
      });

      await t('页头社交图标：已配置的在新标签页打开，未配置的不是链接', async () => {
        const s = await js(page, () => ({
          links: [...document.querySelectorAll('.header-actions a.social-btn')].map((a) => ({ host: new URL(a.href).hostname, rel: a.getAttribute('rel'), target: a.target, name: a.getAttribute('aria-label') })),
          pending: [...document.querySelectorAll('.header-actions .social-btn.is-pending')].map((x) => ({ tag: x.tagName, name: x.getAttribute('aria-label') })),
        }));
        expect(s.links.every((l) => l.target === '_blank' && /noopener/.test(l.rel) && /noreferrer/.test(l.rel) && l.name), JSON.stringify(s.links));
        expect(s.pending.every((p) => p.tag !== 'A'), '未配置链接的图标仍是 <a>');
        return `链接：${s.links.map((l) => l.host).join('、') || '无'}；待补充：${s.pending.map((p) => p.name).join('、') || '无'}`;
      });

      await t('全站外部链接属性（逐页静态核对）', async () => {
        const pages = await js(page, async () => {
          const xml = await fetch('/sitemap.xml').then((r) => r.text());
          return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
        });
        let total = 0;
        const bad = [];
        const hosts = new Set();
        for (const p of pages) {
          const r = await js(page, async (u) => {
            const html = await fetch(u).then((x) => x.text());
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return [...doc.querySelectorAll('a[href^="http"]')]
              .filter((a) => !a.getAttribute('href').startsWith('https://jichang-zhinan.blog'))
              .map((a) => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel') || '', target: a.getAttribute('target') || '' }));
          }, p);
          for (const l of r) {
            total++;
            hosts.add(new URL(l.href).hostname);
            if (l.target === '_blank' && !/noopener/.test(l.rel)) bad.push(`${p} → ${l.href}`);
          }
        }
        expect(bad.length === 0, `新标签页外链缺少 noopener：${bad.slice(0, 3).join('；')}`);
        return `${pages.length} 页、${total} 个外链、${hosts.size} 个域名`;
      });
    });

    /* ------------------------------------------------------------ */
    await group('文章页与品牌页：目录、上下篇、官方入口', async () => {
      await desktop();
      await fresh('/tutorials/clash-verge-rev-jiaocheng/');

      await t('文章目录点击后标题出现在页头下方', async () => {
        const n = await js(page, () => document.querySelectorAll('.toc-inline a').length);
        expect(n > 2, `目录只有 ${n} 项`);
        for (const i of [0, Math.floor(n / 2), n - 1]) {
          await js(page, () => window.scrollTo(0, 0));
          await page.click('.toc-inline a', i);
          await sleep(300);
          const s = await js(page, () => {
            const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
            const hb = document.querySelector('.site-header').getBoundingClientRect().bottom;
            return { hash: location.hash, top: el ? el.getBoundingClientRect().top : null, hb, vh: innerHeight, atBottom: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 };
          });
          expect(s.top !== null, `锚点 ${s.hash} 不存在`);
          expect(s.top >= s.hb - 1 && (s.top < s.vh * 0.6 || s.atBottom), `${s.hash} 位置 ${Math.round(s.top)}（页头底边 ${Math.round(s.hb)}）`);
        }
        return `${n} 项，抽查首 / 中 / 末`;
      });

      await t('上一篇 / 下一篇与同栏目文章可进入', async () => {
        const s = await js(page, () => ({ pn: [...document.querySelectorAll('.prev-next a')].map((a) => a.getAttribute('href')), rel: [...document.querySelectorAll('.related-list a')].length }));
        expect(s.pn.length >= 1, '没有上一篇 / 下一篇链接');
        await page.waitForNavigation(() => page.click('.prev-next a', 0));
        expect((await where(page)) === s.pn[0] && page.lastStatus === 200, `到达 ${await where(page)}`);
        return `上下篇 ${s.pn.length} 个，侧栏链接 ${s.rel} 个`;
      });

      await t('文章内“文中涉及的品牌”卡片可进入品牌页', async () => {
        await open('/tutorials/clash-verge-rev-jiaocheng/');
        const n = await js(page, () => document.querySelectorAll('.related-brands a').length);
        if (!n) return '本文未关联品牌，跳过';
        const href = await js(page, () => document.querySelector('.related-brands a').getAttribute('href'));
        await page.waitForNavigation(() => page.click('.related-brands a', 0));
        expect((await where(page)) === href, `到达 ${await where(page)}`);
        return `${n} 个品牌`;
      });

      await t('品牌页目录跳转不被页头遮住', async () => {
        await open('/reviews/lingdongyun/');
        const n = await js(page, () => document.querySelectorAll('.brand-aside a[href^="#"]').length);
        expect(n > 3, `目录只有 ${n} 项`);
        for (const i of [1, n - 1]) {
          await page.click('.brand-aside a[href^="#"]', i);
          await sleep(300);
          const s = await js(page, () => {
            const el = document.getElementById(location.hash.slice(1));
            const hb = document.querySelector('.site-header').getBoundingClientRect().bottom;
            return { hash: location.hash, top: el ? el.getBoundingClientRect().top : null, hb, atBottom: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 2 };
          });
          expect(s.top !== null && s.top >= s.hb - 1 && (s.top < 600 || s.atBottom), `${s.hash} 位置 ${s.top === null ? '不存在' : Math.round(s.top)}`);
        }
        return `${n} 项`;
      });

      await t('8 个品牌页：官方 / 推广入口属性完整，“与其他品牌对比”与榜单导航可用', async () => {
        const slugs = await js(page, async () => {
          const xml = await fetch('/sitemap.xml').then((r) => r.text());
          return [...xml.matchAll(/<loc>[^<]*\/reviews\/([a-z0-9-]+)\/<\/loc>/g)].map((m) => m[1]);
        });
        expect(slugs.length === 8, `品牌页数量 ${slugs.length}`);
        const notes = [];
        for (const slug of slugs) {
          await open(`/reviews/${slug}/`);
          const s = await js(page, () => {
            const side = document.querySelector('.bh-side');
            const ext = [...side.querySelectorAll('a[target="_blank"]')].map((a) => ({ rel: (a.getAttribute('rel') || '').split(/\s+/), host: new URL(a.href).hostname }));
            const all = [...document.querySelectorAll('main a[target="_blank"]')].filter((a) => new URL(a.href).hostname !== location.hostname).map((a) => (a.getAttribute('rel') || '').split(/\s+/));
            return {
              ext,
              allBad: all.filter((r) => !r.includes('noopener')).length,
              cmp: !!side.querySelector('a[href="/compare/"]'),
              nav: [...document.querySelectorAll('.brand-nav a')].map((a) => a.getAttribute('href')),
              h1: document.querySelectorAll('h1').length,
              sections: ['overview', 'plans', 'speed'].filter((id) => document.getElementById(id)).length,
              intro: !!document.querySelector('.bh-intro'),
            };
          });
          expect(s.ext.every((e) => ['sponsored', 'nofollow', 'noopener', 'noreferrer'].every((k) => e.rel.includes(k))), `${slug} 推广入口 rel 不完整：${JSON.stringify(s.ext)}`);
          expect(s.allBad === 0, `${slug} 有 ${s.allBad} 个新标签页外链缺少 noopener`);
          expect(s.cmp, `${slug} 缺少“与其他品牌对比”`);
          expect(s.nav.length >= 2, `${slug} 榜单上一位 / 下一位导航只有 ${s.nav.length} 项`);
          expect(s.h1 === 1 && s.intro, `${slug} H1 数量 ${s.h1}，品牌介绍 ${s.intro}`);
          notes.push(`${slug}:${s.ext.length}`);
        }
        await page.waitForNavigation(() => page.click('.brand-nav a', 0));
        expect(page.lastStatus === 200, `榜单导航目标状态码 ${page.lastStatus}`);
        return notes.join(' ');
      });
    });

    /* ------------------------------------------------------------ */
    await group('测速报告', async () => {
      await desktop();
      await fresh('/speed-tests/');

      await t('报告卡片与汇总表链接可进入报告页', async () => {
        const hrefs = await js(page, () => [...new Set([...document.querySelectorAll('main a[href^="/speed-tests/"]')].map((a) => a.getAttribute('href')))].filter((h) => h !== '/speed-tests/'));
        expect(hrefs.length >= 4, `报告链接只有 ${hrefs.length} 个`);
        for (const h of hrefs) {
          await open(h);
          expect(page.lastStatus === 200, `${h} 状态码 ${page.lastStatus}`);
          const s = await js(page, () => ({ h1: document.querySelectorAll('h1').length, imgs: [...document.querySelectorAll('main img')].map((i) => ({ alt: i.alt, ok: i.complete && i.naturalWidth > 0, lazy: i.loading })), bars: document.querySelectorAll('.speed-bars .sb-row').length }));
          expect(s.h1 === 1, `${h} H1 数量 ${s.h1}`);
          expect(s.imgs.every((i) => i.alt && i.alt.length > 3), `${h} 存在缺少说明文字的图片`);
        }
        return `${hrefs.length} 份报告`;
      });

      await t('证据图：滚动到位后加载成功，点击可打开原图', async () => {
        await open('/speed-tests/lingdongyun-2026-11-10-japan5/');
        const n = await js(page, () => document.querySelectorAll('.evidence img, .report-figure img').length);
        expect(n > 0, '页面没有证据图');
        const s = await js(page, async () => {
          const imgs = [...document.querySelectorAll('.evidence img, .report-figure img')];
          const out = [];
          for (const img of imgs) {
            img.scrollIntoView({ block: 'center' });
            await new Promise((r) => (img.complete && img.naturalWidth ? r() : (img.addEventListener('load', r, { once: true }), img.addEventListener('error', r, { once: true }), setTimeout(r, 4000))));
            const r = img.getBoundingClientRect();
            const a = img.closest('a');
            out.push({ ok: img.naturalWidth > 0, upscaled: r.width > img.naturalWidth + 1, ratio: Math.abs(r.width / r.height - img.naturalWidth / img.naturalHeight) < 0.02, href: a ? a.getAttribute('href') : null });
          }
          const res = [];
          for (const o of out) if (o.href) res.push((await fetch(o.href, { method: 'HEAD' })).status);
          return { out, res };
        });
        expect(s.out.every((o) => o.ok), '有证据图加载失败');
        expect(s.out.every((o) => !o.upscaled && o.ratio), '有证据图被放大或拉伸变形');
        expect(s.res.every((x) => x === 200), `原图链接状态：${s.res.join(',')}`);
        return `${n} 张，均按原比例显示`;
      });

      await t('速度条形图有数据且数值可读；无数据时显示空状态而非空图', async () => {
        await open('/');
        const s = await js(page, () => ({ rows: document.querySelectorAll('.speed-bars .sb-row').length, values: [...document.querySelectorAll('.speed-bars .sb-value')].map((v) => v.textContent.trim()), widths: [...document.querySelectorAll('.speed-bars .sb-fill')].map((f) => f.getBoundingClientRect().width), over: [...document.querySelectorAll('.speed-bars .sb-row')].filter((r) => r.scrollWidth > r.clientWidth + 1).length }));
        expect(s.rows > 0, '首页条形图没有数据行');
        expect(s.values.every((v) => /\d/.test(v)) && s.widths.every((w) => w > 0), `数值 ${s.values.join('/')}`);
        expect(s.over === 0, `${s.over} 行内容超出`);
        return `${s.rows} 条：${s.values.join('、')}`;
      });
    });

    /* ------------------------------------------------------------ */
    await group('404、RSS、Sitemap 与键盘可达性', async () => {
      await desktop();

      await t('不存在的地址返回 404 状态并显示引导', async () => {
        await open('/this-page-does-not-exist/');
        expect(page.lastStatus === 404, `状态码 ${page.lastStatus}`);
        const s = await js(page, () => ({ h1: document.querySelector('h1').textContent, links: document.querySelectorAll('.nf-links a').length, robots: (document.querySelector('meta[name="robots"]') || {}).content || '' }));
        expect(/不存在/.test(s.h1) && s.links >= 3, JSON.stringify(s));
        expect(/noindex/.test(s.robots), `404 页 robots：${s.robots}`);
        await page.click('.nf-search input[name="q"]');
        await page.type('教程');
        await page.waitForNavigation(() => page.press('Enter'));
        expect((await where(page)).startsWith('/search/?q='), `到达 ${await where(page)}`);
        return `${s.links} 个引导链接，搜索可用`;
      });

      await t('RSS、Sitemap、robots.txt、搜索索引可访问', async () => {
        await open('/');
        const s = await js(page, async () => {
          const get = async (u) => {
            const r = await fetch(u);
            return { status: r.status, type: r.headers.get('content-type') || '', text: await r.text() };
          };
          const rss = await get('/rss.xml');
          const sm = await get('/sitemap.xml');
          const rb = await get('/robots.txt');
          const si = await get('/search-index.json');
          return {
            rss: { status: rss.status, items: (rss.text.match(/<item>/g) || []).length },
            sitemap: { status: sm.status, urls: (sm.text.match(/<loc>/g) || []).length, me: /\/me\//.test(sm.text), search: /\/search\//.test(sm.text) },
            robots: { status: rb.status, sitemap: /Sitemap:\s*https:\/\/jichang-zhinan\.blog\/sitemap\.xml/.test(rb.text) },
            index: { status: si.status, n: JSON.parse(si.text).length },
          };
        });
        expect(s.rss.status === 200 && s.rss.items > 0, `RSS ${JSON.stringify(s.rss)}`);
        expect(s.sitemap.status === 200 && s.sitemap.urls > 0 && !s.sitemap.me && !s.sitemap.search, `Sitemap ${JSON.stringify(s.sitemap)}`);
        expect(s.robots.status === 200 && s.robots.sitemap, `robots ${JSON.stringify(s.robots)}`);
        expect(s.index.status === 200 && s.index.n > 0, `搜索索引 ${JSON.stringify(s.index)}`);
        return `RSS ${s.rss.items} 条，Sitemap ${s.sitemap.urls} 个地址，搜索索引 ${s.index.n} 条`;
      });

      await t('“跳到正文”链接：Tab 首先聚焦并可见，回车跳到主内容', async () => {
        await open('/rankings/2026/');
        await page.press('Tab');
        let s = await js(page, () => {
          const a = document.activeElement;
          const r = a.getBoundingClientRect();
          return { cls: a.className, top: r.top, h: r.height, href: a.getAttribute('href') };
        });
        expect(/skip-link/.test(s.cls) && s.top >= 0 && s.h > 0, `首个焦点：${JSON.stringify(s)}`);
        await page.press('Enter');
        await sleep(150);
        s = await js(page, () => ({ hash: location.hash, main: !!document.querySelector(location.hash || '#x') }));
        expect(s.hash === '#main' && s.main, JSON.stringify(s));
      });

      await t('键盘 Tab 顺序：页头控件依次可达且有可见焦点样式', async () => {
        await open('/');
        const seen = [];
        for (let i = 0; i < 14; i++) {
          await page.press('Tab');
          const s = await js(page, () => {
            const a = document.activeElement;
            const cs = getComputedStyle(a);
            const r = a.getBoundingClientRect();
            return { name: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 12), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, shadow: cs.boxShadow !== 'none', vis: r.width > 0 && r.height > 0 };
          });
          seen.push(s);
        }
        const noRing = seen.filter((s) => s.vis && !s.outline && !s.shadow);
        expect(seen.every((s) => s.vis), '焦点落到了不可见元素上');
        expect(noRing.length === 0, `无焦点样式：${noRing.map((s) => s.name).join('、')}`);
        return seen.map((s) => s.name).filter(Boolean).slice(0, 8).join(' → ');
      });

      await t('减少动态效果偏好下：过渡 / 动画被关闭，轮播不自动播放', async () => {
        await page.setMedia({ scheme: 'light', reducedMotion: 'reduce' });
        await open('/');
        const s = await js(page, async () => {
          const card = document.querySelector('.card-hover') || document.querySelector('.btn');
          const before = [...document.querySelectorAll('#feature-track .slide')].findIndex((x) => x.classList.contains('active'));
          await new Promise((r) => setTimeout(r, 7600));
          const after = [...document.querySelectorAll('#feature-track .slide')].findIndex((x) => x.classList.contains('active'));
          return { dur: getComputedStyle(card).transitionDuration, scroll: getComputedStyle(document.documentElement).scrollBehavior, before, after };
        });
        await page.setMedia({ scheme: 'light' });
        expect(parseFloat(s.dur) < 0.01 && s.scroll === 'auto', `过渡时长 ${s.dur}，滚动 ${s.scroll}`);
        expect(s.before === s.after, `轮播在 7.6 秒内自动切换了（${s.before} → ${s.after}）`);
      });
    });

    /* ------------------------------------------------------------ */
    await group('手机：菜单、搜索与表格（375px）', async () => {
      await phone(375);
      await fresh('/');

      await t('汉堡按钮打开导航，子菜单可展开，链接可点', async () => {
        await page.click('#nav-burger');
        let s = await js(page, () => {
          const nav = document.getElementById('main-nav');
          const r = nav.getBoundingClientRect();
          return { open: nav.classList.contains('open'), h: r.height, exp: document.getElementById('nav-burger').getAttribute('aria-expanded'), label: document.getElementById('nav-burger').getAttribute('aria-label'), w: r.width, over: document.documentElement.scrollWidth - innerWidth, scrollable: nav.scrollHeight > nav.clientHeight ? getComputedStyle(nav).overflowY : 'fits' };
        });
        expect(s.open && s.h > 100 && s.exp === 'true' && s.label === '关闭菜单', JSON.stringify(s));
        expect(s.over <= 0, `打开菜单后页面横向溢出 ${s.over}px`);
        await page.click('.nav-toggle', 0);
        const d = await js(page, () => {
          const item = document.querySelector('.nav-item.has-children');
          return { open: item.hasAttribute('data-open'), h: item.querySelector('.nav-dropdown').getBoundingClientRect().height, n: item.querySelectorAll('.nav-dropdown a').length };
        });
        expect(d.open && d.h > 0, `子菜单未展开 ${JSON.stringify(d)}`);
        const href = await js(page, () => document.querySelector('.nav-item[data-open] .nav-dropdown a').getAttribute('href'));
        await page.waitForNavigation(() => page.click('.nav-item[data-open] .nav-dropdown a', 0));
        expect((await where(page)) === href, `到达 ${await where(page)}`);
        return `子菜单 ${d.n} 项；导航面板高度 ${Math.round(s.h)}px（${s.scrollable}）`;
      });

      await t('导航面板内每个一级入口都能点到（不被遮挡）', async () => {
        await open('/');
        await page.click('#nav-burger');
        const n = await js(page, () => document.querySelectorAll('.nav-list > .nav-item > .nav-link').length);
        for (let i = 0; i < n; i++) await page.locate('.nav-list > .nav-item > .nav-link', i);
        const social = await js(page, () => [...document.querySelectorAll('#main-nav .nav-social a')].filter((a) => a.getBoundingClientRect().height > 0).length);
        return `${n} 个入口，社交链接 ${social} 个`;
      });

      await t('Esc 关闭导航并把焦点还给按钮，按钮名称复位', async () => {
        await page.press('Escape');
        const s = await js(page, () => ({ open: document.getElementById('main-nav').classList.contains('open'), exp: document.getElementById('nav-burger').getAttribute('aria-expanded'), label: document.getElementById('nav-burger').getAttribute('aria-label'), focus: document.activeElement.id }));
        expect(!s.open && s.exp === 'false' && s.label === '打开菜单' && s.focus === 'nav-burger', JSON.stringify(s));
      });

      await t('搜索对话框与个人中心菜单不超出屏幕', async () => {
        await page.click('#search-open');
        await sleep(200);
        let s = await js(page, () => {
          const r = document.getElementById('search-dialog').getBoundingClientRect();
          return { open: document.getElementById('search-dialog').open, l: r.left, r: r.right, vw: innerWidth };
        });
        expect(s.open && s.l >= 0 && s.r <= s.vw, `搜索框位置 ${Math.round(s.l)}–${Math.round(s.r)} / ${s.vw}`);
        await page.type('机场');
        await sleep(500);
        const live = await js(page, () => document.querySelectorAll('#search-live a').length);
        await page.click('.search-close');
        await page.click('#account-btn');
        s = await js(page, () => {
          const r = document.getElementById('account-menu').getBoundingClientRect();
          return { hidden: document.getElementById('account-menu').hidden, l: r.left, r: r.right, vw: innerWidth, h: r.height };
        });
        expect(!s.hidden && s.l >= 0 && s.r <= s.vw && s.h > 0, `菜单位置 ${Math.round(s.l)}–${Math.round(s.r)} / ${s.vw}`);
        await page.clickAt(20, 700);
        expect(await js(page, () => document.getElementById('account-menu').hidden), '点击外部未关闭');
        return `即时结果 ${live} 条`;
      });

      await t('首页栏目标签与轮播在手机上可操作', async () => {
        await open('/');
        await page.click('.tabs .tab', 1);
        const s = await js(page, () => {
          const cards = [...document.querySelectorAll('#latest-list .article-card')];
          const vis = cards.filter((c) => c.getBoundingClientRect().height > 0);
          const cat = document.querySelector('.tabs .tab[aria-selected="true"]').dataset.filter;
          return { vis: vis.length, wrong: vis.filter((c) => c.dataset.category !== cat).length };
        });
        expect(s.vis > 0 && s.wrong === 0, JSON.stringify(s));
        const a = await js(page, () => [...document.querySelectorAll('#feature-track .slide')].findIndex((x) => x.classList.contains('active')));
        await page.click('.carousel-btn[data-dir="1"]');
        const b = await js(page, () => [...document.querySelectorAll('#feature-track .slide')].findIndex((x) => x.classList.contains('active')));
        expect(a !== b, '轮播未切换');
      });

      await t('对比表可横向滚动且页面本身不溢出', async () => {
        await open('/compare/');
        const s = await js(page, () => {
          const w = document.querySelector('.table-wrap');
          const before = w.scrollLeft;
          w.scrollLeft = 200;
          const moved = w.scrollLeft;
          w.scrollLeft = before;
          return { scrollable: w.scrollWidth > w.clientWidth + 1, moved, pageOver: document.documentElement.scrollWidth - innerWidth, firstColMin: Math.min(...[...document.querySelectorAll('#cmp-table tbody td:first-child')].map((td) => td.getBoundingClientRect().width)) };
        });
        expect(s.scrollable && s.moved > 0, `表格容器无法横向滚动 ${JSON.stringify(s)}`);
        expect(s.pageOver <= 0, `页面横向溢出 ${s.pageOver}px`);
        return `品牌列最窄 ${Math.round(s.firstColMin)}px`;
      });

      await t('品牌筛选在手机上可用', async () => {
        await open('/reviews/');
        const idx = await js(page, () => [...document.querySelectorAll('#brand-filter input[name="region"]')].findIndex((i) => i.value === '韩国'));
        await page.click('#brand-filter input[name="region"] + span', idx);
        const s = await js(page, () => {
          const cards = [...document.querySelectorAll('#brand-list .brand-item')];
          const vis = cards.filter((c) => c.getBoundingClientRect().height > 0);
          return { total: cards.length, vis: vis.length, ok: vis.every((c) => c.dataset.regions.split('|').includes('韩国')), over: document.documentElement.scrollWidth - innerWidth };
        });
        expect(s.vis > 0 && s.vis < s.total && s.ok && s.over <= 0, JSON.stringify(s));
        return `含“韩国”的品牌 ${s.vis} / ${s.total} 个`;
      });

      await t('联系方式按钮在手机上可点，复制有反馈', async () => {
        await open('/contact/');
        await page.click('.cc-copy', 1);
        await sleep(250);
        const label = await js(page, () => document.querySelectorAll('.cc-copy .cc-copy-label')[1].textContent);
        expect(label === '已复制', `按钮文字：${label}`);
      });
    });

    /* ------------------------------------------------------------ */
    await group('小屏手机（320px）：页头不重叠', async () => {
      await phone(320);
      await fresh('/');

      await t('页头四个按钮互不遮挡、均可点击', async () => {
        for (const sel of ['#search-open', '#theme-toggle', '#account-btn', '#nav-burger']) await page.locate(sel);
        const s = await js(page, () => ({ over: document.documentElement.scrollWidth - innerWidth, hw: document.querySelector('.header-inner').scrollWidth - document.querySelector('.header-inner').clientWidth }));
        expect(s.over <= 0 && s.hw <= 0, `页面溢出 ${s.over}px，页头溢出 ${s.hw}px`);
        await page.click('#nav-burger');
        expect(await js(page, () => document.getElementById('main-nav').classList.contains('open')), '菜单未打开');
        await page.click('#nav-burger');
        expect(!(await js(page, () => document.getElementById('main-nav').classList.contains('open'))), '菜单未关闭');
      });

      await t('个人中心在 320px 无横向溢出', async () => {
        await open('/me/');
        const s = await js(page, () => ({ over: document.documentElement.scrollWidth - innerWidth, statLines: [...document.querySelectorAll('.me-stats dt')].map((d) => Math.round(d.getBoundingClientRect().height)) }));
        expect(s.over <= 0, `溢出 ${s.over}px`);
        expect(Math.max(...s.statLines) < 30, `统计标签折行：${s.statLines.join(',')}`);
      });
    });
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  const groups = [...new Set(results.map((r) => r.group))];
  const summary = { generatedAt: new Date().toISOString(), browser: browser.product, total: results.length, passed: results.length - failed.length, failed: failed.length, groups: groups.length };
  await fsp.mkdir(path.dirname(outFile), { recursive: true });
  await fsp.writeFile(outFile, JSON.stringify({ summary, results }, null, 1));
  console.log(`\n[ui-interactions] ${summary.total} 项交互用例：通过 ${summary.passed}，失败 ${summary.failed}（${groups.length} 组）`);
  for (const f of failed) console.log(`  ✗ ${f.group}｜${f.name}：${f.error}`);
  console.log(`[ui-interactions] 报告已写入 ${path.relative(root, outFile)}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[ui-interactions] 失败：', e);
  process.exit(1);
});
