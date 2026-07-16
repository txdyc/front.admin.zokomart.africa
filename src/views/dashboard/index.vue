<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import dayjs from 'dayjs';
import type { TableColumnsType } from 'ant-design-vue';
import { apiDashboardOverview, apiDashboardSalesTrend } from '@/api/dashboard';
import type { DashboardOverviewVO, DailyTrendVO } from '@/types/dashboard';

const { t } = useI18n();

const palette = {
  blue: '#2a78d6', blue1: '#86b6ef', blue2: '#3987e5', blue3: '#1c5cab',
  aqua: '#1baf7a', green: '#0ca30c', amber: '#fab219', red: '#d03b3b',
  orange: '#ec835a', muted: '#898781', grid: '#e1e0d9', track: '#f0efec',
};

type RangeKey = '7d' | '30d' | '90d' | 'mtd';
const range = ref<RangeKey>('30d');
const loading = ref(false);
const overview = ref<DashboardOverviewVO | null>(null);
const trend = ref<DailyTrendVO[]>([]);

const fin = computed(() => overview.value?.financial);
const ff = computed(() => overview.value?.fulfillment);
const inv = computed(() => overview.value?.inventory);

// ---------- formatting ----------
const money = (n?: number | null) => {
  const v = n ?? 0;
  const a = Math.abs(v);
  if (a >= 1e6) return `₵${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `₵${(v / 1e3).toFixed(1)}K`;
  return `₵${v.toFixed(0)}`;
};
const pct = (r?: number | null) => `${((r ?? 0) * 100).toFixed(1)}%`;
const num = (n?: number | null) => (n ?? 0).toLocaleString();

// ---------- data loading ----------
function rangeDates(): { from: string; to: string } {
  const to = dayjs();
  let from = to.subtract(29, 'day');
  if (range.value === '7d') from = to.subtract(6, 'day');
  else if (range.value === '90d') from = to.subtract(89, 'day');
  else if (range.value === 'mtd') from = to.startOf('month');
  return { from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') };
}

async function load() {
  loading.value = true;
  try {
    const params = rangeDates();
    const [ov, tr] = await Promise.all([
      apiDashboardOverview(params),
      apiDashboardSalesTrend(params),
    ]);
    overview.value = ov;
    trend.value = tr;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
function onRange(v: RangeKey) {
  range.value = v;
  load();
}

// ---------- KPI tiles ----------
const kpis = computed(() => {
  const f = fin.value;
  return [
    { label: t('dashboard.netRevenue'), value: money(f?.netRevenue), hero: true },
    { label: t('dashboard.gmv'), value: money(f?.gmv) },
    { label: t('dashboard.grossProfit'), value: money(f?.grossProfit), sub: `${pct(f?.grossMargin)} ${t('dashboard.grossMargin')}` },
    { label: t('dashboard.codCollected'), value: money(f?.codCollected) },
    { label: t('dashboard.codOutstanding'), value: money(f?.codOutstanding) },
    { label: t('dashboard.aov'), value: money(f?.aov) },
  ];
});

// ---------- revenue trend area chart ----------
const CW = 760, CH = 220, PL = 52, PR = 12, PT = 12, PB = 24;
const trendChart = computed(() => {
  const d = trend.value;
  const max = Math.max(1, ...d.map((p) => p.revenue));
  const X = (i: number) => PL + (d.length <= 1 ? 0 : (i * (CW - PL - PR)) / (d.length - 1));
  const Y = (v: number) => CH - PB - (v / max) * (CH - PT - PB);
  const line = d.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.revenue).toFixed(1)}`).join(' ');
  const area = d.length ? `${line} L${X(d.length - 1).toFixed(1)} ${CH - PB} L${X(0).toFixed(1)} ${CH - PB} Z` : '';
  const gridlines = [0, 1, 2, 3, 4].map((g) => {
    const val = (max * g) / 4;
    return { y: Y(val), label: money(val) };
  });
  const end = d.length ? { x: X(d.length - 1), y: Y(d[d.length - 1].revenue) } : null;
  return { line, area, gridlines, end, w: CW, h: CH };
});

// ---------- fulfillment funnel ----------
const funnel = computed(() => {
  const f = ff.value;
  if (!f) return [];
  const created = f.pendingDispatch + f.dispatching + f.signed + f.signedPaid + f.unreachable + f.rejected;
  const stages = [
    { key: 'placed', v: f.placed, c: palette.blue1 },
    { key: 'created', v: created, c: palette.blue2 },
    { key: 'dispatched', v: f.dispatchedTotal, c: palette.blue },
    { key: 'delivered', v: f.delivered, c: palette.blue3 },
  ];
  const max = Math.max(1, ...stages.map((s) => s.v));
  return stages.map((s, i) => ({
    ...s,
    width: (s.v / max) * 100,
    conv: i ? (stages[i - 1].v ? Math.round((s.v / stages[i - 1].v) * 100) : 0) : null,
  }));
});

// ---------- delivery outcomes donut ----------
const R = 52;
const CIRC = 2 * Math.PI * R;
const donut = computed(() => {
  const f = ff.value;
  const raw = f
    ? [
        { key: 'delivered', v: f.delivered, c: palette.green },
        { key: 'inTransit', v: f.dispatching, c: palette.amber },
        { key: 'rejected', v: f.rejected, c: palette.red },
        { key: 'unreachable', v: f.unreachable, c: palette.orange },
      ].filter((s) => s.v > 0)
    : [];
  const total = raw.reduce((a, s) => a + s.v, 0) || 1;
  let off = 0;
  const arcs = raw.map((s) => {
    const len = (CIRC * s.v) / total;
    const arc = {
      ...s,
      dash: `${Math.max(0, len - 3).toFixed(1)} ${(CIRC - len + 3).toFixed(1)}`,
      offset: (-off).toFixed(1),
      pctv: Math.round((s.v / total) * 100),
    };
    off += len;
    return arc;
  });
  return { arcs };
});

// ---------- P&L composition ----------
const pnl = computed(() => {
  const f = fin.value;
  if (!f) return { segs: [] as any[] };
  const logistics = Math.max(0, (f.deliveryFeeTotal || 0) - (f.rejectionCost || 0));
  const segs = [
    { key: 'cogs', v: f.cogs || 0, c: palette.orange },
    { key: 'logistics', v: logistics, c: palette.amber },
    { key: 'rejectionLoss', v: f.rejectionCost || 0, c: palette.red },
    { key: 'grossProfit', v: Math.max(0, f.grossProfit || 0), c: palette.green },
  ];
  const total = segs.reduce((a, s) => a + s.v, 0) || 1;
  return { segs: segs.map((s) => ({ ...s, pctW: (s.v / total) * 100 })) };
});

// ---------- COD pipeline ----------
const cod = computed(() => {
  const f = fin.value;
  const collected = f?.codCollected || 0;
  const outstanding = f?.codOutstanding || 0;
  const total = collected + outstanding || 1;
  return {
    collected,
    outstanding,
    collectedW: (collected / total) * 100,
    outstandingW: (outstanding / total) * 100,
  };
});

// ---------- horizontal bar scaling ----------
const catMax = computed(() => Math.max(1, ...(overview.value?.revenueByCategory || []).map((x) => x.amount)));
const brandMax = computed(() => Math.max(1, ...(overview.value?.revenueByBrand || []).map((x) => x.amount)));
const supMax = computed(() => Math.max(1, ...(overview.value?.topSuppliers || []).map((x) => x.amount)));

// ---------- derived operational figures ----------
const avgDelivery = computed(() => {
  const h = ff.value?.avgDeliveryHours;
  if (h == null) return '—';
  return h >= 24 ? `${(h / 24).toFixed(1)} ${t('dashboard.days')}` : `${h.toFixed(1)} ${t('dashboard.hours')}`;
});
const avgDeliveryCost = computed(() => {
  const f = fin.value, g = ff.value;
  if (!f || !g || !g.dispatchedTotal) return money(0);
  return money((f.deliveryFeeTotal || 0) / g.dispatchedTotal);
});

// ---------- top products table ----------
const productColumns = computed<TableColumnsType>(() => [
  { title: t('dashboard.product'), dataIndex: 'name', key: 'name', ellipsis: true },
  { title: t('dashboard.code'), dataIndex: 'code', key: 'code', width: 120 },
  { title: t('dashboard.units'), dataIndex: 'qty', key: 'qty', width: 90, align: 'right' },
  { title: t('dashboard.revenue'), dataIndex: 'revenue', key: 'revenue', width: 120, align: 'right' },
  { title: t('dashboard.rejectRate'), key: 'rejectRate', width: 100, align: 'right' },
]);
</script>

<template>
  <a-spin :spinning="loading">
    <!-- toolbar -->
    <div class="dash-toolbar">
      <div>
        <h2 class="dash-title">{{ t('dashboard.title') }}</h2>
        <span class="dash-sub" v-if="overview">{{ overview.from }} → {{ overview.to }} · GHS ₵</span>
      </div>
      <a-radio-group :value="range" button-style="solid" @change="(e:any) => onRange(e.target.value)">
        <a-radio-button value="7d">{{ t('dashboard.range7d') }}</a-radio-button>
        <a-radio-button value="30d">{{ t('dashboard.range30d') }}</a-radio-button>
        <a-radio-button value="90d">{{ t('dashboard.range90d') }}</a-radio-button>
        <a-radio-button value="mtd">{{ t('dashboard.rangeMtd') }}</a-radio-button>
      </a-radio-group>
    </div>

    <!-- KPI strip -->
    <a-row :gutter="[16, 16]">
      <a-col v-for="k in kpis" :key="k.label" :xs="12" :sm="8" :lg="4">
        <a-card :bordered="false" class="kpi-card">
          <div class="kpi-label">{{ k.label }}</div>
          <div class="kpi-value" :class="{ hero: k.hero }">{{ k.value }}</div>
          <div class="kpi-sub">{{ k.sub || ' ' }}</div>
        </a-card>
      </a-col>
    </a-row>

    <!-- revenue trend + P&L -->
    <a-row :gutter="[16, 16]" class="mt-4">
      <a-col :xs="24" :lg="16">
        <a-card :bordered="false" :title="t('dashboard.revenueTrend')">
          <template #extra><span class="card-hint">{{ t('dashboard.revenueTrendHint') }}</span></template>
          <svg :viewBox="`0 0 ${CW} ${CH}`" class="chart">
            <line
              v-for="(g, i) in trendChart.gridlines"
              :key="i"
              :x1="PL" :y1="g.y" :x2="CW - PR" :y2="g.y"
              :stroke="palette.grid" stroke-width="1"
            />
            <text
              v-for="(g, i) in trendChart.gridlines"
              :key="`t${i}`"
              :x="PL - 8" :y="g.y + 3" text-anchor="end" :fill="palette.muted" class="axis-text"
            >{{ g.label }}</text>
            <path :d="trendChart.area" :fill="palette.blue" opacity="0.1" />
            <path :d="trendChart.line" fill="none" :stroke="palette.blue" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <circle v-if="trendChart.end" :cx="trendChart.end.x" :cy="trendChart.end.y" r="4.5" :fill="palette.blue" stroke="#fff" stroke-width="2" />
          </svg>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="8">
        <a-card :bordered="false" :title="t('dashboard.pnlTitle')">
          <div class="stack">
            <div v-for="s in pnl.segs" :key="s.key" :style="{ width: s.pctW + '%', background: s.c }" :title="`${t('dashboard.' + s.key)}: ${money(s.v)}`"></div>
          </div>
          <div class="legend">
            <span v-for="s in pnl.segs" :key="s.key" class="li">
              <i class="dot" :style="{ background: s.c }" />{{ t('dashboard.' + s.key) }} <b>{{ money(s.v) }}</b>
            </span>
          </div>
          <div class="meter-row">
            <span>{{ t('dashboard.grossMargin') }}</span><b>{{ pct(fin?.grossMargin) }}</b>
          </div>
          <a-progress :percent="Math.round((fin?.grossMargin ?? 0) * 100)" :show-info="false" :stroke-color="palette.blue" />
        </a-card>
      </a-col>
    </a-row>

    <!-- fulfillment & delivery -->
    <div class="sec">{{ t('dashboard.fulfillmentDelivery') }}</div>
    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="10">
        <a-card :bordered="false" :title="t('dashboard.funnelTitle')">
          <div class="funnel">
            <div v-for="s in funnel" :key="s.key" class="fn">
              <div class="fn-row">
                <span class="fn-label">{{ t('dashboard.' + s.key) }}</span>
                <div class="fn-track">
                  <div class="fn-bar" :style="{ width: Math.max(s.width, 0.8) + '%', background: s.c }"></div>
                </div>
                <span class="fn-val">{{ num(s.v) }}</span>
              </div>
              <div class="conv" v-if="s.conv !== null">{{ s.conv }}% {{ t('dashboard.ofPrev') }}</div>
            </div>
          </div>
          <div class="leak">
            <span :style="{ color: palette.red }">✕ {{ t('dashboard.rejected') }}: <b>{{ num(ff?.rejected) }}</b></span>
            <span :style="{ color: palette.orange }">◷ {{ t('dashboard.unreachable') }}: <b>{{ num(ff?.unreachable) }}</b></span>
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card :bordered="false" :title="t('dashboard.deliveryOutcomes')">
          <div class="donut-wrap">
            <svg viewBox="0 0 140 140" width="150" height="150">
              <circle
                v-for="a in donut.arcs" :key="a.key"
                cx="70" cy="70" :r="R" fill="none" :stroke="a.c" stroke-width="20"
                :stroke-dasharray="a.dash" :stroke-dashoffset="a.offset" transform="rotate(-90 70 70)"
              >
                <title>{{ t('dashboard.' + a.key) }}: {{ a.pctv }}%</title>
              </circle>
              <text x="70" y="68" text-anchor="middle" class="donut-pct" fill="#0b0b0b">{{ pct(ff?.deliverySuccessRate) }}</text>
              <text x="70" y="84" text-anchor="middle" class="donut-sub" :fill="palette.muted">{{ t('dashboard.delivered') }}</text>
            </svg>
          </div>
          <div class="legend center">
            <span v-for="a in donut.arcs" :key="a.key" class="li">
              <i class="dot" :style="{ background: a.c }" />{{ t('dashboard.' + a.key) }} <b>{{ num(a.v) }}</b>
            </span>
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="8">
        <a-card :bordered="false" :title="t('dashboard.opHealth')">
          <a-row :gutter="[12, 16]">
            <a-col :span="12"><div class="mini l">{{ t('dashboard.deliverySuccess') }}</div><div class="mini v">{{ pct(ff?.deliverySuccessRate) }}</div></a-col>
            <a-col :span="12"><div class="mini l">{{ t('dashboard.rejectionRate') }}</div><div class="mini v" :style="{ color: palette.red }">{{ pct(ff?.rejectionRate) }}</div></a-col>
            <a-col :span="12"><div class="mini l">{{ t('dashboard.returnRate') }}</div><div class="mini v">{{ pct(ff?.returnRate) }}</div></a-col>
            <a-col :span="12"><div class="mini l">{{ t('dashboard.avgDeliveryTime') }}</div><div class="mini v">{{ avgDelivery }}</div></a-col>
            <a-col :span="12"><div class="mini l">{{ t('dashboard.rejectionCost') }}</div><div class="mini v" :style="{ color: palette.orange }">{{ money(fin?.rejectionCost) }}</div></a-col>
            <a-col :span="12"><div class="mini l">{{ t('dashboard.avgDeliveryCost') }}</div><div class="mini v">{{ avgDeliveryCost }}</div></a-col>
          </a-row>
        </a-card>
      </a-col>
    </a-row>

    <!-- sales breakdown -->
    <div class="sec">{{ t('dashboard.salesBreakdown') }}</div>
    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" :title="t('dashboard.byCategory')">
          <div class="bars">
            <div v-for="c in overview?.revenueByCategory || []" :key="c.name" class="bar-row">
              <span class="name">{{ c.name }}</span>
              <div class="track"><div class="fill" :style="{ width: (c.amount / catMax) * 100 + '%', background: palette.blue }" /></div>
              <span class="val">{{ money(c.amount) }}</span>
            </div>
            <a-empty v-if="!(overview?.revenueByCategory || []).length" :image="undefined" />
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" :title="t('dashboard.byBrand')">
          <div class="bars">
            <div v-for="b in overview?.revenueByBrand || []" :key="b.name" class="bar-row">
              <span class="name">{{ b.name }}</span>
              <div class="track"><div class="fill" :style="{ width: (b.amount / brandMax) * 100 + '%', background: palette.aqua }" /></div>
              <span class="val">{{ money(b.amount) }}</span>
            </div>
            <a-empty v-if="!(overview?.revenueByBrand || []).length" :image="undefined" />
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- cash, procurement & inventory -->
    <div class="sec">{{ t('dashboard.cashProcurement') }}</div>
    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="8">
        <a-card :bordered="false" :title="t('dashboard.codPipeline')">
          <div class="stack">
            <div :style="{ width: cod.collectedW + '%', background: palette.green }" :title="`${t('dashboard.collected')}: ${money(cod.collected)}`"></div>
            <div :style="{ width: cod.outstandingW + '%', background: palette.amber }" :title="`${t('dashboard.codOutstanding')}: ${money(cod.outstanding)}`"></div>
          </div>
          <div class="legend">
            <span class="li"><i class="dot" :style="{ background: palette.green }" />{{ t('dashboard.collected') }} <b>{{ money(cod.collected) }}</b></span>
            <span class="li"><i class="dot" :style="{ background: palette.amber }" />{{ t('dashboard.codOutstanding') }} <b>{{ money(cod.outstanding) }}</b></span>
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="8">
        <a-card :bordered="false" :title="t('dashboard.inventoryProc')">
          <a-row :gutter="[12, 16]">
            <a-col :span="12"><div class="mini l">{{ t('dashboard.inventoryValue') }}</div><div class="mini v">{{ money(inv?.inventoryValue) }}</div><div class="mini d">{{ num(inv?.skuCount) }} SKU</div></a-col>
            <a-col :span="12"><div class="mini l">{{ t('dashboard.openPo') }}</div><div class="mini v">{{ num(inv?.openPoCount) }}</div><div class="mini d">{{ money(inv?.openPoAmount) }}</div></a-col>
            <a-col :span="12"><div class="mini l">{{ t('dashboard.cogs') }}</div><div class="mini v">{{ money(fin?.cogs) }}</div></a-col>
            <a-col :span="12"><div class="mini l">{{ t('dashboard.totalUnits') }}</div><div class="mini v">{{ num(inv?.totalUnits) }}</div></a-col>
          </a-row>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="8">
        <a-card :bordered="false" :title="t('dashboard.topSuppliers')">
          <div class="bars">
            <div v-for="s in overview?.topSuppliers || []" :key="s.name" class="bar-row">
              <span class="name">{{ s.name }}</span>
              <div class="track"><div class="fill" :style="{ width: (s.amount / supMax) * 100 + '%', background: palette.blue2 }" /></div>
              <span class="val">{{ money(s.amount) }}</span>
            </div>
            <a-empty v-if="!(overview?.topSuppliers || []).length" :image="undefined" />
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- top products -->
    <a-row :gutter="[16, 16]" class="mt-4">
      <a-col :span="24">
        <a-card :bordered="false" :title="t('dashboard.topProducts')">
          <a-table
            :columns="productColumns"
            :data-source="overview?.topProducts || []"
            :pagination="false"
            row-key="code"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'revenue'">{{ money(record.revenue) }}</template>
              <template v-else-if="column.key === 'rejectRate'">
                {{ record.qty ? ((record.rejectQty / record.qty) * 100).toFixed(0) : 0 }}%
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>
  </a-spin>
</template>

<style scoped>
.dash-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.dash-title { margin: 0; font-size: 18px; font-weight: 600; }
.dash-sub { color: #898781; font-size: 12px; }
.card-hint { color: #898781; font-size: 12px; }
.mt-4 { margin-top: 16px; }
.sec { font-size: 13px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: #52514e; margin: 22px 2px 12px; }

.kpi-card :deep(.ant-card-body) { padding: 16px; }
.kpi-label { color: #52514e; font-size: 12.5px; }
.kpi-value { font-size: 24px; font-weight: 600; margin-top: 6px; line-height: 1.1; }
.kpi-value.hero { font-size: 28px; color: #1c5cab; }
.kpi-sub { color: #898781; font-size: 11.5px; margin-top: 4px; }

.chart { width: 100%; height: auto; overflow: visible; }
/* SVG 的 font-size 展示属性会被全局样式环境盖掉（实测计算值 40px），必须用 CSS 显式钉住 */
.chart .axis-text { font-size: 10px; }
.donut-pct { font-size: 20px; font-weight: 600; }
.donut-sub { font-size: 9px; }

.stack { display: flex; height: 26px; border-radius: 7px; overflow: hidden; gap: 2px; margin-bottom: 12px; }
.stack > div { height: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; }
.legend.center { justify-content: center; }
.legend .li { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #52514e; }
.legend .li b { color: #0b0b0b; }
.legend .dot, .li .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.meter-row { display: flex; justify-content: space-between; font-size: 12.5px; color: #52514e; margin: 16px 0 6px; }

.funnel { display: flex; flex-direction: column; gap: 10px; }
.fn { display: flex; flex-direction: column; gap: 2px; }
/* 标签/数值放条外：真实数据下后段仅约 9%，条内文字必然溢出 */
.fn-row { display: grid; grid-template-columns: 110px 1fr 64px; align-items: center; gap: 10px; }
.fn-label { color: #52514e; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fn-track { height: 20px; }
.fn-bar { height: 100%; border-radius: 0 4px 4px 0; }
.fn-val { text-align: right; font-size: 12.5px; font-weight: 600; }
.conv { font-size: 11px; color: #898781; margin-left: 120px; }
.leak { display: flex; gap: 18px; margin-top: 10px; font-size: 12px; }

.donut-wrap { display: flex; justify-content: center; }

.mini.l { color: #898781; font-size: 11.5px; }
.mini.v { font-size: 18px; font-weight: 600; margin-top: 2px; }
.mini.d { color: #898781; font-size: 11.5px; margin-top: 2px; }

.bars { display: flex; flex-direction: column; gap: 11px; }
.bar-row { display: grid; grid-template-columns: 130px 1fr 80px; align-items: center; gap: 10px; }
.bar-row .name { color: #52514e; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track { height: 14px; background: #f0efec; border-radius: 0 4px 4px 0; overflow: hidden; }
.fill { height: 100%; border-radius: 0 4px 4px 0; }
.bar-row .val { text-align: right; font-size: 12.5px; font-weight: 600; }
</style>
