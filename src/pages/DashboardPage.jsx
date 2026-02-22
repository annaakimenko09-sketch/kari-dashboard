import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { getField, getNum } from '../utils/excelParser';
import { Truck, Package, AlertTriangle, CheckCircle, TrendingDown, Upload, BarChart2 } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, accent = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-3 items-start
        ${accent ? 'border-l-4 border-l-[#E91E8C]' : ''}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className={`p-2 rounded-lg flex-shrink-0 ${accent ? 'bg-red-50' : 'bg-gray-100'}`}>
        <Icon size={18} className={accent ? 'text-[#E91E8C]' : 'text-gray-500'} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-sm font-medium text-gray-700 mt-0.5 truncate">{title}</div>
        {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

function BarRow({ label, value, max, pct, extra }) {
  const width = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#E91E8C';
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <div className="w-32 text-xs text-gray-600 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      <div className="w-20 text-xs font-semibold text-gray-900 text-right flex-shrink-0">{value?.toLocaleString('ru-RU') ?? '—'}</div>
      {extra && <div className="w-12 text-xs font-medium text-right flex-shrink-0" style={{ color }}>{extra}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-4 rounded-full bg-[#E91E8C]" />
      <h2 className="text-sm font-semibold text-gray-800">{children}</h2>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        active ? 'bg-[#E91E8C] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function PctBadge({ pct }) {
  const color = pct >= 90 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct.toFixed(1)}%</span>;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { allSummary, spbBelSummary, parsedFiles } = useData();
  const navigate = useNavigate();
  const [groupView, setGroupView] = useState('subdivision');

  const kpi = useMemo(() => {
    if (!allSummary.length) return null;

    // Global KPIs from ALL regions
    const sumAll = (key) => allSummary.reduce((s, r) => s + getNum(r, key), 0);
    const totalToShip   = sumAll('Всего к вывозу шт');
    const totalShipped  = sumAll('Отгружено шт');
    const totalReceived = sumAll('Получено шт');
    const totalReturn   = sumAll('Возврат от агрегатора шт');
    const totalWriteoff = sumAll('Вычерк шт');
    const totalShipments= sumAll('Кол-во вывозов');
    const totalRemaining= sumAll('Осталось отгрузить пар шт');
    const avgShippedPct = allSummary.length
      ? allSummary.reduce((s, r) => s + getNum(r, 'Отгружено товара %'), 0) / allSummary.length
      : 0;

    // Problem stores only from SPB/BEL
    const problemStores = spbBelSummary.filter(r => {
      const sp = getNum(r, 'Отгружено товара %');
      const wp = getNum(r, 'Вычерк по сборке %');
      return (sp > 0 && sp < 80) || wp > 15;
    }).length;

    // Group helper
    const groupBy = (data, key) => {
      const map = {};
      data.forEach(r => {
        const k = String(getField(r, key) || r[key] || 'Неизвестно');
        if (!map[k]) map[k] = { name: k, shipped: 0, toShip: 0, received: 0, shipments: 0, stores: new Set() };
        map[k].shipped   += getNum(r, 'Отгружено шт');
        map[k].toShip    += getNum(r, 'Всего к вывозу шт');
        map[k].received  += getNum(r, 'Получено шт');
        map[k].shipments += getNum(r, 'Кол-во вывозов');
        map[k].stores.add(r['Магазин']);
      });
      return Object.values(map)
        .map(v => ({ ...v, storeCount: v.stores.size, pct: v.toShip > 0 ? (v.shipped / v.toShip * 100) : 0 }))
        .sort((a, b) => b.shipped - a.shipped);
    };

    return {
      totalToShip, totalShipped, totalReceived, totalReturn, totalWriteoff,
      totalShipments, totalRemaining, avgShippedPct, problemStores,
      storesCount: new Set(spbBelSummary.map(r => r['Магазин'])).size,
      // Regions from ALL data
      byRegion: groupBy(allSummary, 'Регион'),
      // Subdivisions only SPB/BEL
      bySubdivision: groupBy(spbBelSummary, 'Подразделение'),
      // Product groups from ALL data
      byProductGroup: groupBy(allSummary, '_productGroup'),
    };
  }, [allSummary, spbBelSummary]);

  if (!parsedFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 border border-red-100">
          <Upload size={28} className="text-[#E91E8C]" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Нет данных</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-xs">Загрузите Excel-файлы с отчётами вывозов</p>
        <button
          onClick={() => navigate('/upload')}
          className="px-5 py-2 bg-[#E91E8C] text-white rounded-lg text-sm font-semibold hover:bg-[#c51878] transition-colors"
        >
          Загрузить файлы
        </button>
      </div>
    );
  }

  if (!kpi) return null;

  const groupData = groupView === 'subdivision' ? kpi.bySubdivision
    : groupView === 'region' ? kpi.byRegion
    : kpi.byProductGroup;
  const maxShipped = Math.max(...groupData.map(d => d.shipped), 1);

  return (
    <div className="space-y-5">

      {/* Files badges */}
      <div className="flex flex-wrap gap-2">
        {parsedFiles.map(f => (
          <span key={f.fileName} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600 border border-gray-200">
            <Package size={11} className="mr-1.5 text-[#E91E8C]" />
            {f.productGroup} · {f.reportType} · {f.period || f.fileName}
          </span>
        ))}
      </div>

      {/* KPI row 1 — main metrics (accent) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Всего к вывозу"
          value={kpi.totalToShip.toLocaleString('ru-RU')}
          subtitle="шт. · все регионы"
          icon={Package}
          accent
        />
        <KpiCard
          title="Отгружено"
          value={kpi.totalShipped.toLocaleString('ru-RU')}
          subtitle={`шт. · ср. ${kpi.avgShippedPct.toFixed(1)}%`}
          icon={Truck}
          accent
          onClick={() => navigate('/shipments')}
        />
        <KpiCard
          title="Получено"
          value={kpi.totalReceived.toLocaleString('ru-RU')}
          subtitle="шт. · все регионы"
          icon={CheckCircle}
          accent
        />
        <KpiCard
          title="Проблемных"
          value={kpi.problemStores}
          subtitle={`из ${kpi.storesCount} маг. СПБ/БЕЛ`}
          icon={AlertTriangle}
          accent={kpi.problemStores > 0}
          onClick={() => navigate('/control')}
        />
      </div>

      {/* KPI row 2 — secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Кол-во вывозов"  value={kpi.totalShipments.toLocaleString('ru-RU')}  subtitle="заказов · все регионы" icon={Truck} />
        <KpiCard title="Остаток"          value={kpi.totalRemaining.toLocaleString('ru-RU')}  subtitle="шт. нераспределено"   icon={Package} />
        <KpiCard title="Возврат"          value={kpi.totalReturn.toLocaleString('ru-RU')}     subtitle="шт. · все регионы"    icon={TrendingDown} />
        <KpiCard title="Вычерк"           value={kpi.totalWriteoff.toLocaleString('ru-RU')}   subtitle="шт. · все регионы"    icon={AlertTriangle} />
      </div>

      {/* Grouped bar chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <SectionTitle>Отгружено по группировке</SectionTitle>
          <div className="flex gap-1.5">
            <Tab active={groupView === 'subdivision'}  onClick={() => setGroupView('subdivision')}>Подразделения СПБ/БЕЛ</Tab>
            <Tab active={groupView === 'region'}       onClick={() => setGroupView('region')}>Все регионы</Tab>
            <Tab active={groupView === 'productGroup'} onClick={() => setGroupView('productGroup')}>Группы товаров</Tab>
          </div>
        </div>
        <div className="space-y-0">
          {groupData.map(d => (
            <BarRow key={d.name} label={d.name} value={d.shipped} max={maxShipped} pct={d.pct} extra={`${d.pct.toFixed(0)}%`} />
          ))}
          {groupData.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Нет данных</p>}
        </div>
      </div>

      {/* Side-by-side detail tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* All regions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <SectionTitle>По регионам — все данные</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-[#E91E8C]/20 text-gray-500">
                  <th className="pb-2 text-left font-semibold">Регион</th>
                  <th className="pb-2 text-right font-semibold">К вывозу</th>
                  <th className="pb-2 text-right font-semibold">Отгружено</th>
                  <th className="pb-2 text-right font-semibold">%</th>
                  <th className="pb-2 text-right font-semibold">Маг.</th>
                </tr>
              </thead>
              <tbody>
                {kpi.byRegion.map(r => (
                  <tr key={r.name} className="border-b border-gray-50 hover:bg-red-50/30 transition-colors">
                    <td className="py-1.5 font-medium text-gray-800">{r.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.toShip.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right font-semibold text-gray-900">{r.shipped.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right"><PctBadge pct={r.pct} /></td>
                    <td className="py-1.5 text-right text-gray-500">{r.storeCount}</td>
                  </tr>
                ))}
                {kpi.byRegion.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-400">Нет данных</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SPB/BEL subdivisions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <SectionTitle>По подразделениям — СПБ и БЕЛ</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-[#E91E8C]/20 text-gray-500">
                  <th className="pb-2 text-left font-semibold">Подразделение</th>
                  <th className="pb-2 text-right font-semibold">К вывозу</th>
                  <th className="pb-2 text-right font-semibold">Отгружено</th>
                  <th className="pb-2 text-right font-semibold">%</th>
                  <th className="pb-2 text-right font-semibold">Маг.</th>
                </tr>
              </thead>
              <tbody>
                {kpi.bySubdivision.map(r => (
                  <tr key={r.name} className="border-b border-gray-50 hover:bg-red-50/30 transition-colors">
                    <td className="py-1.5 font-medium text-gray-800">{r.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.toShip.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right font-semibold text-gray-900">{r.shipped.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right"><PctBadge pct={r.pct} /></td>
                    <td className="py-1.5 text-right text-gray-500">{r.storeCount}</td>
                  </tr>
                ))}
                {kpi.bySubdivision.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-400">Нет данных</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Product groups */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <SectionTitle>По группам товаров — все регионы</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {kpi.byProductGroup.map(g => (
            <div key={g.name} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#E91E8C]/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-800">{g.name}</div>
                <PctBadge pct={g.pct} />
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>К вывозу</span>
                  <span className="font-semibold text-gray-800">{g.toShip.toLocaleString('ru-RU')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Отгружено</span>
                  <span className="font-semibold text-gray-800">{g.shipped.toLocaleString('ru-RU')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Получено</span>
                  <span className="font-semibold text-gray-800">{g.received.toLocaleString('ru-RU')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Вывозов</span>
                  <span className="font-semibold text-gray-800">{g.shipments.toLocaleString('ru-RU')}</span>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(g.pct, 100)}%`,
                      backgroundColor: g.pct >= 90 ? '#22c55e' : g.pct >= 70 ? '#f59e0b' : '#E91E8C',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          {kpi.byProductGroup.length === 0 && (
            <p className="text-sm text-gray-400 col-span-3 text-center py-4">Нет данных</p>
          )}
        </div>
      </div>

    </div>
  );
}
