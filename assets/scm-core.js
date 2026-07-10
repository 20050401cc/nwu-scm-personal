/* =====================================================================
 * 食堂供应链系统 —— 领域核心（框架无关 ESM）
 * ---------------------------------------------------------------------
 * 职责：种子数据、状态机常量、角色权限矩阵、ScmStore 仓储 + 状态流转。
 * 不含任何 UI / DOM 依赖。Vue3 / React / Electron / Node 测试均可 import。
 *
 * 导出：
 *   - SEED                 种子数据（用户/仓库/商品/供应商/角色）
 *   - PROCURE_STATUS/TRANSFER_STATUS   状态枚举（中文标签）
 *   - PROCURE_TRANS/TRANSFER_TRANS     动作 -> 目标状态
 *   - ACTION_ROLES          动作 -> 允许角色
 *   - ScmStore              仓储 + 状态机类（可多实例）
 *   - coreStore             ScmStore 单例（浏览器内默认使用）
 * ===================================================================== */

const KEY = 'scm_state_v1';
const STATE_VERSION = 2;

/* ===================== 种子数据 ===================== */
const WAREHOUSES = [
  { id: 'WH-ZJY', name: '紫荆苑二餐厅仓库' },
  { id: 'WH-GYY', name: '公颐园餐厅仓库' },
  { id: 'WH-CENTER', name: '中心库' },
];

const RESTAURANTS = [
  { account: 'ZJYECT01', name: '紫荆苑二餐厅', wh: 'WH-ZJY' },
  { account: 'GYYCT01', name: '公颐园餐厅', wh: 'WH-GYY' },
];

const STALLS = {
  ZJY: [
    ['DK01', '鸭腿饭'], ['DK02', '小鲜肉拌饭'], ['DK03', '家之味手工水饺'],
    ['DK04', '和悦卤肉饭'], ['DK05', '手打快餐'], ['DK06', '黄焖鸡米饭'],
    ['DK07', '锡纸美食'], ['DK08', '肉盖饭'], ['DK09', '昆吉双拼饭'],
    ['DK10', '营养快餐'], ['DK11', '新疆炒米粉'], ['DK12', '莉莉米线'],
    ['DK13', '烤鸭拌饭'], ['DK14', '柒子其水煮肉片'], ['DK15', '勺伯石锅饭'],
    ['DK16', '锋味自选菜'], ['DK17', '牛霸天牛肉面'], ['DK18', '母鸡汤泡饼'],
    ['DK19', '壹和油泼面'], ['DK20', '金汤渔粉'], ['DK21', '汉品香热米皮'],
    ['DK22', '川姐麻辣烫'], ['DK23', '天缘麻辣香锅'], ['DK24', '幸运咖'],
  ],
  GYY: [
    ['DK25', '豆浆'], ['DK26', '重庆小面'], ['DK27', '手工面'],
    ['DK28', '萌锅饭'], ['DK29', '花样饼'], ['DK30', '麦香面庄'],
    ['DK31', '快餐'], ['DK32', '浇头面'], ['DK33', '烤肉饭'],
    ['DK34', '轻食'], ['DK35', '面夫子'], ['DK36', '煮馍'],
    ['DK37', '安徽板面'], ['DK38', '香锅'], ['DK39', '水吧'],
    ['DK40', '一元菜'],
  ],
};

const SUPPLIERS = [
  { account: 'S0001', name: '陕西泓泰粮油有限公司', category: '大米' },
  { account: 'S0002', name: '陕西五益顺福商贸有限公司', category: '面粉' },
  { account: 'S0003', name: '陕西顺发粮油食品有限公司', category: '食用油' },
  { account: 'S0004', name: '川渝和餐饮长安分公司', category: '面条' },
  { account: 'S0005', name: '西安市碑林区胖子牛羊肉店', category: '牛羊肉' },
  { account: 'S0006', name: '西安市长安区孙春英牛羊肉店', category: '牛羊肉' },
  { account: 'S0007', name: '西安市长安区喜峰水产店', category: '生鲜水产' },
  { account: 'S0008', name: '西安国正五金机电水暖经销部', category: '杂货' },
  { account: 'S0009', name: '鲜肉（长安校区）供货商', category: '鲜肉' },
  { account: 'S0010', name: '鲜肉（太白校区）供货商', category: '鲜肉' },
  { account: 'S0011', name: '冻货（长安校区）供货商', category: '冻货' },
  { account: 'S0012', name: '冻货（太白校区）供货商', category: '冻货' },
  { account: 'S0013', name: '豆制品供货商', category: '豆制品' },
  { account: 'S0014', name: '干调副食（长安校区）供货商', category: '干调副食' },
  { account: 'S0015', name: '干调副食（太白校区）供货商', category: '干调副食' },
  { account: 'S0016', name: '蔬果类（长安校区）供货商', category: '蔬果类' },
  { account: 'S0017', name: '蔬果类（太白校区）供货商', category: '蔬果类' },
  { account: 'S0018', name: '禽蛋类（长安校区）供货商', category: '禽蛋类' },
  { account: 'S0019', name: '禽蛋类（太白校区）供货商', category: '禽蛋类' },
  { account: 'S0020', name: '饮料供货商', category: '饮料类' },
];

const PRODUCTS = [
  // 大米 —— S0001 陕西泓泰粮油
  { id: 'P-MI-1', name: '东北珍珠米', category: '大米', supplier: 'S0001', price: 55, specs: [{ name: '5kg', unit: '袋' }, { name: '10kg', unit: '袋' }, { name: '25kg', unit: '袋' }] },
  { id: 'P-MI-2', name: '五常稻花香米', category: '大米', supplier: 'S0001', price: 75, specs: [{ name: '5kg', unit: '袋' }, { name: '10kg', unit: '袋' }] },
  // 面粉 —— S0002 陕西五益顺福商贸
  { id: 'P-FL-1', name: '五得利面粉', category: '面粉', supplier: 'S0002', price: 38, specs: [{ name: '5kg', unit: '袋' }, { name: '25kg', unit: '袋' }] },
  // 食用油 —— S0003 陕西顺发粮油食品（修正：原误挂 S0001 粮油）
  { id: 'P-OI-1', name: '非转基因大豆油', category: '食用油', supplier: 'S0003', price: 65, specs: [{ name: '5L', unit: '桶' }, { name: '10L', unit: '桶' }] },
  { id: 'P-OI-2', name: '花生油', category: '食用油', supplier: 'S0003', price: 95, specs: [{ name: '5L', unit: '桶' }] },
  // 面条 —— S0004 川渝和餐饮长安分公司
  { id: 'P-NO-1', name: '手工挂面', category: '面条', supplier: 'S0004', price: 6, specs: [{ name: '500g', unit: '把' }, { name: '1kg', unit: '把' }] },
  // 牛羊肉 —— S0005 / S0006
  { id: 'P-AM-1', name: '鲜羊肉', category: '牛羊肉', supplier: 'S0005', price: 38, specs: [{ name: '散装', unit: '斤' }] },
  { id: 'P-AM-2', name: '鲜牛肉', category: '牛羊肉', supplier: 'S0006', price: 42, specs: [{ name: '散装', unit: '斤' }] },
  // 生鲜水产 —— S0007 喜峰水产
  { id: 'P-AQ-1', name: '鲜活草鱼', category: '生鲜水产', supplier: 'S0007', price: 12, specs: [{ name: '散装', unit: '斤' }] },
  // 杂货 —— S0008 国正五金
  { id: 'P-GD-1', name: '一次性餐盒', category: '杂货', supplier: 'S0008', price: 25, specs: [{ name: '100只', unit: '包' }] },
  // 鲜肉 —— S0009 / S0010
  { id: 'P-MT-1', name: '鲜猪肉', category: '鲜肉', supplier: 'S0009', price: 28, specs: [{ name: '散装', unit: '斤' }] },
  { id: 'P-MT-2', name: '鲜鸡肉', category: '鲜肉', supplier: 'S0010', price: 18, specs: [{ name: '散装', unit: '斤' }] },
  // 冻货 —— S0011 / S0012
  { id: 'P-FZ-1', name: '冷冻鸡翅', category: '冻货', supplier: 'S0011', price: 45, specs: [{ name: '1kg', unit: '袋' }] },
  { id: 'P-FZ-2', name: '冷冻虾仁', category: '冻货', supplier: 'S0012', price: 60, specs: [{ name: '500g', unit: '袋' }] },
  // 豆制品 —— S0013 豆制品供货商
  { id: 'P-DB-1', name: '豆腐', category: '豆制品', supplier: 'S0013', price: 3, specs: [{ name: '散装', unit: '斤' }] },
  // 干调副食 —— S0014 / S0015
  { id: 'P-DT-1', name: '干辣椒', category: '干调副食', supplier: 'S0014', price: 15, specs: [{ name: '散装', unit: '斤' }] },
  { id: 'P-DT-2', name: '花椒', category: '干调副食', supplier: 'S0015', price: 45, specs: [{ name: '散装', unit: '斤' }] },
  // 蔬果类 —— S0016 / S0017
  { id: 'P-VG-1', name: '大白菜', category: '蔬果类', supplier: 'S0017', price: 2, specs: [{ name: '散装', unit: '斤' }] },
  { id: 'P-VG-2', name: '土豆', category: '蔬果类', supplier: 'S0017', price: 3, specs: [{ name: '散装', unit: '斤' }] },
  { id: 'P-VG-3', name: '西红柿', category: '蔬果类', supplier: 'S0017', price: 5, specs: [{ name: '散装', unit: '斤' }] },
  { id: 'P-VG-4', name: '青椒', category: '蔬果类', supplier: 'S0017', price: 6, specs: [{ name: '散装', unit: '斤' }] },
  { id: 'P-VG-5', name: '黄瓜', category: '蔬果类', supplier: 'S0017', price: 4, specs: [{ name: '散装', unit: '斤' }] },
  // 禽蛋类 —— S0018 / S0019
  { id: 'P-EG-1', name: '鲜鸡蛋', category: '禽蛋类', supplier: 'S0018', price: 6, specs: [{ name: '散装', unit: '斤' }, { name: '箱(360枚)', unit: '箱' }] },
  { id: 'P-EG-2', name: '咸鸭蛋', category: '禽蛋类', supplier: 'S0019', price: 2, specs: [{ name: '散装', unit: '枚' }] },
  // 饮料类 —— S0020 饮料供货商
  { id: 'P-DR-1', name: '矿泉水', category: '饮料类', supplier: 'S0020', price: 2, specs: [{ name: '550ml', unit: '瓶' }] },
  { id: 'P-DR-2', name: '可乐', category: '饮料类', supplier: 'S0020', price: 3, specs: [{ name: '330ml', unit: '瓶' }] },
  { id: 'P-DR-3', name: '冰红茶', category: '饮料类', supplier: 'S0020', price: 4, specs: [{ name: '500ml', unit: '瓶' }] },
  { id: 'P-DR-4', name: '橙汁', category: '饮料类', supplier: 'S0020', price: 8, specs: [{ name: '1L', unit: '瓶' }] },
];

const ROLES = {
  '档口': { label: '档口', desc: '餐厅下属经营单元，发起申购 / 调拨申请，签收调入' },
  '餐厅': { label: '餐厅', desc: '食堂主体，审核申购、验收结算，并作为调拨出库方处理本仓出库' },
  '中心库': { label: '中心库', desc: '中心仓储主体，审核申购、验收结算，并作为调拨出库方处理本仓出库' },
  '供应商': { label: '供应商', desc: '接单、拣货、出库、配送' },
  '财务': { label: '财务', desc: '采购终审（采购审核）' },
};

// 组装用户表（测试账户密码统一 0000）
const users = [];
users.push({ account: 'FIN01', pwd: '0000', name: '财务审核岗', role: '财务' });
users.push({ account: 'CENTER01', pwd: '0000', name: '中心库管理员', role: '中心库', wh: 'WH-CENTER' });
RESTAURANTS.forEach(r => users.push({ account: r.account, pwd: '0000', name: r.name, role: '餐厅', wh: r.wh }));
const stallWh = { ZJY: 'WH-ZJY', GYY: 'WH-GYY' };
Object.keys(STALLS).forEach(k => {
  STALLS[k].forEach(([acc, nm]) => users.push({ account: acc, pwd: '0000', name: nm, role: '档口', wh: stallWh[k], restaurant: k === 'ZJY' ? '紫荆苑二餐厅' : '公颐园餐厅' }));
});
SUPPLIERS.forEach(s => users.push({ account: s.account, pwd: '0000', name: s.name, role: '供应商', category: s.category }));

export const SEED = Object.freeze({
  warehouses: WAREHOUSES,
  restaurants: RESTAURANTS,
  suppliers: SUPPLIERS,
  products: PRODUCTS,
  roles: ROLES,
  users,
  meta: {
    source: '业务操作流程1.1 + 餐厅档口用户测试账户',
    site: 'http://xbdx.xazhzx.com',
  },
});

/* ===================== 状态机常量（冻结） ===================== */
export const PROCURE_STATUS = Object.freeze({
  SUBMITTED: '待审核',
  REVIEWED: '待接单',
  ORDERED: '待拣货',
  PICKED: '待出库',
  OUTBOUND: '待发车',
  DISPATCHED: '配送中（待验收）',
  ACCEPTED: '待结算确认',
  SETTLED: '待财务审核',
  FINISHED: '已完成',
});

export const TRANSFER_STATUS = Object.freeze({
  SUBMITTED: '待出库方审核',
  REVIEWED: '待拣货',
  PICKED: '待复核',
  RECHECKED: '待出库',
  OUTBOUND: '配送中（待签收）',
  SIGNED: '已完成',
});

export const PROCURE_TRANS = Object.freeze({
  review_pass: { to: 'REVIEWED', label: '审核通过' },
  supplier_order: { to: 'ORDERED', label: '接单并开始拣货' },
  supplier_pick_complete: { to: 'PICKED', label: '确认拣货完成' },
  supplier_outbound: { to: 'OUTBOUND', label: '创建运输批次' },
  supplier_dispatch: { to: 'DISPATCHED', label: '发车' },
  accept: { to: 'ACCEPTED', label: '提交验收' },
  settle: { to: 'SETTLED', label: '确认结算' },
  finance_pass: { to: 'FINISHED', label: '财务审核通过' },
});

export const TRANSFER_TRANS = Object.freeze({
  transfer_review_pass: { to: 'REVIEWED', label: '审核通过' },
  transfer_pick_complete: { to: 'PICKED', label: '确认拣货完成' },
  transfer_recheck: { to: 'RECHECKED', label: '提交复核' },
  transfer_outbound: { to: 'OUTBOUND', label: '确认出库' },
  transfer_sign: { to: 'SIGNED', label: '确认入库' },
});

export const ACTION_ROLES = Object.freeze({
  review_pass: ['餐厅', '中心库'],
  supplier_order: ['供应商'],
  supplier_pick_complete: ['供应商'],
  supplier_outbound: ['供应商'],
  supplier_dispatch: ['供应商'],
  accept: ['餐厅', '中心库'],
  settle: ['餐厅', '中心库'],
  finance_pass: ['财务'],
  transfer_review_pass: ['餐厅', '中心库'],
  transfer_pick_complete: ['餐厅', '中心库'],
  transfer_recheck: ['餐厅', '中心库'],
  transfer_outbound: ['餐厅', '中心库'],
  transfer_sign: ['档口', '餐厅', '中心库'],
  create_procure: ['档口', '餐厅', '中心库'],
  create_transfer: ['档口', '餐厅', '中心库'],
});

// 状态 -> 可执行动作（模块私有，不导出）
const PROCURE_STATUS_ACTIONS = {
  SUBMITTED: ['review_pass'],
  REVIEWED: ['supplier_order'],
  ORDERED: ['supplier_pick_complete'],
  PICKED: ['supplier_outbound'],
  OUTBOUND: ['supplier_dispatch'],
  DISPATCHED: ['accept'],
  ACCEPTED: ['settle'],
  SETTLED: ['finance_pass'],
};
const TRANSFER_STATUS_ACTIONS = {
  SUBMITTED: ['transfer_review_pass'],
  REVIEWED: ['transfer_pick_complete'],
  PICKED: ['transfer_recheck'],
  RECHECKED: ['transfer_outbound'],
  OUTBOUND: ['transfer_sign'],
};

/* ===================== 工具 ===================== */
function now() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 默认存储：浏览器用 localStorage；Node / 非浏览器环境回退到内存 Map，便于单测
function defaultStorage() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch (_) { /* 某些环境访问 localStorage 会抛错 */ }
  const mem = new Map();
  return {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k),
  };
}

/* ===================== 仓储 + 状态机 ===================== */
export class ScmStore {
  #state = null;          // 运行态：users/warehouses/products/suppliers/docs/session/seq
  #storage;

  constructor(storage = defaultStorage()) {
    this.#storage = storage;
  }

  /* ---------------- 持久化 ---------------- */
  load() {
    try {
      const raw = this.#storage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.docs) || !parsed.seq) throw new Error('invalid scm state');
        this.#state = parsed;
        // 种子数据（账户/仓库/商品/供应商）属只读定义，始终以最新 SEED 为准。
        // 否则旧 localStorage 中陈旧的 users 会导致「下拉有该供应商、登录却报密码错误」等问题。
        this.#state.users = clone(SEED.users);
        this.#state.warehouses = clone(SEED.warehouses);
        this.#state.products = clone(SEED.products);
        this.#state.suppliers = clone(SEED.suppliers);
        if (!Number.isInteger(this.#state.schemaVersion) || this.#state.schemaVersion < STATE_VERSION) {
          this.#state.schemaVersion = STATE_VERSION;
        }
        if (typeof this.#state.seeded !== 'boolean') this.#state.seeded = false;
        this.#normalizeLegacy();
        return clone(this.#state);
      }
    } catch (_) { /* 解析失败则重置 */ }
    this.#state = this.#fresh();
    return clone(this.#state);
  }
  save() { this.#storage.setItem(KEY, JSON.stringify(this.#state)); }
  // 兼容旧数据：早期版本未为商品明细写入 supplierId（如 CG0006 花生油项），
  // 按该商品的默认供应商补全，使列表 / 明细 / 验收处的「对应供应商」都能正确显示。
  #normalizeLegacy() {
    if (!this.#state || !Array.isArray(this.#state.docs)) return;
    let changed = false;
    for (const [di, d] of this.#state.docs.entries()) {
      if (!d || !Array.isArray(d.items)) continue;
      d.items.forEach((it, ii) => {
        if (!it.lineId) { it.lineId = `legacy_${di}_${ii}`; changed = true; }
        if (!it.supplierId && it.productId) {
          const p = this.getProduct(it.productId);
          if (p && p.supplier) { it.supplierId = p.supplier; changed = true; }
        }
        const p = this.getProduct(it.productId);
        if (p) {
          if (!it.productName) { it.productName = p.name; changed = true; }
          const spec = p.specs.find(s => s.name === it.spec) || p.specs[0];
          if (spec && !it.unit) { it.unit = spec.unit; changed = true; }
          if (it.unitPrice == null) { it.unitPrice = Number(p.price) || 0; changed = true; }
          if (it.amount == null && Number.isFinite(Number(it.qty))) {
            it.amount = +(Number(it.unitPrice) * Number(it.qty)).toFixed(2);
            changed = true;
          }
        }
      });
      if (d.type === 'procure' && this.#ensureSupplierTasks(d)) changed = true;
      if (d.type === 'transfer' && !Array.isArray(d.pickBatches)) {
        d.pickBatches = [];
        changed = true;
      }
    }
    if (changed) this.save();
  }
  reset() { this.#storage.removeItem(KEY); this.#state = this.#fresh(); this.#state.seeded = false; this.save(); }

  #fresh() {
    return {
      users: clone(SEED.users),
      warehouses: clone(SEED.warehouses),
      products: clone(SEED.products),
      suppliers: clone(SEED.suppliers),
      docs: [],
      session: null,
      seq: { procure: 0, transfer: 0 },
      schemaVersion: STATE_VERSION,
      seeded: false,
    };
  }

  #findDoc(id) {
    return this.#state ? this.#state.docs.find(d => d.id === id) : null;
  }

  #actor(user) {
    if (!user || !user.account || !this.#state) return null;
    const canonical = this.#state.users.find(x => x.account === user.account);
    if (!canonical || canonical.role !== user.role) return null;
    return {
      account: canonical.account,
      name: canonical.name,
      role: canonical.role,
      wh: canonical.wh || null,
      category: canonical.category || null,
      restaurant: canonical.restaurant || null,
    };
  }

  #ensureSupplierTasks(doc) {
    if (!doc || doc.type !== 'procure' || !Array.isArray(doc.items)) return false;
    const ids = [...new Set(doc.items.map(it => it.supplierId).filter(Boolean))];
    const current = Array.isArray(doc.supplierTasks) ? doc.supplierTasks : [];
    const wanted = ids.map(supplierId => {
      const old = current.find(x => x.supplierId === supplierId);
      const oldStatus = old && old.status;
      return {
        supplierId,
        status: oldStatus && oldStatus !== 'SUBMITTED' ? oldStatus : (doc.status || 'SUBMITTED'),
      };
    });
    if (JSON.stringify(current.map(x => [x.supplierId, x.status])) === JSON.stringify(wanted.map(x => [x.supplierId, x.status]))) return false;
    doc.supplierTasks = wanted;
    return true;
  }

  #supplierTask(doc, account) {
    return (doc.supplierTasks || []).find(x => x.supplierId === account) || null;
  }

  #canAct(doc, action, actor) {
    if (!doc || !actor || !(ACTION_ROLES[action] || []).includes(actor.role)) return false;

    if (doc.type === 'procure') {
      if (['review_pass', 'accept', 'settle'].includes(action)) {
        return ['餐厅', '中心库'].includes(actor.role) && actor.wh === doc.warehouse;
      }
      if (action.startsWith('supplier_')) {
        const expected = {
          supplier_order: 'REVIEWED',
          supplier_pick_complete: 'ORDERED',
          supplier_outbound: 'PICKED',
          supplier_dispatch: 'OUTBOUND',
        }[action];
        const task = this.#supplierTask(doc, actor.account);
        return actor.role === '供应商' && !!task && task.status === expected && doc.status === expected;
      }
      if (action === 'finance_pass') return actor.role === '财务';
    }

    if (doc.type === 'transfer') {
      if (action === 'transfer_sign') return actor.wh === doc.inWh;
      return ['餐厅', '中心库'].includes(actor.role) && actor.wh === doc.outWh;
    }

    return false;
  }

  #canonicalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) throw new Error('至少需要一条商品明细');
    return items.map((it, index) => {
      const p = this.getProduct(it && it.productId);
      if (!p) throw new Error(`第 ${index + 1} 行商品不存在`);
      const spec = p.specs.find(s => s.name === (it.spec || p.specs[0].name));
      if (!spec) throw new Error(`第 ${index + 1} 行规格无效`);
      const qty = Number(it.qty);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error(`第 ${index + 1} 行数量无效`);
      const supplierId = it.supplierId || p.supplier;
      if (supplierId !== p.supplier || !this.getSupplier(supplierId)) {
        throw new Error(`第 ${index + 1} 行供应商与商品不匹配`);
      }
      const unitPrice = Number(p.price) || 0;
      return {
        lineId: it.lineId || makeId('line'),
        productId: p.id,
        productName: p.name,
        spec: spec.name,
        unit: spec.unit,
        qty,
        supplierId,
        unitPrice,
        amount: +(unitPrice * qty).toFixed(2),
      };
    });
  }

  #lineKey(row, items) {
    if (row && row.lineId) return row.lineId;
    const matches = (items || []).filter(it => it.productId === row?.productId);
    return matches.length === 1 ? matches[0].lineId : null;
  }

  #validatePickBatches(doc, actor, batches) {
    const sourceItems = doc.type === 'procure' && actor.role === '供应商'
      ? doc.items.filter(it => it.supplierId === actor.account)
      : doc.items;
    if (!sourceItems.length || !Array.isArray(batches) || !batches.length) throw new Error('拣货批次不能为空');
    const expected = new Map(sourceItems.map(it => [it.lineId, it]));
    const sums = new Map();
    const normalized = batches.map(row => {
      const lineId = this.#lineKey(row, sourceItems);
      const item = expected.get(lineId);
      const qty = Number(row && (row.qty ?? row.pickQty));
      const batch = String(row && (row.batch || row.batchNo) || '').trim();
      if (!item || !batch || !Number.isFinite(qty) || qty <= 0) throw new Error('拣货批次或数量无效');
      sums.set(lineId, (sums.get(lineId) || 0) + qty);
      return { lineId, productId: item.productId, productName: item.productName, batch, qty };
    });
    for (const item of sourceItems) {
      if (Math.abs((sums.get(item.lineId) || 0) - Number(item.qty)) > 1e-9) {
        throw new Error(`商品 ${item.productName} 的拣货数量必须等于申购数量`);
      }
    }
    return normalized;
  }

  #validateAcceptance(doc, rows) {
    if (!Array.isArray(rows) || rows.length !== doc.items.length) throw new Error('验收明细必须完整覆盖采购明细');
    const expected = new Map(doc.items.map(it => [it.lineId, it]));
    const seen = new Set();
    return rows.map(row => {
      const lineId = this.#lineKey(row, doc.items);
      const item = expected.get(lineId);
      const received = Number(row && row.received);
      const qualified = Number(row && row.qualified);
      if (!item || seen.has(lineId)) throw new Error('验收商品明细重复或不属于当前采购单');
      if (!Number.isFinite(received) || !Number.isFinite(qualified) || received < 0 || qualified < 0 || qualified > received || received > Number(item.qty)) {
        throw new Error(`商品 ${item.productName} 的验收数量无效`);
      }
      seen.add(lineId);
      return {
        lineId,
        productId: item.productId,
        productName: item.productName,
        received,
        qualified,
        unqualified: received - qualified,
      };
    });
  }

  #advanceSupplierTask(doc, action, actor, target) {
    const task = this.#supplierTask(doc, actor.account);
    if (!task) throw new Error('当前供应商不属于该采购单');
    task.status = target;
    if (doc.supplierTasks.every(x => x.status === target)) doc.status = target;
  }

  /* ---------------- 查询 ---------------- */
  currentUser() { return clone(this.#state ? this.#state.session : null); }
  getWarehouse(id) { return clone(this.#state ? this.#state.warehouses.find(w => w.id === id) : null); }
  getProduct(id) { return clone(this.#state ? this.#state.products.find(p => p.id === id) : null); }
  getSupplier(acc) { return clone(this.#state ? this.#state.suppliers.find(s => s.account === acc) : null); }
  getUser(acc) { return clone(this.#state ? this.#state.users.find(u => u.account === acc) : null); }
  getDoc(id) { return clone(this.#state ? this.#state.docs.find(d => d.id === id) : null); }
  allDocs() { return clone(this.#state ? this.#state.docs : []); }

  statusLabel(doc) {
    const label = doc && doc.type === 'procure' ? PROCURE_STATUS[doc.status] : TRANSFER_STATUS[doc?.status];
    return label || '未知状态';
  }
  // 单据当前可执行动作（已按角色过滤）
  actionsFor(doc, user) {
    const map = doc.type === 'procure' ? PROCURE_STATUS_ACTIONS : TRANSFER_STATUS_ACTIONS;
    const acts = map[doc.status] || [];
    const actor = this.#actor(user);
    return acts.filter(a => this.#canAct(doc, a, actor));
  }
  // 角色待办：所有单据中该角色可立即执行的
  inbox(user) {
    return this.#state
      ? this.#state.docs.filter(d => this.actionsFor(d, user).length > 0).map(clone)
      : [];
  }
  // 下一步提示：基于当前状态推出「即将由谁执行什么、进入什么状态」
  nextStep(doc) {
    const isP = doc.type === 'procure';
    const map = isP ? PROCURE_STATUS_ACTIONS : TRANSFER_STATUS_ACTIONS;
    const TRANS = isP ? PROCURE_TRANS : TRANSFER_TRANS;
    const ST = isP ? PROCURE_STATUS : TRANSFER_STATUS;
    const acts = map[doc.status] || [];
    return acts.map(a => ({
      action: a,
      label: TRANS[a].label,
      toStatus: TRANS[a].to,
      toLabel: ST[TRANS[a].to],
      roles: ACTION_ROLES[a] || [],
    }));
  }
  // 流程管道（有序状态链），用于前端进度条渲染
  pipeline(doc) {
    const ST = doc.type === 'procure' ? PROCURE_STATUS : TRANSFER_STATUS;
    return Object.keys(ST).map(k => ({ status: k, label: ST[k] }));
  }
  // 单据金额合计（基于明细行 amount，向后兼容无 amount 的旧单）
  docTotal(d) {
    return (d.items || []).reduce((s, it) => {
      const p = this.getProduct(it.productId);
      const price = Number(it.unitPrice) || Number(p && p.price) || 0;
      const amount = Number.isFinite(Number(it.amount)) ? Number(it.amount) : price * Number(it.qty || 0);
      return s + amount;
    }, 0);
  }
  // 是否需注入演示种子：仅「全新且从未 seed 过」时为真（清空数据后不再回灌）
  needSeed() { return !!(this.#state && this.#state.docs.length === 0 && !this.#state.seeded); }
  markSeeded() { if (this.#state) { this.#state.seeded = true; this.save(); } }

  /* ---------------- 登录 ---------------- */
  login(account, pwd) {
    const u = this.#state.users.find(x => x.account === account && x.pwd === pwd);
    if (!u) return { ok: false, error: '账户或密码错误' };
    this.#state.session = { account: u.account, name: u.name, role: u.role, wh: u.wh || null, category: u.category || null };
    this.save();
    return { ok: true, user: clone(this.#state.session) };
  }
  logout() { this.#state.session = null; this.save(); }

  /* ---------------- 编号 ---------------- */
  #nextNo(type) {
    this.#state.seq[type] = (this.#state.seq[type] || 0) + 1;
    const prefix = type === 'procure' ? 'CG' : 'DB';
    return prefix + String(this.#state.seq[type]).padStart(4, '0');
  }

  /* ---------------- 创建单据 ---------------- */
  createProcure({ applicant, warehouse, items }) {
    const actor = this.#actor(applicant);
    if (!actor || !ACTION_ROLES.create_procure.includes(actor.role)) return { ok: false, error: '当前角色无权发起申购' };
    if (!this.getWarehouse(warehouse)) return { ok: false, error: '申购仓库不存在' };
    if (actor.wh && actor.wh !== warehouse) return { ok: false, error: '只能为本人所属仓库发起申购' };
    let normalized;
    try { normalized = this.#canonicalizeItems(items); }
    catch (e) { return { ok: false, error: e.message }; }
    const doc = {
      id: makeId('d'),
      type: 'procure', no: this.#nextNo('procure'),
      applicant: actor,
      warehouse, items: normalized, status: 'SUBMITTED',
      supplierTasks: [...new Set(normalized.map(it => it.supplierId))].map(supplierId => ({ supplierId, status: 'SUBMITTED' })),
      history: [{ t: now(), by: actor.name, label: '提交申购单', note: '' }],
      accept: null, financeNote: '',
      createdAt: now(),
    };
    this.#state.docs.push(doc); this.save();
    return { ok: true, doc: clone(doc) };
  }
  createTransfer({ applicant, outWh, inWh, items }) {
    const actor = this.#actor(applicant);
    if (!actor || !ACTION_ROLES.create_transfer.includes(actor.role)) return { ok: false, error: '当前角色无权发起调拨' };
    if (!this.getWarehouse(outWh) || !this.getWarehouse(inWh)) return { ok: false, error: '调拨仓库不存在' };
    if (outWh === inWh) return { ok: false, error: '调出与调入仓库不能相同' };
    if (actor.wh && actor.wh !== outWh) return { ok: false, error: '只能从本人所属仓库发起调拨' };
    let normalized;
    try { normalized = this.#canonicalizeItems(items); }
    catch (e) { return { ok: false, error: e.message }; }
    const doc = {
      id: makeId('d'),
      type: 'transfer', no: this.#nextNo('transfer'),
      applicant: actor,
      outWh, inWh, items: normalized, status: 'SUBMITTED',
      history: [{ t: now(), by: actor.name, label: '提交调拨申请', note: '' }],
      pickBatches: [], createdAt: now(),
    };
    this.#state.docs.push(doc); this.save();
    return { ok: true, doc: clone(doc) };
  }

  /* ---------------- 执行动作 ---------------- */
  applyAction(docId, action, payload = {}, user) {
    const doc = this.#findDoc(docId);
    if (!doc) return { ok: false, error: '单据不存在' };
    const actor = this.#actor(user);
    if (!actor || !this.#canAct(doc, action, actor)) return { ok: false, error: '当前账号/仓库/状态下无权执行该操作' };
    const trans = (doc.type === 'procure' ? PROCURE_TRANS : TRANSFER_TRANS)[action];
    if (!trans) return { ok: false, error: '未知动作' };

    try {
      if (action === 'review_pass') {
        this.#ensureSupplierTasks(doc);
        doc.supplierTasks.forEach(x => { x.status = 'REVIEWED'; });
        doc.status = trans.to;
      } else if (action === 'supplier_pick_complete') {
        const batches = this.#validatePickBatches(doc, actor, payload && payload.batches);
        doc.pickBatches = (doc.pickBatches || []).filter(x => !batches.some(b => b.lineId === x.lineId && x.supplierId === actor.account));
        doc.pickBatches.push(...batches.map(x => ({ ...x, supplierId: actor.account })));
        this.#advanceSupplierTask(doc, action, actor, trans.to);
      } else if (action === 'supplier_outbound' || action === 'supplier_dispatch' || action === 'supplier_order') {
        this.#advanceSupplierTask(doc, action, actor, trans.to);
      } else if (action === 'accept') {
        doc.accept = {
          items: this.#validateAcceptance(doc, payload && payload.items),
          ticket: String(payload && payload.ticket || '').trim().slice(0, 500),
          at: now(),
          by: actor.account,
        };
        doc.status = trans.to;
      } else if (action === 'settle') {
        if (!doc.accept || !Array.isArray(doc.accept.items)) throw new Error('必须先完成验收才能结算');
        doc.status = trans.to;
      } else if (action === 'transfer_pick_complete') {
        doc.pickBatches = this.#validatePickBatches(doc, actor, payload && payload.batches);
        doc.status = trans.to;
      } else if (action === 'transfer_recheck') {
        this.#validatePickBatches(doc, actor, doc.pickBatches);
        doc.status = trans.to;
      } else if (action === 'transfer_outbound') {
        this.#validatePickBatches(doc, actor, doc.pickBatches);
        doc.status = trans.to;
      } else if (action === 'transfer_sign') {
        if (!Array.isArray(doc.pickBatches) || !doc.pickBatches.length) throw new Error('没有可签收的拣货批次');
        doc.status = trans.to;
      } else {
        doc.status = trans.to;
      }

      if (action === 'finance_pass' && payload && payload.note) doc.financeNote = String(payload.note).trim().slice(0, 500);
      doc.history.push({ t: now(), by: actor.name, actor: actor.account, label: trans.label, note: String(payload && payload.note || '').trim().slice(0, 500) });
      this.save();
      return { ok: true, doc: clone(doc) };
    } catch (e) {
      return { ok: false, error: e.message || '业务数据校验失败' };
    }
  }
}

// 浏览器默认单例
export const coreStore = new ScmStore();
