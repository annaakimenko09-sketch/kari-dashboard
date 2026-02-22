import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, CheckCircle, Upload, Filter } from 'lucide-react';
import { getField, getNum } from '../utils/excelParser';

const PROBLEM_TYPES = {
  low_shipped: { label: 'Отгр. < 70%', color: 'red', description: 'Низкий % отгрузки' },
  medium_shipped: { label: 'Отгр. 70-80%', color: 'amber', description: 'Умеренный % отгрузки' },
  high_writeoff: { label: 'Вычерк > 15%', color: 'red', description: 'Высокий вычерк' },
  high_return: { label: 'Возврат > 15%', color: 'amber', description: 'Высокий возврат' },
  remaining: { label: 'Остаток > 0', color: 'blue', description: 'Есть нераспределённые пары' },
};

function getProblemTypes(row) {
  const types = [];
  const sp = getNum(row, 'Отгружено товара %') || 100;
  const wp = getNum(row, 'Вычерк по сборке %');
  const rp = getNum(row, 'Возврат от агрегатора %');
  const rem = getNum(row, 'Осталось отгрузить пар шт');

  if (sp < 70) types.push('low_shipped');
  else if (sp < 80) types.push('medium_shipped');
  if (wp > 15) types.push('high_writeoff');
  if (rp > 15) types.push('high_return');
  if (rem > 0) types.push('remaining');

  return types;
}

function getSeverity(types) {
  if (types.includes('low_shipped') || types.includes('high_writeoff')) return 'critical';
  if (types.includes('medium_shipped') || types.includes('high_return')) return 'warning';
  return 'info';
}

const SEVERITY = {
  critical: { icon: AlertCircle, bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  info: { icon: CheckCircle, bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
};

function ProblemBadge({ type }) {
  const pt = PROBLEM_TYPES[type];
  const colorMap = {
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[pt.color]}`}>
      {pt.label}
    </span>
  );
}

export default function ControlPage() {
  const { spbBelSummary, parsedFiles } = useData();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [subdivFilter, setSubdivFilter] = useState('');

  const problems = useMemo(() => {
    return spbBelSummary
      .map(row => {
        const types = getProblemTypes(row);
        return { row, types, severity: getSeverity(types) };
      })
      .filter(({ types }) => types.length > 0)
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      });
  }, [spbBelSummary]);

  const subdivisions = useMemo(() => {
    return [...new Set(problems.map(p => p.row['Подразделение']).filter(Boolean))].sort();
  }, [problems]);

  const filtered = useMemo(() => {
    let data = problems;
    if (activeFilter !== 'all') {
      data = data.filter(p => p.severity === activeFilter || p.types.includes(activeFilter));
    }
    if (subdivFilter) {
      data = data.filter(p => p.row['Подразделение'] === subdivFilter);
    }
    return data;
  }, [problems, activeFilter, subdivFilter]);

  const counts = useMemo(() => ({
    all: problems.length,
    critical: problems.filter(p => p.severity === 'critical').length,
    warning: problems.filter(p => p.severity === 'warning').length,
    info: problems.filter(p => p.severity === 'info').length,
  }), [problems]);

  if (!parsedFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Upload size={32} className="text-gray-300 mb-3" />
        <p className="text-gray-500 mb-3">Нет загруженных данных</p>
        <button onClick={() => navigate('/upload')} className="px-4 py-2 bg-[#E91E8C] text-white rounded-lg text-sm font-medium hover:bg-[#c51878]">
          Загрузить файлы
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={18} className="text-red-600" />
          <span className="font-semibold text-red-800">
            {counts.all} магазинов требуют внимания
          </span>
        </div>
        <div className="text-xs text-red-600">
          Критерии: Отгружено &lt; 80%, Вычерк &gt; 15%, Возврат &gt; 15%, Остаток &gt; 0
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: `Все проблемы (${counts.all})`, color: 'gray' },
          { key: 'critical', label: `Критические (${counts.critical})`, color: 'red' },
          { key: 'warning', label: `Предупреждения (${counts.warning})`, color: 'amber' },
          { key: 'info', label: `Информационные (${counts.info})`, color: 'blue' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? tab.color === 'red' ? 'bg-[#E91E8C] text-white'
                  : tab.color === 'amber' ? 'bg-amber-500 text-white'
                  : tab.color === 'blue' ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <select
          value={subdivFilter}
          onChange={e => setSubdivFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          <option value="">Все подразделения</option>
          {subdivisions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Problem cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
            <p className="text-green-700 font-medium">Нет проблемных магазинов</p>
            <p className="text-green-600 text-sm">По выбранным фильтрам все показатели в норме</p>
          </div>
        )}

        {filtered.map(({ row, types, severity }, idx) => {
          const sv = SEVERITY[severity];
          const SvIcon = sv.icon;
          const sp = getNum(row, 'Отгружено товара %');
          const wp = getNum(row, 'Вычерк по сборке %');
          const rp = getNum(row, 'Возврат от агрегатора %');
          const rem = getNum(row, 'Осталось отгрузить пар шт');
          const shipped = getNum(row, 'Отгружено шт');
          const toShip = getNum(row, 'Всего к вывозу шт');
          const shipments = getNum(row, 'Кол-во вывозов');

          return (
            <div key={idx} className={`rounded-xl border p-4 ${sv.bg} ${sv.border}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sv.dot}`} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">
                        {row['Магазин'] || '—'}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {row['ТЦ'] || ''}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {row['Подразделение'] || ''} · {row['_productGroup']} · {row['_reportType']}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {types.map(t => <ProblemBadge key={t} type={t} />)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
                {[
                  { label: 'К вывозу', value: toShip.toLocaleString('ru-RU'), unit: 'шт' },
                  { label: 'Отгружено', value: shipped.toLocaleString('ru-RU'), unit: 'шт' },
                  { label: 'Отгруж. %', value: sp.toFixed(1), unit: '%', alert: sp < 80 },
                  { label: 'Вычерк %', value: wp.toFixed(1), unit: '%', alert: wp > 15 },
                  { label: 'Возврат %', value: rp.toFixed(1), unit: '%', alert: rp > 15 },
                  { label: 'Остаток', value: rem.toLocaleString('ru-RU'), unit: 'шт', alert: rem > 0 },
                ].map(m => (
                  <div key={m.label} className="bg-white/60 rounded-lg p-2">
                    <div className="text-xs text-gray-500">{m.label}</div>
                    <div className={`text-sm font-semibold ${m.alert ? 'text-red-700' : 'text-gray-900'}`}>
                      {m.value} <span className="text-xs font-normal text-gray-400">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
