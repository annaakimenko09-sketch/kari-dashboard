import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Truck, Package, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Upload } from 'lucide-react';

function KpiCard({ title, value, subtitle, icon: Icon, color, trend, onClick }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };
  const iconBg = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    red: 'bg-red-100',
    amber: 'bg-amber-100',
    purple: 'bg-purple-100',
  };

  return (
    <div
      className={`bg-white rounded-xl border p-4 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${iconBg[color]}`}>
          <Icon size={20} className={`text-${color}-600`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm font-medium text-gray-700 mt-0.5">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

function StatRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
  };
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-32 text-sm text-gray-600 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colors[color] || 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-16 text-sm font-medium text-gray-900 text-right">{value?.toLocaleString('ru-RU') ?? '—'}</div>
    </div>
  );
}

function EmptyState({ onNavigate }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Upload size={28} className="text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">Нет данных</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-xs">
        Загрузите Excel-файлы с отчётами вывозов, чтобы увидеть аналитику
      </p>
      <button
        onClick={onNavigate}
        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
      >
        Загрузить файлы
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const { spbBelSummary, parsedFiles } = useData();
  const navigate = useNavigate();

  const kpi = useMemo(() => {
    if (!spbBelSummary.length) return null;

    const totalShipped = spbBelSummary.reduce((s, r) => s + (parseFloat(r['Отгружено, шт'] ?? r['Отгружено шт'] ?? 0) || 0), 0);
    const totalToShip = spbBelSummary.reduce((s, r) => s + (parseFloat(r['Всего к вывозу, шт'] ?? r['Всего к вывозу шт'] ?? 0) || 0), 0);
    const totalReceived = spbBelSummary.reduce((s, r) => s + (parseFloat(r['Получено, шт'] ?? r['Получено шт'] ?? 0) || 0), 0);
    const totalReturn = spbBelSummary.reduce((s, r) => s + (parseFloat(r['Возврат от агрегатора, шт'] ?? r['Возврат от агрегатора шт'] ?? 0) || 0), 0);
    const totalWriteoff = spbBelSummary.reduce((s, r) => s + (parseFloat(r['Вычерк, шт'] ?? r['Вычерк шт'] ?? 0) || 0), 0);
    const totalShipments = spbBelSummary.reduce((s, r) => s + (parseFloat(r['Кол-во вывозов'] ?? 0) || 0), 0);
    const totalRemaining = spbBelSummary.reduce((s, r) => s + (parseFloat(r['Осталось отгрузить пар, шт'] ?? r['Осталось отгрузить пар шт'] ?? 0) || 0), 0);

    const stores = new Set(spbBelSummary.map(r => r['Магазин'])).size;

    // Percent metrics
    const avgShippedPct = spbBelSummary
      .map(r => parseFloat(r['Отгружено товара, %'] ?? r['Отгружено товара %'] ?? 0) || 0)
      .reduce((s, v, _, a) => s + v / a.length, 0);

    const avgReturnPct = spbBelSummary
      .map(r => parseFloat(r['Возврат от агрегатора, %'] ?? r['Возврат от агрегатора %'] ?? 0) || 0)
      .reduce((s, v, _, a) => s + v / a.length, 0);

    // Problem stores: отгружено <80% or вычерк >15%
    const problemStores = spbBelSummary.filter(r => {
      const sp = parseFloat(r['Отгружено товара, %'] ?? r['Отгружено товара %'] ?? 100) || 100;
      const wp = parseFloat(r['Вычерк по сборке, %'] ?? r['Вычерк по сборке %'] ?? 0) || 0;
      return sp < 80 || wp > 15;
    });

    // By subdivision
    const bySubdiv = {};
    spbBelSummary.forEach(r => {
      const sub = r['Подразделение'] || 'Неизвестно';
      if (!bySubdiv[sub]) bySubdiv[sub] = { shipped: 0, total: 0 };
      bySubdiv[sub].shipped += parseFloat(r['Отгружено, шт'] ?? r['Отгружено шт'] ?? 0) || 0;
      bySubdiv[sub].total += parseFloat(r['Всего к вывозу, шт'] ?? r['Всего к вывозу шт'] ?? 0) || 0;
    });

    return {
      totalShipped, totalToShip, totalReceived, totalReturn, totalWriteoff,
      totalShipments, totalRemaining, stores, avgShippedPct, avgReturnPct,
      problemStores: problemStores.length, bySubdiv,
    };
  }, [spbBelSummary]);

  if (!parsedFiles.length) {
    return (
      <div className="max-w-2xl mx-auto">
        <EmptyState onNavigate={() => navigate('/upload')} />
      </div>
    );
  }

  if (!kpi) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Нет данных по регионам СПБ и БЕЛ в загруженных файлах.</p>
        <button onClick={() => navigate('/upload')} className="mt-3 text-red-600 underline text-sm">
          Загрузить другие файлы
        </button>
      </div>
    );
  }

  const subdivEntries = Object.entries(kpi.bySubdiv).sort((a, b) => b[1].shipped - a[1].shipped);
  const maxShipped = Math.max(...subdivEntries.map(([, v]) => v.shipped), 1);

  return (
    <div className="space-y-6">
      {/* Loaded files info */}
      <div className="flex flex-wrap gap-2">
        {parsedFiles.map(f => (
          <span key={f.fileName} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
            <Package size={12} className="mr-1.5" />
            {f.fileName} · {f.reportType} · {f.productGroup}
          </span>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard
          title="Всего к вывозу"
          value={kpi.totalToShip.toLocaleString('ru-RU')}
          subtitle="шт."
          icon={Package}
          color="blue"
        />
        <KpiCard
          title="Отгружено"
          value={kpi.totalShipped.toLocaleString('ru-RU')}
          subtitle={`шт. · ${kpi.avgShippedPct.toFixed(1)}%`}
          icon={Truck}
          color="green"
          onClick={() => navigate('/shipments')}
        />
        <KpiCard
          title="Получено"
          value={kpi.totalReceived.toLocaleString('ru-RU')}
          subtitle="шт."
          icon={CheckCircle}
          color="purple"
        />
        <KpiCard
          title="Проблемные"
          value={kpi.problemStores}
          subtitle={`из ${kpi.stores} магазинов`}
          icon={AlertTriangle}
          color={kpi.problemStores > 0 ? 'red' : 'green'}
          onClick={() => navigate('/control')}
        />
      </div>

      {/* Second row of KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard
          title="Кол-во вывозов"
          value={kpi.totalShipments.toLocaleString('ru-RU')}
          subtitle="всего заказов"
          icon={Truck}
          color="blue"
        />
        <KpiCard
          title="Осталось отгрузить"
          value={kpi.totalRemaining.toLocaleString('ru-RU')}
          subtitle="шт."
          icon={Package}
          color="amber"
        />
        <KpiCard
          title="Возврат от агрегатора"
          value={kpi.totalReturn.toLocaleString('ru-RU')}
          subtitle={`шт. · ${kpi.avgReturnPct.toFixed(1)}%`}
          icon={TrendingDown}
          color="red"
        />
        <KpiCard
          title="Вычерк по сборке"
          value={kpi.totalWriteoff.toLocaleString('ru-RU')}
          subtitle="шт."
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* By subdivision */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Отгружено по подразделениям, шт</h2>
          <div className="space-y-0.5">
            {subdivEntries.slice(0, 10).map(([sub, val]) => (
              <StatRow key={sub} label={sub} value={val.shipped} max={maxShipped} color="blue" />
            ))}
            {subdivEntries.length === 0 && (
              <p className="text-sm text-gray-400">Нет данных</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Загруженные файлы</h2>
          <div className="space-y-2">
            {parsedFiles.map(f => (
              <div key={f.fileName} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 truncate mr-2">{f.fileName}</span>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                    f.reportType === 'Неделя' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {f.reportType}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{f.period || 'Период не определён'}</div>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>Магазинов: {f.summary.length}</span>
                  <span>Заказов: {f.detail.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
