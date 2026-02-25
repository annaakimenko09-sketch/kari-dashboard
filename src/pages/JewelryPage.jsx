import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { ChevronDown, ChevronRight, Download, Upload, X, Search } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

const ACCENT = '#f59e0b'; // янтарный/золотой для ЮИ

// ─── Цветовой градиент (выше % = хуже = красный) ──────────────────────────

function interpolateColor(t) {
  let r, g, b;
  if (t <= 0.5) {
    const s = t * 2;
    r = Math.round(34  + (234 - 34)  * s);
    g = Math.round(197 + (179 - 197) * s);
    b = Math.round(94  + (8   - 94)  * s);
  } else {
    const s = (t - 0.5) * 2;
    r = Math.round(234 + (239 - 234) * s);
    g = Math.round(179 + (68  - 179) * s);
    b = Math.round(8   + (68  - 8)   * s);
  }
  return `rgb(${r},${g},${b})`;
}

function makeColorFn(values) {
  const valid = values.filter(v => v !== null && v !== undefined);
  if (valid.length === 0) return () => ({ bg: '#f3f4f6', text: '#9ca3af' });
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return (v) => {
    if (v === null || v === undefined) return { bg: '#f3f4f6', text: '#9ca3af' };
    const t = max === min ? 0.5 : (v - min) / (max - min);
    const color = interpolateColor(t);
    return { bg: color + '22', text: color };
  };
}

function gradientHex(t) {
  let r, g, b;
  if (t <= 0.5) {
    const s = t * 2;
    r = Math.round(34  + (234 - 34)  * s);
    g = Math.round(197 + (179 - 197) * s);
    b = Math.round(94  + (8   - 94)  * s);
  } else {
    const s = (t - 0.5) * 2;
    r = Math.round(234 + (239 - 234) * s);
    g = Math.round(179 + (68  - 179) * s);
    b = Math.round(8   + (68  - 8)   * s);
  }
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
}

function fmt(v) {
  if (v === null || v === undefined) return '—';
  return v.toFixed(1) + '%';
}

function fmtNum(v) {
  if (!v && v !== 0) return '—';
  return Number(v).toLocaleString('ru-RU');
}

// ─── Экспорт в Excel ──────────────────────────────────────────────────────

function exportJewelryExcel(rows, filename, pctField = 'pct') {
  const pctVals = rows.map(r => r[pctField]).filter(v => v != null);
  const pctMin = pctVals.length ? Math.min(...pctVals) : 0;
  const pctMax = pctVals.length ? Math.max(...pctVals) : 100;

  const headers = ['Регион', 'Подразделение', 'Магазин', 'Кол-во арт. всего', '% невыставленного', 'Дата последнего скан.'];
  const aoa = [headers, ...rows.map(r => [
    r.region || '', r.subdiv || '', r.store || '',
    r.artCount || '', r[pctField] ?? '', r.lastScan || '',
  ])];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Заголовок
  headers.forEach((_, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws[addr]) ws[addr] = { v: headers[ci], t: 's' };
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { fgColor: { rgb: 'FF374151' } },
      alignment: { horizontal: 'center', wrapText: true },
    };
  });

  // Данные — красим % столбец (col 4)
  rows.forEach((r, ri) => {
    const pct = r[pctField];
    const rowIdx = ri + 1;
    if (pct != null) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 4 });
      const t = pctMax === pctMin ? 0.5 : (pct - pctMin) / (pctMax - pctMin);
      ws[addr].s = {
        fill: { fgColor: { rgb: 'FF' + gradientHex(t) } },
        font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center' },
      };
      ws[addr].v = pct;
      ws[addr].t = 'n';
      ws[addr].z = '0.00"%"';
    }
  });

  ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ЮИ Итоги');
  XLSX.writeFile(wb, filename);
}

function exportUnexposedExcel(rows, filename) {
  const headers = ['Регион', 'Подразделение', 'Магазин', 'ТЦ', 'Группа', 'Артикул', 'Наименование', 'Ячейка'];
  const aoa = [headers, ...rows.map(r => [
    r.region || '', r.subdiv || '', r.store || '', r.tc || '',
    r.group || '', r.article || '', r.name || '', r.cell || '',
  ])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  headers.forEach((_, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws[addr]) ws[addr] = { v: headers[ci], t: 's' };
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { fgColor: { rgb: 'FF374151' } },
      alignment: { horizontal: 'center' },
    };
  });
  ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 28 }, { wch: 12 }, { wch: 40 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Невыставленный товар');
  XLSX.writeFile(wb, filename);
}

// ─── Фото товара с тултипом при наведении ────────────────────────────────

function PhotoThumb({ url, article }) {
  const [show, setShow] = useState(false);
  if (!url || url === '—') return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="relative inline-block">
      <img
        src={url}
        alt={article}
        className="w-8 h-8 object-cover rounded border border-gray-200 cursor-zoom-in"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onError={e => { e.target.style.display = 'none'; }}
      />
      {show && (
        <div className="absolute z-50 left-10 top-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-1" style={{ width: 180 }}>
          <img
            src={url}
            alt={article}
            className="w-full rounded-lg object-contain"
            style={{ maxHeight: 180 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <p className="text-xs text-center text-gray-500 mt-1 font-mono">{article}</p>
        </div>
      )}
    </div>
  );
}

// ─── Секция невыставленного товара по магазину ────────────────────────────

function UnexposedDetail({ store, subdiv, unexposedFile, accentColor }) {
  const [tab, setTab] = useState('all'); // 'all' | 'silver' | 'gold'
  const [search, setSearch] = useState('');

  const storeDetail = useMemo(() => {
    if (!unexposedFile) return [];
    return unexposedFile.detail.filter(r => r.store === store && r.subdiv === subdiv);
  }, [unexposedFile, store, subdiv]);

  const filtered = useMemo(() => {
    let rows = storeDetail;
    if (tab === 'silver') rows = rows.filter(r => !r.isGold);
    if (tab === 'gold')   rows = rows.filter(r => r.isGold);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.article.toLowerCase().includes(s) ||
        r.name.toLowerCase().includes(s) ||
        r.group.toLowerCase().includes(s)
      );
    }
    return rows;
  }, [storeDetail, tab, search]);

  const silverCount = storeDetail.filter(r => !r.isGold).length;
  const goldCount   = storeDetail.filter(r => r.isGold).length;

  if (!unexposedFile) return (
    <div className="px-4 py-3 text-sm text-gray-400">Файл «Невыставленный товар» не загружен</div>
  );

  if (storeDetail.length === 0) return (
    <div className="px-4 py-3 text-sm text-gray-400">Нет данных по этому магазину</div>
  );

  return (
    <div className="border-t border-gray-100">
      {/* Фильтры */}
      <div className="px-4 py-2 flex items-center gap-2 flex-wrap bg-gray-50 border-b border-gray-100">
        {[
          { key: 'all',    label: `Все (${storeDetail.length})` },
          { key: 'silver', label: `Серебро (${silverCount})` },
          { key: 'gold',   label: `Золото (${goldCount})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={tab === t.key
              ? { backgroundColor: accentColor, color: 'white' }
              : { backgroundColor: 'white', border: '1px solid #e5e7eb', color: '#4b5563' }
            }
          >
            {t.label}
          </button>
        ))}
        {/* Поиск */}
        <div className="relative flex items-center ml-auto">
          <Search size={13} className="absolute left-2.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Артикул / название..."
            className="pl-7 pr-3 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none w-44"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>
        {/* Выгрузка */}
        <button
          onClick={() => exportUnexposedExcel(filtered, `Невыставленный_${store}_${tab}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white"
          style={{ backgroundColor: '#16a34a' }}
        >
          <Download size={12} />
          Excel
        </button>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white border-b border-gray-100 sticky top-0">
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Фото</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Артикул</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Наименование</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Группа</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Ячейка</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">Нет данных</td></tr>
            ) : filtered.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-amber-50">
                <td className="px-3 py-1.5">
                  <PhotoThumb url={row.photoUrl} article={row.article} />
                </td>
                <td className="px-3 py-1.5 font-mono text-gray-700 whitespace-nowrap">{row.article}</td>
                <td className="px-3 py-1.5 text-gray-700">{row.name}</td>
                <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${row.isGold ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                    {row.isGold ? '🥇 Золото' : '⚪ Серебро'}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-gray-600">{row.cell}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
        Показано: {filtered.length} из {storeDetail.length}
      </div>
    </div>
  );
}

// ─── Основная страница ЮИ ─────────────────────────────────────────────────

export default function JewelryPage({ region }) {
  const {
    spbJewelryItogi, belJewelryItogi,
    jewelryUnexposedFile,
    loadFiles,
  } = useData();

  const itogiData = region === 'СПБ' ? spbJewelryItogi : belJewelryItogi;
  const accentColor = ACCENT;

  const [selectedSubdiv, setSelectedSubdiv] = useState('');
  const [sortDir, setSortDir] = useState('desc'); // desc = хуже сверху
  const [expandedStores, setExpandedStores] = useState({});

  if (!itogiData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Upload size={32} className="text-gray-300 mb-3" />
        <p className="text-gray-500 mb-1">Файл «ЮИ Итоги» для {region} не загружен</p>
        <p className="text-xs text-gray-400 mb-3">Загрузите файл на странице «Загрузить данные»</p>
      </div>
    );
  }

  const { period, subdivisions, stores } = itogiData;

  // Уникальные подразделения
  const allSubdivs = useMemo(() =>
    [...new Set(stores.map(r => r.subdiv).filter(Boolean))].sort(),
    [stores]
  );

  // Магазины по выбранному подразделению
  const filteredStores = useMemo(() => {
    let rows = selectedSubdiv ? stores.filter(r => r.subdiv === selectedSubdiv) : stores;
    return [...rows].sort((a, b) => {
      const av = a.pct ?? -1, bv = b.pct ?? -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [stores, selectedSubdiv, sortDir]);

  // Цветовая функция для подразделений и магазинов
  const subdivColorFn = useMemo(() =>
    makeColorFn(subdivisions.map(r => r.pct)), [subdivisions]);
  const storeColorFn  = useMemo(() =>
    makeColorFn(stores.map(r => r.pct)), [stores]);

  function toggleStore(key) {
    setExpandedStores(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Период отчёта (ЮИ Итоги)</p>
          <p className="font-semibold text-gray-800 text-sm">{period || '—'}</p>
          {jewelryUnexposedFile && (
            <p className="text-xs text-gray-400 mt-0.5">
              Невыставленный товар: {jewelryUnexposedFile.period}
            </p>
          )}
        </div>
        <div className="flex gap-2 text-xs flex-wrap">
          <span className="px-2 py-1 rounded font-medium" style={{ backgroundColor: '#ef444422', color: '#ef4444' }}>Хуже — красный</span>
          <span className="px-2 py-1 rounded font-medium" style={{ backgroundColor: '#eab30822', color: '#ca8a04' }}>Средний — жёлтый</span>
          <span className="px-2 py-1 rounded font-medium" style={{ backgroundColor: '#22c55e22', color: '#16a34a' }}>Лучше — зелёный</span>
        </div>
      </div>

      {/* Сводка по подразделениям */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Подразделения</h3>
          <button
            onClick={() => exportJewelryExcel(subdivisions, `ЮИ_${region}_подразделения_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#16a34a' }}
          >
            <Download size={12} />
            Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Подразделение</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Кол-во арт. всего</th>
                <th
                  className="px-4 py-2.5 text-center font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                >
                  <span className="inline-flex items-center gap-1">
                    % невыставленного
                    <span className="text-xs opacity-50">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  </span>
                </th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Дата последнего скан.</th>
              </tr>
            </thead>
            <tbody>
              {[...subdivisions]
                .sort((a, b) => sortDir === 'desc' ? (b.pct ?? -1) - (a.pct ?? -1) : (a.pct ?? -1) - (b.pct ?? -1))
                .map((row, i) => {
                  const c = subdivColorFn(row.pct);
                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{row.subdiv}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{fmtNum(row.artCount)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ color: c.text, backgroundColor: c.bg }}>
                          {fmt(row.pct)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{row.lastScan}</td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Магазины */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-700">Магазины</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Фильтр по подразделению */}
            <select
              value={selectedSubdiv}
              onChange={e => setSelectedSubdiv(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"
            >
              <option value="">Все подразделения</option>
              {allSubdivs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {selectedSubdiv && (
              <button onClick={() => setSelectedSubdiv('')} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
            <button
              onClick={() => exportJewelryExcel(
                filteredStores,
                `ЮИ_${region}_магазины${selectedSubdiv ? '_' + selectedSubdiv : ''}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`
              )}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: '#16a34a' }}
            >
              <Download size={12} />
              Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Подразделение</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Магазин</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Кол-во арт.</th>
                <th
                  className="px-4 py-2.5 text-center font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                >
                  <span className="inline-flex items-center gap-1">
                    % невыставленного
                    <span className="text-xs opacity-50">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  </span>
                </th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Дата скан.</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Невыставленный товар</th>
              </tr>
            </thead>
            <tbody>
              {filteredStores.map((row, i) => {
                const c = storeColorFn(row.pct);
                const key = `${row.subdiv}|${row.store}`;
                const isOpen = expandedStores[key];
                const hasUnexposed = jewelryUnexposedFile &&
                  jewelryUnexposedFile.detail.some(r => r.store === row.store && r.subdiv === row.subdiv);

                return (
                  <>
                    <tr key={key} className="border-b border-gray-100 hover:bg-amber-50">
                      <td className="px-4 py-2.5 text-gray-600 text-sm">{row.subdiv}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{row.store}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{fmtNum(row.artCount)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ color: c.text, backgroundColor: c.bg }}>
                          {fmt(row.pct)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{row.lastScan}</td>
                      <td className="px-4 py-2.5 text-center">
                        {hasUnexposed ? (
                          <button
                            onClick={() => toggleStore(key)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white transition-colors"
                            style={{ backgroundColor: accentColor }}
                          >
                            {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            Детали
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={key + '_detail'}>
                        <td colSpan={6} className="p-0 bg-amber-50">
                          <UnexposedDetail
                            store={row.store}
                            subdiv={row.subdiv}
                            unexposedFile={jewelryUnexposedFile}
                            accentColor={accentColor}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          Магазинов: {filteredStores.length}
        </div>
      </div>
    </div>
  );
}
