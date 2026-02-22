import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { getField, getNum } from '../utils/excelParser';
import { Search, X, ChevronUp, ChevronDown, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── helpers ────────────────────────────────────────────────────────────────

function pctColor(val, thresholds) {
  const n = parseFloat(val);
  if (isNaN(n)) return 'text-gray-400';
  if (n >= thresholds[1]) return 'text-green-600 font-medium';
  if (n >= thresholds[0]) return 'text-amber-600 font-medium';
  return 'text-red-600 font-semibold';
}

function PctBadge({ value, good, warn }) {
  const n = parseFloat(value);
  if (value === null || value === undefined || isNaN(n)) return <span className="text-gray-400 text-xs">—</span>;
  const cls = n >= good
    ? 'bg-green-100 text-green-700'
    : n >= warn
    ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  return <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{n.toFixed(1)}%</span>;
}

function NumCell({ value }) {
  if (value === null || value === undefined || value === '') return <span className="text-gray-400 text-xs">—</span>;
  const n = parseFloat(value);
  return <span className="text-gray-700 text-xs">{isNaN(n) ? value : n.toLocaleString('ru-RU')}</span>;
}

const COLUMNS = [
  { key: 'Регион',                             label: 'Регион',       w: 'min-w-[70px]' },
  { key: 'Подразделение',                      label: 'Подразд.',     w: 'min-w-[90px]' },
  { key: 'Магазин',                            label: 'Магазин',      w: 'min-w-[130px]' },
  { key: 'ТЦ',                                 label: 'ТЦ',           w: 'min-w-[140px]' },
  { key: 'Всего к вывозу шт',                  label: 'К вывозу',     w: 'min-w-[80px]',  type: 'num' },
  { key: 'Отгружено шт',                       label: 'Отгружено',    w: 'min-w-[80px]',  type: 'num' },
  { key: 'Кол-во вывозов',                     label: 'Вывозов',      w: 'min-w-[70px]',  type: 'num' },
  { key: 'Отгружено товара %',                 label: 'Отгр. %',      w: 'min-w-[80px]',  type: 'pct_ship' },
  { key: 'Вычерк по сборке %',                 label: 'Вычерк %',     w: 'min-w-[80px]',  type: 'pct_bad' },
  { key: 'Возврат от агрегатора %',            label: 'Возврат %',    w: 'min-w-[80px]',  type: 'pct_bad' },
  { key: 'Вычерк + Возврат + Отменено %',      label: 'В+В+О %',      w: 'min-w-[80px]',  type: 'pct_bad' },
  { key: 'Дней сборки',                        label: 'Дн.сборки',    w: 'min-w-[75px]',  type: 'num' },
  { key: 'Дней отгрузки',                      label: 'Дн.отгр.',     w: 'min-w-[75px]',  type: 'num' },
  { key: 'Осталось отгрузить пар шт',          label: 'Остаток',      w: 'min-w-[75px]',  type: 'num' },
  { key: 'Получено шт',                        label: 'Получено',     w: 'min-w-[80px]',  type: 'num' },
  { key: 'Возврат от агрегатора шт',           label: 'Возврат шт',   w: 'min-w-[80px]',  type: 'num' },
  { key: 'Вычерк шт',                          label: 'Вычерк шт',    w: 'min-w-[75px]',  type: 'num' },
];

function renderCell(row, col) {
  const val = getField(row, col.key);
  if (col.type === 'pct_ship') return <PctBadge value={val} good={90} warn={70} />;
  if (col.type === 'pct_bad')  return <PctBadge value={val !== null ? (parseFloat(val) > 100 ? val : val) : null} good={5} warn={15} />;
  if (col.type === 'num')      return <NumCell value={val} />;
  return <span className="text-gray-700 text-xs">{val ?? '—'}</span>;
}

// ─── Tab button ──────────────────────────────────────────────────────────────

function Tab({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
        active
          ? 'bg-red-600 text-white'
          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

export default function ShipmentsPage() {
  const { spbBelSummary, parsedFiles } = useData();
  const navigate = useNavigate();

  const [periodTab, setPeriodTab]   = useState('all');   // all | Неделя | Месяц
  const [groupTab, setGroupTab]     = useState('all');   // all | Обувь | Кидс | Одежда для детей
  const [search, setSearch]         = useState('');
  const [subdivFilter, setSubdivFilter] = useState('');
  const [problemOnly, setProblemOnly]   = useState(false);
  const [sortKey, setSortKey]       = useState('');
  const [sortDir, setSortDir]       = useState('desc');
  const [page, setPage]             = useState(1);

  // Unique period / group values
  const periods = useMemo(() => ['all', ...new Set(spbBelSummary.map(r => r._reportType).filter(Boolean))].sort(), [spbBelSummary]);
  const groups  = useMemo(() => ['all', ...new Set(spbBelSummary.map(r => r._productGroup).filter(Boolean))].sort(), [spbBelSummary]);
  const subdivs = useMemo(() => [...new Set(spbBelSummary.map(r => r['Подразделение']).filter(Boolean))].sort(), [spbBelSummary]);

  const filtered = useMemo(() => {
    let data = spbBelSummary;
    if (periodTab !== 'all') data = data.filter(r => r._reportType === periodTab);
    if (groupTab  !== 'all') data = data.filter(r => r._productGroup === groupTab);
    if (subdivFilter)        data = data.filter(r => r['Подразделение'] === subdivFilter);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        String(r['Магазин'] || '').toLowerCase().includes(q) ||
        String(r['ТЦ'] || '').toLowerCase().includes(q) ||
        String(r['Подразделение'] || '').toLowerCase().includes(q)
      );
    }
    if (problemOnly) {
      data = data.filter(r => {
        const sp = getNum(r, 'Отгружено товара %');
        const wp = getNum(r, 'Вычерк по сборке %');
        return sp < 80 || wp > 15;
      });
    }
    if (sortKey) {
      data = [...data].sort((a, b) => {
        const av = getField(a, sortKey), bv = getField(b, sortKey);
        const an = parseFloat(av), bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
        return sortDir === 'asc'
          ? String(av||'').localeCompare(String(bv||''), 'ru')
          : String(bv||'').localeCompare(String(av||''), 'ru');
      });
    }
    return data;
  }, [spbBelSummary, periodTab, groupTab, subdivFilter, search, problemOnly, sortKey, sortDir]);

  const paginated   = useMemo(() => filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE), [filtered, page]);
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  }

  function resetFilters() {
    setSearch(''); setSubdivFilter(''); setProblemOnly(false); setPage(1);
  }

  function exportToExcel() {
    const exportData = filtered.map(row => {
      const obj = {};
      COLUMNS.forEach(col => { obj[col.label] = getField(row, col.key) ?? ''; });
      obj['Период'] = row._reportType;
      obj['Группа'] = row._productGroup;
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Вывозы');
    XLSX.writeFile(wb, 'vyvoz_spb_bel.xlsx');
  }

  if (!parsedFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Upload size={32} className="text-gray-300 mb-3" />
        <p className="text-gray-500 mb-3">Нет загруженных данных</p>
        <button onClick={() => navigate('/upload')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
          Загрузить файлы
        </button>
      </div>
    );
  }

  // count per tab
  const countFor = (p, g) => spbBelSummary.filter(r =>
    (p === 'all' || r._reportType === p) &&
    (g === 'all' || r._productGroup === g)
  ).length;

  return (
    <div className="space-y-3">

      {/* Period tabs — top level */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Период</p>
        <div className="flex flex-wrap gap-2">
          {periods.map(p => (
            <Tab key={p} active={periodTab === p} onClick={() => { setPeriodTab(p); setPage(1); }}
              count={p !== 'all' ? countFor(p, groupTab) : undefined}>
              {p === 'all' ? 'Все периоды' : p}
            </Tab>
          ))}
        </div>

        {/* Group tabs — second level */}
        <p className="text-xs text-gray-500 mt-3 mb-2 font-medium uppercase tracking-wide">Группа товаров</p>
        <div className="flex flex-wrap gap-2">
          {groups.map(g => (
            <Tab key={g} active={groupTab === g} onClick={() => { setGroupTab(g); setPage(1); }}
              count={g !== 'all' ? countFor(periodTab, g) : undefined}>
              {g === 'all' ? 'Все группы' : g}
            </Tab>
          ))}
        </div>
      </div>

      {/* Filters row */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-40">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по магазину, ТЦ..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>
          <select
            value={subdivFilter}
            onChange={e => { setSubdivFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
          >
            <option value="">Все подразделения</option>
            {subdivs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-600">
            <input type="checkbox" checked={problemOnly} onChange={e => { setProblemOnly(e.target.checked); setPage(1); }} className="rounded text-red-600" />
            Проблемные
          </label>
          {(search || subdivFilter || problemOnly) && (
            <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              <X size={13} /> Сбросить
            </button>
          )}
          <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Count */}
      <div className="flex justify-between text-sm text-gray-500 px-1">
        <span>Магазинов: <strong className="text-gray-900">{filtered.length}</strong></span>
        <span>Стр. {page} / {totalPages || 1}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-2.5 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap select-none ${col.w}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-gray-400">Нет данных</td></tr>
              ) : paginated.map((row, idx) => {
                const sp = getNum(row, 'Отгружено товара %');
                const wp = getNum(row, 'Вычерк по сборке %');
                const isProblem = sp > 0 && sp < 80 || wp > 15;
                return (
                  <tr key={idx} className={`border-b border-gray-100 hover:bg-gray-50 ${isProblem ? 'bg-red-50/40' : ''}`}>
                    {COLUMNS.map(col => (
                      <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">←</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i+1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1.5 text-sm border rounded-lg ${page===p ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
          {totalPages > 7 && <span className="text-gray-400 text-sm">...</span>}
          <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">→</button>
        </div>
      )}
    </div>
  );
}
