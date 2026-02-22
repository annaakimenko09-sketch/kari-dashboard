import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  BarChart2,
  AlertCircle,
  Upload,
  X,
  Menu,
  Package,
} from 'lucide-react';

const navItems = [
  {
    path: '/',
    label: 'Dashboard',
    desc: 'Сводные показатели',
    icon: LayoutDashboard,
  },
  {
    path: '/shipments',
    label: 'Вывозы',
    desc: 'Таблица вывозов товаров',
    icon: Truck,
  },
  {
    path: '/analytics',
    label: 'Аналитика',
    desc: 'Графики и динамика',
    icon: BarChart2,
  },
  {
    path: '/control',
    label: 'Контроль',
    desc: 'Проблемные магазины',
    icon: AlertCircle,
  },
  {
    path: '/upload',
    label: 'Загрузить данные',
    desc: 'Импорт Excel-файлов',
    icon: Upload,
  },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200
          z-30 flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">КАРИ</div>
              <div className="text-xs text-gray-500">СПБ и БЕЛ</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
              Навигация
            </p>
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-start gap-3 mx-2 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={18}
                    className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-red-600' : 'text-gray-400'}`}
                  />
                  <div>
                    <div className={`text-sm font-medium ${isActive ? 'text-red-700' : ''}`}>
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-400">{item.desc}</div>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-400">KARI Dashboard v1.0</p>
          <p className="text-xs text-gray-400">Вывозы и приёмки</p>
        </div>
      </aside>
    </>
  );
}
