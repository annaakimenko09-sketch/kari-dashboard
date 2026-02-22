import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Upload } from 'lucide-react';
import { getField, getNum } from '../utils/excelParser';

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function SectionTitle({ children }) {
  return <h2 className="text-sm font-semibold text-gray-700 mb-3">{children}</h2>;
}

export default function AnalyticsPage() {
  const { spbBelSummary, allSummary, parsedFiles } = useData();
  const navigate = useNavigate();
  const [groupBy, setGroupBy] = useState('subdivision');

  const chartData = useMemo(() => {
    if (!allSummary.length) return {};

    // By subdivision — only SPB/BEL
    const subdivMap = {};
    spbBelSummary.forEach(r => {
      const key = r['Подразделение'] || 'Неизвестно';
      if (!subdivMap[key]) subdivMap[key] = { name: key, shipped: 0, toShip: 0, received: 0, writeoff: 0, returns: 0 };
      subdivMap[key].shipped += getNum(r, 'Отгружено шт');
      subdivMap[key].toShip += getNum(r, 'Всего к вывозу шт');
      subdivMap[key].received += getNum(r, 'Получено шт');
      subdivMap[key].writeoff += getNum(r, 'Вычерк шт');
      subdivMap[key].returns += getNum(r, 'Возврат от агрегатора шт');
    });

    // By product group — all regions
    const groupMap = {};
    allSummary.forEach(r => {
      const key = r['_productGroup'] || 'Неизвестно';
      if (!groupMap[key]) groupMap[key] = { name: key, shipped: 0, toShip: 0, received: 0 };
      groupMap[key].shipped += getNum(r, 'Отгружено шт');
      groupMap[key].toShip += getNum(r, 'Всего к вывозу шт');
      groupMap[key].received += getNum(r, 'Получено шт');
    });

    // By report type (week vs month) — all regions
    const typeMap = {};
    allSummary.forEach(r => {
      const key = r['_reportType'] || 'Неизвестно';
      if (!typeMap[key]) typeMap[key] = { name: key, shipped: 0, toShip: 0 };
      typeMap[key].shipped += getNum(r, 'Отгружено шт');
      typeMap[key].toShip += getNum(r, 'Всего к вывозу шт');
    });

    // Top stores by volume — only SPB/BEL
    const storeData = spbBelSummary
      .filter(r => getField(r, 'Отгружено товара %') !== null)
      .map(r => ({
        name: String(r['Магазин'] || '').slice(0, 20),
        pct: getNum(r, 'Отгружено товара %'),
        shipped: getNum(r, 'Отгружено шт'),
      }))
      .sort((a, b) => b.shipped - a.shipped)
      .slice(0, 15);

    // Bottom stores (lowest shipping %) — only SPB/BEL
    const bottomStores = spbBelSummary
      .filter(r => {
        const p = getField(r, 'Отгружено товара %');
        return p !== null && !isNaN(parseFloat(p)) && getNum(r, 'Всего к вывозу шт') > 0;
      })
      .map(r => ({
        name: String(r['Магазин'] || '').slice(0, 20),
        pct: getNum(r, 'Отгружено товара %'),
        writeoffPct: getNum(r, 'Вычерк по сборке %'),
        returnPct: getNum(r, 'Возврат от агрегатора %'),
        subdivision: r['Подразделение'] || '',
      }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10);

    // Writeoff and return distribution
    const efficiencyData = Object.values(subdivMap).map(d => ({
      name: d.name,
      'Вычерк': d.writeoff,
      'Возврат': d.returns,
      'Получено': d.received,
    }));

    return {
      bySubdiv: Object.values(subdivMap).sort((a, b) => b.shipped - a.shipped),
      byGroup: Object.values(groupMap),
      byType: Object.values(typeMap),
      storeData,
      bottomStores,
      efficiencyData: efficiencyData.sort((a, b) => (b['Вычерк'] + b['Возврат']) - (a['Вычерк'] + a['Возврат'])),
    };
  }, [spbBelSummary]);

  if (!parsedFiles.length || !allSummary) {
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

  const { bySubdiv = [], byGroup = [], storeData = [], bottomStores = [], efficiencyData = [] } = chartData;

  return (
    <div className="space-y-6">
      {/* Shipped by subdivision */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <SectionTitle>Отгружено и к вывозу по подразделениям, шт</SectionTitle>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySubdiv} margin={{ top: 5, right: 10, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => v.toLocaleString('ru-RU')} />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="toShip" name="К вывозу" fill="#dbeafe" radius={[2, 2, 0, 0]} />
              <Bar dataKey="shipped" name="Отгружено" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="received" name="Получено" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By product group */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <SectionTitle>По группе товаров</SectionTitle>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byGroup}
                  dataKey="shipped"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {byGroup.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => v.toLocaleString('ru-RU')} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Writeoff and return by subdivision */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <SectionTitle>Вычерк и возврат по подразделениям, шт</SectionTitle>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={efficiencyData.slice(0, 8)} margin={{ top: 5, right: 10, bottom: 40, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => v.toLocaleString('ru-RU')} />
                <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Вычерк" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Возврат" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top 15 stores by volume */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <SectionTitle>ТОП-15 магазинов по объёму отгрузки, шт</SectionTitle>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={storeData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 130 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={125} />
              <Tooltip formatter={(v) => v.toLocaleString('ru-RU')} />
              <Bar dataKey="shipped" name="Отгружено" fill="#3b82f6" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom stores */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <SectionTitle>ТОП-10 магазинов с низким % отгрузки</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Магазин</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Подразделение</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Отгружено %</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Вычерк %</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Возврат %</th>
              </tr>
            </thead>
            <tbody>
              {bottomStores.map((store, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{store.name}</td>
                  <td className="px-3 py-2 text-gray-500">{store.subdivision}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      store.pct >= 90 ? 'bg-green-100 text-green-700' :
                      store.pct >= 70 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {store.pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={store.writeoffPct > 15 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                      {store.writeoffPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={store.returnPct > 15 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                      {store.returnPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {bottomStores.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Нет данных</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
