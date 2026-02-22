import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { getField, getNum } from '../utils/excelParser';
import { Truck, Package, AlertTriangle, CheckCircle, TrendingDown, Upload } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, icon: Icon, color, onClick }) {
  const iconBg = { blue:'bg-blue-100', green:'bg-green-100', red:'bg-red-100', amber:'bg-amber-100', purple:'bg-purple-100' };
  const iconCl = { blue:'text-blue-600', green:'text-green-600', red:'text-red-600', amber:'text-amber-600', purple:'text-purple-600' };
  return (
    <div onClick={onClick} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 ${onClick?'cursor-pointer hover:shadow-md transition-shadow':''}`}>
      <div className={`inline-flex p-2 rounded-lg ${iconBg[color]}`}>
        <Icon size={18} className={iconCl[color]} />
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm font-medium text-gray-700 mt-0.5">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

function BarRow({ label, value, max, color = 'blue', extra }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colors = { blue:'bg-blue-500', green:'bg-green-500', red:'bg-red-500', amber:'bg-amber-500' };
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-28 text-xs text-gray-600 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${colors[color]||'bg-blue-500'}`} style={{ width:`${pct}%` }} />
      </div>
      <div className="w-20 text-xs font-medium text-gray-900 text-right flex-shrink-0">{value?.toLocaleString('ru-RU') ?? '—'}</div>
      {extra && <div className="w-14 text-xs text-gray-500 text-right flex-shrink-0">{extra}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-sm font-semibold text-gray-700 mb-3">{children}</h2>;
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      {children}
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { spbBelSummary, parsedFiles } = useData();
  const navigate = useNavigate();
  const [groupView, setGroupView] = useState('subdivision'); // subdivision | region | productGroup

  const kpi = useMemo(() => {
    if (!spbBelSummary.length) return null;
    const sum = (key) => spbBelSummary.reduce((s, r) => s + getNum(r, key), 0);

    const totalToShip  = sum('Всего к вывозу шт');
    const totalShipped = sum('Отгружено шт');
    const totalReceived= sum('Получено шт');
    const totalReturn  = sum('Возврат от агрегатора шт');
    const totalWriteoff= sum('Вычерк шт');
    const totalShipments=sum('Кол-во вывозов');
    const totalRemaining=sum('Осталось отгрузить пар шт');
    const stores = new Set(spbBelSummary.map(r => `${r['Магазин']}|${r['_productGroup']}|${r['_reportType']}`)).size;

    const problemStores = spbBelSummary.filter(r => {
      const sp = getNum(r, 'Отгружено товара %');
      const wp = getNum(r, 'Вычерк по сборке %');
      return (sp > 0 && sp < 80) || wp > 15;
    });

    const avgShippedPct = spbBelSummary.length
      ? spbBelSummary.reduce((s, r) => s + getNum(r, 'Отгружено товара %'), 0) / spbBelSummary.length
      : 0;

    // Group aggregation helper
    const groupBy = (key) => {
      const map = {};
      spbBelSummary.forEach(r => {
        const k = String(getField(r, key) || 'Неизвестно');
        if (!map[k]) map[k] = { name: k, shipped: 0, toShip: 0, received: 0, shipments: 0, stores: new Set() };
        map[k].shipped    += getNum(r, 'Отгружено шт');
        map[k].toShip     += getNum(r, 'Всего к вывозу шт');
        map[k].received   += getNum(r, 'Получено шт');
        map[k].shipments  += getNum(r, 'Кол-во вывозов');
        map[k].stores.add(r['Магазин']);
      });
      return Object.values(map)
        .map(v => ({ ...v, storeCount: v.stores.size, pct: v.toShip > 0 ? (v.shipped / v.toShip * 100) : 0 }))
        .sort((a, b) => b.shipped - a.shipped);
    };

    return {
      totalToShip, totalShipped, totalReceived, totalReturn, totalWriteoff,
      totalShipments, totalRemaining, stores, avgShippedPct,
      problemStores: problemStores.length,
      bySubdivision: groupBy('Подразделение'),
      byRegion:      groupBy('Регион'),
      byProductGroup:groupBy('_productGroup'),
    };
  }, [spbBelSummary]);

  if (!parsedFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Upload size={28} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Нет данных</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-xs">Загрузите Excel-файлы с отчётами вывозов</p>
        <button onClick={() => navigate('/upload')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
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
          <span key={f.fileName} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
            <Package size={11} className="mr-1.5" />
            {f.productGroup} · {f.reportType} · {f.period || f.fileName}
          </span>
        ))}
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Всего к вывозу"    value={kpi.totalToShip.toLocaleString('ru-RU')}   subtitle="шт."                              icon={Package}       color="blue" />
        <KpiCard title="Отгружено"         value={kpi.totalShipped.toLocaleString('ru-RU')}  subtitle={`шт. · ${kpi.avgShippedPct.toFixed(1)}%`} icon={Truck}   color="green" onClick={() => navigate('/shipments')} />
        <KpiCard title="Получено"          value={kpi.totalReceived.toLocaleString('ru-RU')} subtitle="шт."                              icon={CheckCircle}   color="purple" />
        <KpiCard title="Проблемных"        value={kpi.problemStores}                         subtitle={`из ${kpi.stores} строк`}         icon={AlertTriangle} color={kpi.problemStores > 0 ? 'red' : 'green'} onClick={() => navigate('/control')} />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Кол-во вывозов"    value={kpi.totalShipments.toLocaleString('ru-RU')}  subtitle="заказов"  icon={Truck}          color="blue" />
        <KpiCard title="Остаток"           value={kpi.totalRemaining.toLocaleString('ru-RU')}  subtitle="шт."      icon={Package}        color="amber" />
        <KpiCard title="Возврат"           value={kpi.totalReturn.toLocaleString('ru-RU')}     subtitle="шт."      icon={TrendingDown}   color="red" />
        <KpiCard title="Вычерк"            value={kpi.totalWriteoff.toLocaleString('ru-RU')}   subtitle="шт."      icon={AlertTriangle}  color="amber" />
      </div>

      {/* Grouped breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <SectionTitle>Отгружено по группировке</SectionTitle>
          <div className="flex gap-1.5">
            <Tab active={groupView === 'subdivision'}  onClick={() => setGroupView('subdivision')}>Подразделения</Tab>
            <Tab active={groupView === 'region'}       onClick={() => setGroupView('region')}>Регионы</Tab>
            <Tab active={groupView === 'productGroup'} onClick={() => setGroupView('productGroup')}>Группы товаров</Tab>
          </div>
        </div>

        <div className="space-y-0.5">
          {groupData.map(d => (
            <BarRow
              key={d.name}
              label={d.name}
              value={d.shipped}
              max={maxShipped}
              color="blue"
              extra={`${d.pct.toFixed(0)}%`}
            />
          ))}
          {groupData.length === 0 && <p className="text-sm text-gray-400">Нет данных</p>}
        </div>
      </div>

      {/* Side-by-side: regions + subdivisions detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* By region */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <SectionTitle>По регионам — детали</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="pb-2 text-left font-semibold">Регион</th>
                  <th className="pb-2 text-right font-semibold">К вывозу</th>
                  <th className="pb-2 text-right font-semibold">Отгружено</th>
                  <th className="pb-2 text-right font-semibold">%</th>
                  <th className="pb-2 text-right font-semibold">Магазинов</th>
                </tr>
              </thead>
              <tbody>
                {kpi.byRegion.map(r => (
                  <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 text-gray-700">{r.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.toShip.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right text-gray-800 font-medium">{r.shipped.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right">
                      <span className={`font-medium ${r.pct >= 90 ? 'text-green-600' : r.pct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                        {r.pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-1.5 text-right text-gray-500">{r.storeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* By subdivision */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <SectionTitle>По подразделениям — детали</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="pb-2 text-left font-semibold">Подразделение</th>
                  <th className="pb-2 text-right font-semibold">К вывозу</th>
                  <th className="pb-2 text-right font-semibold">Отгружено</th>
                  <th className="pb-2 text-right font-semibold">%</th>
                  <th className="pb-2 text-right font-semibold">Маг.</th>
                </tr>
              </thead>
              <tbody>
                {kpi.bySubdivision.map(r => (
                  <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 text-gray-700">{r.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.toShip.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right text-gray-800 font-medium">{r.shipped.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right">
                      <span className={`font-medium ${r.pct >= 90 ? 'text-green-600' : r.pct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                        {r.pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-1.5 text-right text-gray-500">{r.storeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* By product group */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <SectionTitle>По группам товаров</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {kpi.byProductGroup.map(g => (
            <div key={g.name} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="text-sm font-semibold text-gray-800 mb-2">{g.name}</div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between"><span>К вывозу</span><span className="font-medium text-gray-800">{g.toShip.toLocaleString('ru-RU')}</span></div>
                <div className="flex justify-between"><span>Отгружено</span><span className="font-medium text-gray-800">{g.shipped.toLocaleString('ru-RU')}</span></div>
                <div className="flex justify-between"><span>Получено</span><span className="font-medium text-gray-800">{g.received.toLocaleString('ru-RU')}</span></div>
                <div className="flex justify-between"><span>Вывозов</span><span className="font-medium text-gray-800">{g.shipments.toLocaleString('ru-RU')}</span></div>
              </div>
              <div className="mt-2">
                <div className="bg-gray-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${g.pct >= 90 ? 'bg-green-500' : g.pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width:`${Math.min(g.pct, 100)}%` }} />
                </div>
                <div className={`text-xs font-semibold mt-1 ${g.pct >= 90 ? 'text-green-600' : g.pct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                  {g.pct.toFixed(1)}% отгружено
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
