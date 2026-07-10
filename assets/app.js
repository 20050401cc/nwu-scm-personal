/* =====================================================================
 * 食堂供应链系统 —— 前端应用（纯原生 JS，无框架，无后端）
 * 复刻：采购 / 调拨 双流程 + 档口/餐厅/中心库/供应商/财务 五角色
 * 优化：合并冗余确认、待办聚合、批量操作、快捷键、列表搜索、响应式
 *
 * 本文件为 ES Module，仅消费 scm-core 的领域能力，自身不持有业务规则。
 * 渲染策略：renderApp() 重建外壳（侧栏/顶栏/角标），viewHtml() 仅填充
 *           #content 并 bindContent() 重新绑定；搜索时只刷新内容，不重建外壳。
 * ===================================================================== */
import { SEED, coreStore, PROCURE_TRANS, TRANSFER_TRANS, ACTION_ROLES } from './scm-core.js';

const Store = coreStore;
const S = Store;
let view = 'inbox';     // inbox | procure | transfer | create | optimize | detail
let selId = null;
let lastList = 'inbox'; // 进入明细前的列表视图，用于「返回」与高亮
let q = '';             // 当前列表搜索关键字
let mineOnly = false;   // 列表是否仅看「我发起的」
let pickRows = [];
let pickTransfer = false;

/* ---------- 导航定义（顺序即数字快捷键 1-5） ---------- */
const NAV = [
  { view: 'inbox',    label: '待办' },
  { view: 'procure',  label: '采购单据' },
  { view: 'transfer', label: '调拨单据' },
  { view: 'create',   label: '新建单据' },
  { view: 'optimize', label: '优化说明' },
];

/* ---------------- 工具 ---------------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function statusClass(doc) {
  // 采购 + 调拨全状态映射（调拨新增 RECHECKED / SIGNED）
  const m = {
    SUBMITTED: 'b-sub', REVIEWED: 'b-pro', ORDERED: 'b-pro', PICKED: 'b-pro',
    OUTBOUND: 'b-pro', DISPATCHED: 'b-warn', ACCEPTED: 'b-pro', SETTLED: 'b-pro',
    FINISHED: 'b-done', RECHECKED: 'b-pro', SIGNED: 'b-done',
  };
  return m[doc.status] || 'b-sub';
}
// 动作 -> 中文标签（消除散落三处的 PROCURE_TRANS/TRANSFER_TRANS 查表）
function labelOf(doc, action) {
  return (doc.type === 'procure' ? PROCURE_TRANS : TRANSFER_TRANS)[action].label;
}
// 金额格式化：¥1,234.00
function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800);
}
// 列表搜索匹配：单号 / 主题 / 状态 / 类型 / 对应供应商
function matchDoc(d, kw) {
  if (!kw) return true;
  const sup = docSuppliers(d).join(' ');
  const hay = (d.no + ' ' + docTitle(d) + ' ' + S.statusLabel(d) + ' ' +
    (d.type === 'procure' ? '采购' : '调拨') + ' ' + sup).toLowerCase();
  return hay.includes(kw.toLowerCase());
}

/* ---------------- 登录 ---------------- */
function renderLogin() {
  const roles = ['档口', '餐厅', '中心库', '供应商', '财务'];
  const users = SEED.users;
  const byRole = {};
  roles.forEach(r => byRole[r] = users.filter(u => u.role === r));

  const app = $('#app');
  app.className = 'login-wrap';
  app.innerHTML = `
    <div class="login-card">
      <h1>西北大学后勤供应链</h1>
      <p class="sub">采购 · 调拨 双流程协同平台 · 餐厅 / 档口 / 供应商 / 财务 一体管理</p>
      <div class="role-tabs" id="roleTabs">
        ${roles.map((r, i) => `<span class="role-tab ${i === 0 ? 'active' : ''}" data-role="${r}">${r}</span>`).join('')}
      </div>
      <div class="field">
        <label>账户</label>
        <select id="accountSel"></select>
      </div>
      <div class="field">
        <label>密码</label>
        <input id="pwdInput" value="0000" />
      </div>
      <button class="btn block" id="loginBtn">登录</button>
      <p class="hint">测试账户密码统一为 0000。选择角色后从下拉选取账户，可一键登录体验对应视角。首次进入已预置多笔演示单据，切换不同角色可查看各自的「待办」与全流程进度。</p>
    </div>`;

  let curRole = roles[0];
  function fillAccounts() {
    const sel = $('#accountSel');
    if (curRole === '档口') {
      // 按所属餐厅分组，明确「档口 → 对应餐厅」
      const groups = {};
      byRole[curRole].forEach(u => { (groups[u.restaurant] = groups[u.restaurant] || []).push(u); });
      sel.innerHTML = Object.keys(groups).map(rest =>
        `<optgroup label="${esc(rest)}">${groups[rest].map(u =>
          `<option value="${esc(u.account)}">${esc(u.name)}（${esc(u.account)}）</option>`).join('')}</optgroup>`
      ).join('');
    } else if (curRole === '供应商') {
      // 供应商按经营品类分组，方便快速定位
      const groups = {};
      byRole[curRole].forEach(u => { (groups[u.category] = groups[u.category] || []).push(u); });
      sel.innerHTML = Object.keys(groups).map(cat =>
        `<optgroup label="${esc(cat)}">${groups[cat].map(u =>
          `<option value="${esc(u.account)}">${esc(u.name)}（${esc(u.account)}）</option>`).join('')}</optgroup>`
      ).join('');
    } else {
      sel.innerHTML = byRole[curRole].map(u =>
        `<option value="${esc(u.account)}">${esc(u.name)}（${esc(u.account)}）</option>`).join('');
    }
  }
  fillAccounts();
  $('#roleTabs').addEventListener('click', e => {
    const t = e.target.closest('.role-tab'); if (!t) return;
    $all('.role-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); curRole = t.dataset.role; fillAccounts();
  });
  $('#loginBtn').addEventListener('click', () => {
    const acc = $('#accountSel').value, pwd = $('#pwdInput').value;
    const res = S.login(acc, pwd);
    if (!res.ok) { toast(res.error); return; }
    enterApp();
  });
}

/* ---------------- 导航 / 外壳 ---------------- */
function enterApp() { view = 'inbox'; selId = null; q = ''; lastList = 'inbox'; renderApp(); }

function activeNav() { return view === 'detail' ? lastList : view; }

function go(v) {
  view = v; selId = null; q = '';
  if (v === 'inbox' || v === 'procure' || v === 'transfer') lastList = v;
  renderApp();
}

function renderApp() {
  const u = S.currentUser();
  const inboxCount = S.inbox(u).length;
  const app = $('#app');
  app.className = 'app';

  const navHtml = NAV.map(n => {
    const isActive = activeNav() === n.view;
    const badge = (n.view === 'inbox' && inboxCount) ? `<span class="badge">${inboxCount}</span>` : '';
    return `<div class="nav-item ${isActive ? 'active' : ''}" data-view="${n.view}">${n.label}${badge}</div>`;
  }).join('');

  app.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="brand">西北大学后勤<small>供应链协同平台</small></div>
      ${navHtml}
      <div class="nav-item" data-view="reset">重置数据</div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div class="row">
          <button class="icon-btn menu-btn" id="menuBtn" aria-label="菜单">☰</button>
          <div><b>${esc(u.name)}</b> <span class="tag">${esc(u.role)}</span></div>
        </div>
        <div class="who">当前角色视角 · <a id="logoutLink" style="cursor:pointer">退出</a></div>
      </div>
      <div class="content" id="content"></div>
    </main>`;

  $all('.nav-item').forEach(n => n.addEventListener('click', () => {
    const v = n.dataset.view;
    if (v === 'reset') {
      if (confirm('确定清空所有单据并恢复初始数据？')) {
        S.reset();
        if (S.needSeed()) { seedDemo(); S.markSeeded(); }
        toast('已重置'); enterApp();
      }
      return;
    }
    go(v); closeSidebar();
  }));
  $('#logoutLink').addEventListener('click', () => { S.logout(); renderLogin(); });
  const mb = $('#menuBtn'); if (mb) mb.addEventListener('click', toggleSidebar);

  $('#content').innerHTML = viewHtml(u);
  bindContent(u);
}

// 当前视图的内容 HTML（renderApp 与搜索刷新共用）
function viewHtml(u) {
  if (view === 'inbox') return renderInbox(u);
  if (view === 'procure') return renderDocList('procure', u);
  if (view === 'transfer') return renderDocList('transfer', u);
  if (view === 'create') return renderCreate();
  if (view === 'optimize') return renderOptimize();
  if (view === 'detail') return renderDetail(selId);
  return '';
}

/* ---------------- 待办 ---------------- */
function renderInbox(u) {
  const docs = S.inbox(u).filter(d => matchDoc(d, q));
  let html = `<div class="page-head"><div><h2>待办</h2><div class="desc">按角色聚合的本环节待处理单据，支持多选批量操作与搜索。</div></div></div>`;
  html += `<div class="toolbar">
    <input class="search" id="searchInput" placeholder="搜索单号 / 主题 / 状态…" value="${esc(q)}">
    <span class="hint">${q ? `匹配 ${docs.length} 条` : ''}</span>
  </div>`;
  if (!docs.length) {
    html += `<div class="card empty">${q ? '没有匹配「' + esc(q) + '」的待办' : '当前角色暂无待办 🎉'}</div>`;
    return html;
  }
  html += `<div class="card">
    <div class="row" style="margin-bottom:10px">
      <button class="btn ok sm" id="batchBtn">批量执行本环节操作</button>
      <span class="hint" id="batchHint"></span>
    </div>
    <table><thead><tr>
      <th style="width:34px"><input type="checkbox" id="checkAll" class="check"></th>
      <th>单号</th><th>类型</th><th>主题</th><th>对应供应商</th><th>状态</th><th>当前动作</th>
    </tr></thead><tbody>`;
  docs.forEach(d => {
    const act = S.actionsFor(d, u)[0];
    const label = labelOf(d, act);
    const supNames = docSuppliers(d).join('、') || '—';
    html += `<tr data-id="${esc(d.id)}" class="rowclick">
      <td><input type="checkbox" class="check rowchk" value="${d.id}"></td>
      <td>${esc(d.no)}</td>
      <td>${d.type === 'procure' ? '采购' : '调拨'}</td>
      <td>${esc(docTitle(d))}</td>
      <td title="${esc(supNames)}">${esc(supNames)}</td>
      <td><span class="badge ${statusClass(d)}">${esc(S.statusLabel(d))}</span></td>
      <td><span class="tag">${esc(label)}</span></td></tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

/* ---------------- 单据列表 ---------------- */
function renderDocList(type, u) {
  const all = S.allDocs().filter(d => d.type === type);
  const docs = all.filter(d => matchDoc(d, q) && (!mineOnly || (d.applicant && d.applicant.account === u.account)));
  const title = type === 'procure' ? '采购单据' : '调拨单据';
  let html = `<div class="page-head"><div><h2>${title}</h2>
    <div class="desc">全部${title}（共 ${all.length} 笔），点击查看明细与可执行操作。</div></div></div>`;
  html += `<div class="toolbar">
    <div class="row" style="gap:6px;margin-bottom:8px">
      <button class="role-tab ${!mineOnly ? 'active' : ''}" data-mine="0">全部</button>
      <button class="role-tab ${mineOnly ? 'active' : ''}" data-mine="1">我发起的</button>
    </div>
    <input class="search" id="searchInput" placeholder="搜索单号 / 主题 / 状态…" value="${esc(q)}">
    <span class="hint">${q ? `匹配 ${docs.length}/${all.length}` : (mineOnly ? `我发起的 ${docs.length} 笔` : '')}</span>
  </div>`;
  if (!docs.length) {
    html += `<div class="card empty">${q ? '没有匹配「' + esc(q) + '」的单据' : '暂无单据，去「新建单据」发起一笔。'}</div>`;
    return html;
  }
  html += `<div class="card"><table><thead><tr>
    <th>单号</th><th>主题</th><th>对应供应商</th><th>${type === 'procure' ? '申购仓' : '调出→调入'}</th>
    <th>状态</th><th>我的操作</th></tr></thead><tbody>`;
  docs.slice().reverse().forEach(d => {
    const acts = S.actionsFor(d, u);
    const actHtml = acts.length
      ? `<button class="btn sm ok act-btn" data-id="${d.id}" data-act="${acts[0]}">${esc(labelOf(d, acts[0]))}</button>`
      : '<span class="hint">—</span>';
    const supNames = docSuppliers(d).join('、') || '—';
    html += `<tr data-id="${esc(d.id)}" class="rowclick">
      <td>${esc(d.no)}</td>
      <td>${esc(docTitle(d))}</td>
      <td title="${esc(supNames)}">${esc(supNames)}</td>
      <td>${esc(type === 'procure' ? whName(d.warehouse) : whName(d.outWh) + ' → ' + whName(d.inWh))}</td>
      <td><span class="badge ${statusClass(d)}">${esc(S.statusLabel(d))}</span></td>
      <td>${actHtml}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

/* ---------------- 新建单据 ---------------- */
function renderCreate() {
  const u = S.currentUser();
  const canProcure = ACTION_ROLES.create_procure.includes(u.role);
  const canTransfer = ACTION_ROLES.create_transfer.includes(u.role);
  pickRows = [];
  let html = `<div class="page-head"><div><h2>新建单据</h2>
    <div class="desc">发起一笔采购申购或库存调拨。</div></div></div>`;
  if (!canProcure && !canTransfer) { html += `<div class="card empty">当前角色（${esc(u.role)}）无权新建单据。</div>`; return html; }

  // 仅渲染当前角色有权限的类型标签，默认选中第一个可用类型
  const tabs = [];
  if (canProcure) tabs.push('procure');
  if (canTransfer) tabs.push('transfer');
  const activeType = tabs[0];
  html += `<div class="card"><div class="role-tabs" id="typeTabs">
    ${tabs.map(t => `<span class="role-tab ${t === activeType ? 'active' : ''}" data-type="${t}">${t === 'procure' ? '采购申购' : '库存调拨'}</span>`).join('')}
  </div><div id="formArea"></div></div>`;
  return html;
}

function renderCreateForm(type) {
  const u = S.currentUser();
  pickTransfer = (type === 'transfer');
  pickRows = [];
  const warehouses = SEED.warehouses;
  const defWh = u.wh || 'WH-ZJY';
  let html = '';
  if (type === 'procure') {
    const locked = !!u.wh;
    html += `<div class="field"><label>申购仓库${locked ? '（本仓，已锁定）' : ''}</label>
      <select id="whSel" ${locked ? 'disabled' : ''}>${warehouses.map(w => `<option value="${w.id}" ${w.id === defWh ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>`;
  } else {
    html += `<div class="field"><label>调出仓库</label>
      <select id="outWhSel">${warehouses.map(w => `<option value="${w.id}" ${w.id === defWh ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
      <div class="field"><label>调入仓库</label>
      <select id="inWhSel">${warehouses.filter(w => w.id !== defWh).map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></div>`;
  }
  html += `<div class="field"><label>商品明细</label><div id="picker"></div>
    <button class="btn ghost sm" id="addRow">+ 添加商品</button></div>
    <button class="btn ok" id="submitDoc">提交${type === 'procure' ? '申购单' : '调拨申请'}</button>`;
  return html;
}

// 商品选项：直接以内联 selected 生成，避免原先对 optgroup 做正则 replace 的脆弱写法
function productOptions(selectedId) {
  const grouped = {};
  SEED.products.forEach(p => (grouped[p.category] = grouped[p.category] || []).push(p));
  return Object.keys(grouped).map(cat =>
    `<optgroup label="${esc(cat)}">${grouped[cat].map(p =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
}
function specOptions(p, selSpec) {
  return p.specs.map(s =>
    `<option value="${esc(s.name)}" ${s.name === selSpec ? 'selected' : ''}>${esc(s.name)}（${esc(s.unit)}）</option>`).join('');
}
// 供应商选项：仅列出与商品品类匹配的供应商，确保「供应商对应上自己的商品」
function supplierOptions(p, selectedId) {
  const list = SEED.suppliers.filter(s => s.account === p.supplier);
  return list.map(s =>
    `<option value="${s.account}" ${s.account === selectedId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}

function renderPicker() {
  const products = SEED.products;
  const rows = pickRows.map((r, i) => {
    const p = products.find(x => x.id === r.productId) || products[0];
    const supId = r.supplierId || p.supplier;
    const spec = p.specs.find(s => s.name === r.spec) || p.specs[0];
    return `<div class="pick-row" data-i="${i}">
      <select class="pr-prod">${productOptions(r.productId)}</select>
      <select class="pr-spec">${specOptions(p, r.spec)}</select>
      <input class="pr-qty" type="number" min="1" value="${r.qty || 1}">
      <span class="pr-unit">${esc(spec.unit)} · ¥${fmtMoney(p.price)}</span>
      <select class="pr-sup" title="对应供应商">${supplierOptions(p, supId)}</select>
      <button class="btn ghost sm pr-del">×</button>
    </div>`;
  }).join('');
  return rows || `<div class="hint">尚未添加商品。</div>`;
}

/* ---------------- 明细 ---------------- */
function renderDetail(id) {
  const d = S.getDoc(id); if (!d) return `<div class="card empty">单据不存在</div>`;
  const u = S.currentUser();
  const acts = S.actionsFor(d, u);
  let html = `<div class="page-head"><div><h2>${esc(d.no)} · ${esc(docTitle(d))}</h2>
    <div class="desc">${d.type === 'procure' ? '采购' : '调拨'} · <span class="badge ${statusClass(d)}">${esc(S.statusLabel(d))}</span></div></div>
    <div class="row">
      <button class="btn ghost sm" id="backBtn">← 返回</button>
      ${acts.length ? `<button class="btn ok" id="detailAct" data-id="${d.id}" data-act="${acts[0]}">${esc(labelOf(d, acts[0]))}</button>` : ''}
    </div></div>`;

  html += `<div class="card"><dl class="kv">
    <dt>发起方</dt><dd>${esc(d.applicant.name)}（${esc(d.applicant.role)}）</dd>
    ${d.type === 'procure'
      ? `<dt>申购仓库</dt><dd>${esc(whName(d.warehouse))}</dd>`
      : `<dt>调出 / 调入</dt><dd>${esc(whName(d.outWh))} → ${esc(whName(d.inWh))}</dd>`}
    <dt>创建时间</dt><dd>${esc(d.createdAt)}</dd>
  </dl></div>`;

  html += stepBanner(d, u);

  html += `<div class="card"><h3 style="margin-top:0">商品明细</h3><table><thead><tr>
    <th>商品</th><th>规格</th><th>单位</th><th>供应商</th><th class="num">单价</th><th class="num">数量</th><th class="num">金额</th></tr></thead><tbody>`;
  d.items.forEach(it => {
    const up = (it.unitPrice != null ? it.unitPrice : (SEED.products.find(x => x.id === it.productId) || {}).price) || 0;
    const amt = (it.amount != null ? it.amount : up * it.qty) || 0;
    html += `<tr><td>${esc(it.productName)}</td><td>${esc(it.spec)}</td><td>${esc(it.unit)}</td><td>${esc(supName(itemSupId(it)))}</td><td class="num">¥${fmtMoney(up)}</td><td class="num">${esc(it.qty)}</td><td class="num">¥${fmtMoney(amt)}</td></tr>`;
  });
  html += `</tbody></table><div class="row" style="justify-content:flex-end;margin-top:8px"><b>单据总额：¥${fmtMoney(S.docTotal(d))}</b></div></div>`;

  if (d.accept) {
    html += `<div class="card"><h3 style="margin-top:0">验收结果</h3><table><thead><tr>
      <th>商品</th><th class="num">实收</th><th class="num">合格</th></tr></thead><tbody>`;
    d.accept.items.forEach(a => html += `<tr><td>${esc(a.productName)}</td><td class="num">${esc(a.received)}</td><td class="num">${esc(a.qualified)}</td></tr>`);
    html += `</tbody></table>${d.accept.ticket ? `<p class="hint">票据/备注：${esc(d.accept.ticket)}</p>` : ''}</div>`;
  }
  if (d.pickBatches && d.pickBatches.length) {
    html += `<div class="card"><h3 style="margin-top:0">拣货批次</h3><ul>${d.pickBatches.map(b => `<li>${esc(b.batch)}：${esc(b.productName)} × ${esc(b.qty)}</li>`).join('')}</ul></div>`;
  }
  if (d.financeNote) html += `<div class="card hint">财务备注：${esc(d.financeNote)}</div>`;

  html += `<div class="card"><h3 style="margin-top:0">流程记录</h3><ul class="timeline">`;
  d.history.forEach(h => html += `<li><div class="act">${esc(h.label)}</div><div class="t">${esc(h.t)} · ${esc(h.by)}${h.note ? ' · ' + esc(h.note) : ''}</div></li>`);
  html += `</ul></div>`;
  return html;
}

/* ---------------- 优化说明 ---------------- */
function renderOptimize() {
  return `<div class="page-head"><div><h2>优化说明</h2>
    <div class="desc">相对《业务操作流程1.1》原始手册的改进点。</div></div></div>
    <div class="card">
      <div class="opt-note">本系统严格复刻采购 / 调拨双流程的业务节点，但在交互层做了如下精简优化。</div>
      <h3 style="margin-top:0">1. 合并冗余确认（原多次点击 → 单次）</h3>
      <table><thead><tr><th>原始步骤</th><th>优化后</th></tr></thead><tbody>
        <tr><td>申购审核：审核 → 审核通过 → 通过</td><td>一次「审核通过」</td></tr>
        <tr><td>供应商：生成拣货 → 确认 → 开始拣货 → 增加批次 → 确认添加 → 确认拣货</td><td>「接单并开始拣货」+「确认拣货完成」（批次内联填写）</td></tr>
        <tr><td>出库：创建运输批次 → 上传资质 → 确定 → 发车 → 确定</td><td>「创建运输批次」→「发车」</td></tr>
        <tr><td>验收：去验收 → 送达 → 确定 → 填写 → 完成提交 → 确定</td><td>一次「提交验收」（内联填写实收/合格）</td></tr>
        <tr><td>财务：审核 → 确认审核 → 审核通过</td><td>一次「财务审核通过」</td></tr>
        <tr><td>调拨：去审核 → 通过 → 确定 / 去分拣 → 分配批次 → 确认拣货 …</td><td>每环节单次确认</td></tr>
      </tbody></table>
      <h3>2. 待办聚合 + 批量操作</h3>
      <p>原系统各角色需在分散菜单中翻找待办；本系统按角色聚合「待办」页，支持勾选多单后<strong>一键批量执行本环节操作</strong>。</p>
      <h3>3. 状态可视化</h3>
      <p>每张单据含状态徽章与完整流程时间线，无需在多个页面间跳转核对。</p>
      <h3>4. 操作安全</h3>
      <p>关键动作（审核/出库/签收/结算）均弹窗二次确认并显示摘要，避免误触。</p>
      <h3>5. 列表搜索 + 快捷键</h3>
      <p>待办与单据列表支持关键字搜索（按 <kbd>/</kbd> 聚焦）；数字键 <kbd>1</kbd>–<kbd>5</kbd> 快速切换左侧菜单。</p>
    </div>`;
}

/* ---------------- 绑定 ---------------- */
function bindContent(u) {
  // 行点击 -> 明细
  $all('.rowclick').forEach(tr => tr.addEventListener('click', e => {
    if (e.target.closest('input,button')) return;
    selId = tr.dataset.id; openDetail();
  }));
  const act = $('#detailAct');
  if (act) act.addEventListener('click', () => actOnDoc(act.dataset.id, act.dataset.act));
  const ab = $('#batchBtn');
  if (ab) ab.addEventListener('click', batchAct);
  const back = $('#backBtn');
  if (back) back.addEventListener('click', backToList);

  // 全选（原缺失的事件绑定，导致勾选框无效）
  const ca = $('#checkAll');
  if (ca) ca.addEventListener('change', () => {
    $all('.rowchk').forEach(c => c.checked = ca.checked);
  });

  // 搜索（仅刷新内容，保留外壳与角标）
  const s = $('#searchInput');
  if (s) s.addEventListener('input', () => { q = s.value; refreshContent(); refocusSearch(); });
  // 「我的单据」筛选切换
  $all('.role-tab[data-mine]').forEach(b => b.addEventListener('click', () => {
    mineOnly = b.dataset.mine === '1'; refreshContent();
  }));

  // 新建
  const tt = $('#typeTabs');
  if (tt) tt.addEventListener('click', e => {
    const t = e.target.closest('.role-tab'); if (!t) return;
    $all('#typeTabs .role-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); $('#formArea').innerHTML = renderCreateForm(t.dataset.type); bindCreateForm();
  });
  if ($('#formArea')) { // 默认渲染第一个可用类型
    const first = $('#typeTabs .role-tab.active') || $('#typeTabs .role-tab');
    if (first) { $('#formArea').innerHTML = renderCreateForm(first.dataset.type); bindCreateForm(); }
  }
}

function bindCreateForm() {
  const picker = $('#picker'); if (!picker) return;
  function refresh() { picker.innerHTML = renderPicker(); bindPicker(); }
  if (!pickRows.length) { const p0 = SEED.products[0]; pickRows.push({ productId: p0.id, spec: p0.specs[0].name, qty: 1, supplierId: p0.supplier }); }
  refresh();
  $('#addRow').addEventListener('click', () => {
    const p = SEED.products[0];
    pickRows.push({ productId: p.id, spec: p.specs[0].name, qty: 1, supplierId: p.supplier }); refresh();
  });
  $('#submitDoc').addEventListener('click', submitCreate);
}
function bindPicker() {
  $all('.pr-prod').forEach(sel => sel.addEventListener('change', e => {
    const i = +e.target.closest('.pick-row').dataset.i;
    const p = SEED.products.find(x => x.id === e.target.value);
    // 切换商品时，对应供应商同步重置为该商品的默认供应商
    pickRows[i] = { productId: p.id, spec: p.specs[0].name, qty: pickRows[i].qty || 1, supplierId: p.supplier };
    const row = e.target.closest('.pick-row');
    row.querySelector('.pr-spec').innerHTML = specOptions(p, pickRows[i].spec);
    row.querySelector('.pr-unit').textContent = p.specs[0].unit;
    row.querySelector('.pr-sup').innerHTML = supplierOptions(p, p.supplier);
  }));
  $all('.pr-sup').forEach(sel => sel.addEventListener('change', e => {
    const i = +e.target.closest('.pick-row').dataset.i;
    pickRows[i].supplierId = e.target.value;
  }));
  $all('.pr-spec').forEach(sel => sel.addEventListener('change', e => {
    const i = +e.target.closest('.pick-row').dataset.i; pickRows[i].spec = e.target.value;
  }));
  $all('.pr-qty').forEach(inp => inp.addEventListener('input', e => {
    const i = +e.target.closest('.pick-row').dataset.i; pickRows[i].qty = +e.target.value || 1;
  }));
  $all('.pr-del').forEach(b => b.addEventListener('click', e => {
    const i = +e.target.closest('.pick-row').dataset.i; pickRows.splice(i, 1);
    if (!pickRows.length) { const p = SEED.products[0]; pickRows.push({ productId: p.id, spec: p.specs[0].name, qty: 1, supplierId: p.supplier }); }
    $('#picker').innerHTML = renderPicker(); bindPicker();
  }));
}

function submitCreate() {
  const u = S.currentUser();
  if (!pickRows.length || pickRows.some(r => !r.qty || r.qty < 1)) { toast('请填写有效的商品与数量'); return; }
  const items = pickRows.map(r => {
    const p = SEED.products.find(x => x.id === r.productId);
    const sp = p.specs.find(s => s.name === r.spec) || p.specs[0];
    const unitPrice = Number(p.price) || 0;
    return {
      productId: p.id, productName: p.name, spec: sp.name, unit: sp.unit, qty: r.qty,
      supplierId: r.supplierId || p.supplier,
      unitPrice, amount: +(unitPrice * r.qty).toFixed(2),
    };
  });
  let res;
  if (pickTransfer) {
    const outWh = $('#outWhSel').value, inWh = $('#inWhSel').value;
    if (outWh === inWh) { toast('调出与调入仓库不能相同'); return; }
    res = S.createTransfer({ applicant: u, outWh, inWh, items });
  } else {
    res = S.createProcure({ applicant: u, warehouse: u.wh || $('#whSel').value, items });
  }
  if (!res.ok) { toast(res.error); return; }
  toast('已提交'); go('inbox');
}

/* ---------------- 导航辅助 ---------------- */
function openDetail() { view = 'detail'; renderApp(); }
function backToList() { view = lastList; renderApp(); }
function refreshContent() { const u = S.currentUser(); $('#content').innerHTML = viewHtml(u); bindContent(u); }
function refocusSearch() {
  const s = $('#searchInput');
  if (s) { s.focus(); const v = s.value; s.setSelectionRange(v.length, v.length); }
}

/* ---------------- 执行动作 ---------------- */
function actOnDoc(id, action) {
  const d = S.getDoc(id); const u = S.currentUser();
  const label = labelOf(d, action);
  if (action === 'accept') return openAcceptModal(d, u);
  if (action === 'supplier_pick_complete' || action === 'transfer_pick_complete') return openPickModal(d, u, action, label);
  let extra = '';
  if (action === 'finance_pass') extra = `<div class="opt-note" style="margin-bottom:12px">本单应付总额：<b>¥${fmtMoney(S.docTotal(d))}</b></div><div class="field"><label>财务备注（可选）</label><input id="noteInput"></div>`;
  openModal(label + ' · ' + d.no, `
    <p>确认对单据 <b>${esc(d.no)}</b>（${esc(docTitle(d))}）执行「<b>${esc(label)}</b>」？</p>
    <div class="hint">当前状态：${esc(S.statusLabel(d))}</div>${extra}`,
    `<button class="btn ghost" data-close>取消</button>
     <button class="btn ok" id="confirmAct">确认执行</button>`,
    () => {
      $('#confirmAct').addEventListener('click', () => {
        const note = $('#noteInput') ? $('#noteInput').value : '';
        const r = S.applyAction(id, action, { note }, u);
        if (!r.ok) { toast(r.error); return; }
        closeModal(); toast(`${label} 完成 · 下一步：${shortNext(r.doc)}`); selId = id; openDetail();
      });
    });
}

function openAcceptModal(d, u) {
  let rows = d.items.map(it => `<div class="pick-row" style="grid-template-columns:1fr 110px 90px 90px 36px">
    <span>${esc(it.productName)}（${esc(it.spec)}）</span>
    <span class="pr-sup" title="${esc(supName(itemSupId(it)))}">${esc(supName(itemSupId(it)))}</span>
    <input class="ac-rec" type="number" min="0" value="${esc(it.qty)}" data-line="${esc(it.lineId)}">
    <input class="ac-qua" type="number" min="0" value="${esc(it.qty)}" data-line="${esc(it.lineId)}">
    <span class="pr-unit">${esc(it.unit)}</span></div>`).join('');
  openModal('提交验收 · ' + d.no, `
    <p>填写各商品实收数量与合格数量：</p>
    <div class="opt-note" style="margin-bottom:10px">本单商品金额合计：<b>¥${fmtMoney(S.docTotal(d))}</b></div>
    <div class="kv" style="margin-bottom:8px"><span>商品</span><span>对应供应商</span><span class="num">实收</span><span class="num">合格</span><span></span></div>
    <div id="accRows">${rows}</div>
    <div class="field" style="margin-top:10px"><label>票据/索证索票备注（可选）</label><input id="ticketInput"></div>`,
    `<button class="btn ghost" data-close>取消</button><button class="btn ok" id="confirmAcc">提交验收</button>`,
    () => {
      $('#confirmAcc').addEventListener('click', () => {
        const items = d.items.map(it => {
          const rec = $(`.ac-rec[data-line="${it.lineId}"]`).value;
          const qua = $(`.ac-qua[data-line="${it.lineId}"]`).value;
          return { lineId: it.lineId, productId: it.productId, productName: it.productName, received: rec === '' ? NaN : +rec, qualified: qua === '' ? NaN : +qua };
        });
        const r = S.applyAction(d.id, 'accept', { items, ticket: $('#ticketInput').value }, u);
        if (!r.ok) { toast(r.error); return; }
        closeModal(); toast(`验收已提交 · 下一步：${shortNext(r.doc)}`); selId = d.id; openDetail();
      });
    });
}

function openPickModal(d, u, action, label) {
  const sourceItems = action.startsWith('supplier_')
    ? d.items.filter(it => it.supplierId === u.account)
    : d.items;
  let rows = sourceItems.map((it, i) => `<div class="pick-row" style="grid-template-columns:1fr 120px 90px 36px">
    <span>${esc(it.productName)}（${esc(it.spec)}）</span>
    <input class="pk-batch" value="B${i + 1}" data-line="${esc(it.lineId)}">
    <input class="pk-qty" type="number" min="1" value="${esc(it.qty)}" data-line="${esc(it.lineId)}">
    <span class="pr-unit">${esc(it.unit)}</span></div>`).join('');
  openModal(label + ' · ' + d.no, `
    <p>为每件商品分配拣货批次（按近效期优先）：</p>
    <div id="pkRows">${rows}</div>`,
    `<button class="btn ghost" data-close>取消</button><button class="btn ok" id="confirmPk">确认拣货完成</button>`,
    () => {
      $('#confirmPk').addEventListener('click', () => {
        const batches = sourceItems.map(it => {
          const b = $(`.pk-batch[data-line="${it.lineId}"]`).value;
          const q = $(`.pk-qty[data-line="${it.lineId}"]`).value;
          return { batch: b, lineId: it.lineId, productId: it.productId, productName: it.productName, qty: q === '' ? NaN : +q };
        });
        const r = S.applyAction(d.id, action, { batches }, u);
        if (!r.ok) { toast(r.error); return; }
        closeModal(); toast(`拣货完成 · 下一步：${shortNext(r.doc)}`); selId = d.id; openDetail();
      });
    });
}

function batchAct() {
  const u = S.currentUser();
  const ids = $all('.rowchk:checked').map(c => c.value);
  if (!ids.length) { toast('请先勾选单据'); return; }
  const docs = ids.map(id => S.getDoc(id));
  if (docs.some(d => !d)) { toast('所选单据已不存在，请刷新后重试'); return; }
  const acts = docs.map(d => S.actionsFor(d, u)[0]);
  if (acts.some(a => !a)) { toast('所选单据当前无可执行操作'); return; }
  const label = labelOf(docs[0], acts[0]);
  if (acts.some(a => a !== acts[0])) { toast('所选单据动作不一致，请分别处理'); return; }
  if (new Set(['accept', 'supplier_pick_complete', 'transfer_pick_complete']).has(acts[0])) {
    toast('验收和拣货必须逐单填写明细');
    return;
  }
  openModal('批量执行', `<p>将对选中的 <b>${ids.length}</b> 张单据统一执行「<b>${esc(label)}</b>」。</p>
    <div class="hint">${ids.map((id, i) => esc(S.getDoc(id).no)).join('、')}</div>`,
    `<button class="btn ghost" data-close>取消</button><button class="btn ok" id="confirmBatch">确认批量执行</button>`,
    () => {
      $('#confirmBatch').addEventListener('click', () => {
        let ok = 0;
        ids.forEach(id => { const r = S.applyAction(id, acts[0], {}, u); if (r.ok) ok++; });
        closeModal(); toast(`已处理 ${ok}/${ids.length} 张`); go('inbox');
      });
    });
}

/* ---------------- 弹窗 ---------------- */
function openModal(title, body, footer, onMount) {
  closeModal();
  const mask = document.createElement('div'); mask.className = 'modal-mask'; mask.id = 'modalMask';
  mask.innerHTML = `<div class="modal"><header>${esc(title)}</header><div class="body">${body}</div><footer>${footer}</footer></div>`;
  document.body.appendChild(mask);
  mask.addEventListener('click', e => { if (e.target === mask || e.target.closest('[data-close]')) closeModal(); });
  if (onMount) onMount();
}
function closeModal() { const m = $('#modalMask'); if (m) m.remove(); }

/* ---------------- 移动端侧栏 ---------------- */
function toggleSidebar() {
  const sb = $('#sidebar'); if (!sb) return;
  sb.classList.toggle('open');
  let mask = $('.mask-sidebar');
  if (sb.classList.contains('open')) {
    if (!mask) {
      mask = document.createElement('div'); mask.className = 'mask-sidebar';
      mask.addEventListener('click', closeSidebar); document.body.appendChild(mask);
    }
  } else if (mask) mask.remove();
}
function closeSidebar() {
  const sb = $('#sidebar'); if (sb) sb.classList.remove('open');
  const mask = $('.mask-sidebar'); if (mask) mask.remove();
}

/* ---------------- 杂项 ---------------- */
function docTitle(d) {
  if (d.type === 'procure') return d.applicant.name + ' 申购';
  return whName(d.outWh) + '→' + whName(d.inWh) + ' 调拨';
}
function whName(id) { const w = SEED.warehouses.find(x => x.id === id); return w ? w.name : id; }
function supName(id) { const s = S.getSupplier(id); return s ? s.name : '—'; }
// 商品明细行的供应商 id：优先用单据存储值，缺失时回退到该商品默认供应商
// （兼容旧数据未写入 supplierId 的情况，确保供应商列始终能显示）
function itemSupId(it) {
  if (it.supplierId) return it.supplierId;
  const p = SEED.products.find(x => x.id === it.productId);
  return p ? p.supplier : null;
}
// 单据涉及的全部供应商（去重，按出现顺序），用于列表「对应供应商」列与搜索
function docSuppliers(d) {
  const seen = new Set(); const out = [];
  (d.items || []).forEach(it => {
    const id = itemSupId(it);
    if (id && !seen.has(id)) { seen.add(id); out.push(supName(id)); }
  });
  return out;
}

/* ---------------- 下一步提示机制 ---------------- */
// 下一步短提示（用于操作完成后的 toast）
function shortNext(d) {
  const steps = S.nextStep(d);
  if (!steps.length) return '流程已完成';
  return steps.map(s => `${s.label}（${s.roles.join('/')}）`).join('、');
}
// 流程进度条：已完成 / 当前 / 待处理
function stepStepper(d) {
  const pipe = S.pipeline(d);
  const cur = pipe.findIndex(s => s.status === d.status);
  return `<div class="stepper">${pipe.map((s, i) => {
    const cls = i < cur ? 'done' : (i === cur ? 'active' : 'todo');
    return `<span class="step ${cls}"><i>${i < cur ? '✓' : i + 1}</i>${esc(s.label)}</span>`;
  }).join('')}</div>`;
}
// 流程导航 / 下一步提示卡片：告诉当前用户「现在该干什么、之后谁接手」
function stepBanner(d, u) {
  const acts = S.actionsFor(d, u);   // 当前用户可执行动作
  const nxt = S.nextStep(d);         // 当前状态之后的下一步
  let head, sub;
  if (acts.length) {
    head = `👉 待你操作：执行「${esc(labelOf(d, acts[0]))}」`;
    sub = nxt.length
      ? `完成后 → 下一步：${esc(nxt.map(s => `${s.label}（${s.roles.join('/')}）`).join('、'))}`
      : '完成后流程即结束。';
  } else if (nxt.length) {
    head = `⏳ 等待 ${esc(nxt[0].roles.join('/'))} 执行「${esc(nxt[0].label)}」`;
    sub = `完成后进入「${esc(nxt[0].toLabel)}」。`;
  } else {
    head = '✅ 流程已完成';
    sub = '本单据所有环节已办结。';
  }
  return `<div class="card step-card">
    <div class="step-head">${head}</div>
    <div class="step-sub">${sub}</div>
    ${stepStepper(d)}
  </div>`;
}

/* ---------------- 演示种子 ---------------- */
// 把单据推进到目标状态（仅用于首次演示数据灌入；复用真实状态机，不另写规则）
function seedPlay(doc, target, seq) {
  for (const [act, role] of seq) {
    let current = S.getDoc(doc.id);
    if (!current || current.status === target) break;

    const accounts = act.startsWith('supplier_')
      ? [...new Set(current.items.map(it => it.supplierId))]
      : [null];
    for (const account of accounts) {
      current = S.getDoc(doc.id);
      if (!current || current.status === target) break;
      const actor = account
        ? SEED.users.find(u => u.account === account)
        : SEED.users.find(u => {
          if (act === 'finance_pass') return u.role === '财务';
          if (act === 'transfer_sign') return u.wh === current.inWh && ['档口', '餐厅', '中心库'].includes(u.role);
          const wh = current.type === 'procure' ? current.warehouse : current.outWh;
          return u.role === role && u.wh === wh;
        });
      if (!actor) continue;

      const sourceItems = account ? current.items.filter(it => it.supplierId === account) : current.items;
      let payload = {};
      if (act === 'accept') payload = { items: current.items.map(it => ({ lineId: it.lineId, productId: it.productId, productName: it.productName, received: it.qty, qualified: it.qty })), ticket: '演示' };
      else if (act === 'supplier_pick_complete' || act === 'transfer_pick_complete') {
        payload = { batches: sourceItems.map(it => ({ batch: 'B-' + it.productId, lineId: it.lineId, productId: it.productId, productName: it.productName, qty: it.qty })) };
      }
      const result = S.applyAction(current.id, act, payload, actor);
      if (!result.ok) console.warn('[seed]', act, result.error);
    }
  }
}
const PROCURE_SEQ = [
  ['review_pass', '餐厅'], ['supplier_order', '供应商'], ['supplier_pick_complete', '供应商'],
  ['supplier_outbound', '供应商'], ['supplier_dispatch', '供应商'], ['accept', '餐厅'],
  ['settle', '餐厅'], ['finance_pass', '财务'],
];
const TRANSFER_SEQ = [
  ['transfer_review_pass', '餐厅'], ['transfer_pick_complete', '餐厅'], ['transfer_recheck', '餐厅'],
  ['transfer_outbound', '餐厅'], ['transfer_sign', '档口'],
];
function seedDemo() {
  const P = id => SEED.products.find(x => x.id === id);
  const mk = (id, spec, unit, qty, sup) => {
    const p = P(id); const up = Number(p.price) || 0;
    return { productId: id, productName: p.name, spec, unit, qty, supplierId: sup, unitPrice: up, amount: +(up * qty).toFixed(2) };
  };
  const u = SEED.users;
  const dk1 = u.find(x => x.account === 'DK01');   // 鸭腿饭 · 紫荆苑二餐厅
  const dk2 = u.find(x => x.account === 'DK02');   // 小鲜肉拌饭 · 紫荆苑二餐厅
  const dk25 = u.find(x => x.account === 'DK25');  // 豆浆 · 公颐园餐厅

  // 1) 紫荆苑档口申购 → 待餐厅审核
  const d1 = S.createProcure({ applicant: dk1, warehouse: 'WH-ZJY', items: [ mk('P-MI-1', '10kg', '袋', 2, 'S0001'), mk('P-EG-1', '箱(360枚)', '箱', 1, 'S0018') ] }).doc;
  // 2) 公颐园档口申购 → 已审核，待供应商接单
  const d2 = S.createProcure({ applicant: dk25, warehouse: 'WH-GYY', items: [ mk('P-MI-1', '5kg', '袋', 3, 'S0001'), mk('P-OI-1', '5L', '桶', 2, 'S0003') ] }).doc;
  seedPlay(d2, 'REVIEWED', PROCURE_SEQ);
  // 3) 紫荆苑档口申购 → 走完采购链，待财务审核
  const d3 = S.createProcure({ applicant: dk1, warehouse: 'WH-ZJY', items: [ mk('P-OI-2', '5L', '桶', 1, 'S0003'), mk('P-FL-1', '25kg', '袋', 1, 'S0002') ] }).doc;
  seedPlay(d3, 'SETTLED', PROCURE_SEQ);
  // 4) 紫荆苑档口申购 → 已完成（展示终态 + 完整进度条）
  const d4 = S.createProcure({ applicant: dk2, warehouse: 'WH-ZJY', items: [ mk('P-AM-2', '散装', '斤', 2, 'S0006'), mk('P-AQ-1', '散装', '斤', 3, 'S0007') ] }).doc;
  seedPlay(d4, 'FINISHED', PROCURE_SEQ);
  // 5) 公颐园档口申购 → 配送中（待餐厅验收）
  const d5 = S.createProcure({ applicant: dk25, warehouse: 'WH-GYY', items: [ mk('P-DR-1', '550ml', '瓶', 10, 'S0020'), mk('P-DR-3', '500ml', '瓶', 5, 'S0020') ] }).doc;
  seedPlay(d5, 'DISPATCHED', PROCURE_SEQ);
  // 6) 调拨 公颐园→紫荆苑 → 待出库方（公颐园餐厅）审核
  const t1 = S.createTransfer({ applicant: dk25, outWh: 'WH-GYY', inWh: 'WH-ZJY', items: [ mk('P-DR-1', '550ml', '瓶', 20, 'S0020') ] }).doc;
  // 7) 调拨 紫荆苑→公颐园 → 配送中（待公颐园签收）
  const t2 = S.createTransfer({ applicant: dk1, outWh: 'WH-ZJY', inWh: 'WH-GYY', items: [ mk('P-MI-1', '10kg', '袋', 5, 'S0001') ] }).doc;
  seedPlay(t2, 'OUTBOUND', TRANSFER_SEQ);
}

/* ---------------- 启动 ---------------- */
function init() {
  S.load();
  if (S.needSeed()) { seedDemo(); S.markSeeded(); }
  const u = S.currentUser();
  if (u) renderApp(); else renderLogin();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* ---------------- 键盘快捷键 ---------------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = /input|select|textarea/.test(tag);
  // "/" 聚焦当前列表搜索框
  if (e.key === '/' && !typing) {
    e.preventDefault(); const s = $('#searchInput');
    if (s) { s.focus(); s.select(); }
  }
  // 数字键 1-5 切换菜单（仅登录态、非输入态）
  if (/^[1-5]$/.test(e.key) && !typing && S.currentUser()) {
    const v = NAV[+e.key - 1].view;
    if (v) { go(v); closeSidebar(); }
  }
});
