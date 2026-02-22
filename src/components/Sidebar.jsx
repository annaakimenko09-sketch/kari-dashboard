import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  BarChart2,
  AlertCircle,
  Upload,
  X,
} from 'lucide-react';

const navItems = [
  { path: '/',          label: 'Dashboard',        desc: 'Сводные показатели',      icon: LayoutDashboard },
  { path: '/shipments', label: 'Вывозы',           desc: 'Таблица вывозов товаров', icon: Truck },
  { path: '/analytics', label: 'Аналитика',        desc: 'Графики и динамика',      icon: BarChart2 },
  { path: '/control',   label: 'Контроль',         desc: 'Проблемные магазины',     icon: AlertCircle },
  { path: '/upload',    label: 'Загрузить данные', desc: 'Импорт Excel-файлов',     icon: Upload },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64
          z-30 flex flex-col transition-transform duration-300
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ backgroundColor: '#111827' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            {/* KARI logo mark */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-white text-sm tracking-tight"
              style={{ backgroundColor: '#E91E8C' }}
            >
              K
            </div>
            <div>
              <div className="font-black text-white text-base tracking-wider leading-none">КАРИ</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Аналитика вывозов</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-5 mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Навигация
            </p>
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${
                  isActive ? 'text-white' : 'hover:bg-white/5'
                }`
              }
              style={({ isActive }) => isActive ? { backgroundColor: '#E91E8C' } : {}}
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={17}
                    className="flex-shrink-0"
                    style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.5)' }}
                  />
                  <div>
                    <div
                      className="text-sm font-medium leading-tight"
                      style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.8)' }}
                    >
                      {item.label}
                    </div>
                    <div className="text-xs leading-tight" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
                      {item.desc}
                    </div>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>KARI Dashboard v1.0</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>Вывозы и приёмки</p>
        </div>
      </aside>
    </>
  );
}
