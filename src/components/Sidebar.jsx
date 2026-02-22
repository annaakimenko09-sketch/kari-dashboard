import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  AlertCircle,
  Upload,
  Clock,
} from 'lucide-react';

const sections = [
  {
    label: 'Обувь',
    color: '#E91E8C',
    items: [
      { path: '/obuv',         label: 'Dashboard',        desc: 'Сводные показатели',      icon: LayoutDashboard },
      { path: '/obuv/vyvoz',   label: 'Вывозы',           desc: 'Таблица вывозов',         icon: Truck },
      { path: '/obuv/control', label: 'Контроль',         desc: 'Проблемные магазины',     icon: AlertCircle },
    ],
  },
  {
    label: 'Кидс',
    color: '#8b5cf6',
    items: [
      { path: '/kids',         label: 'Dashboard',        desc: 'Сводные показатели',      icon: LayoutDashboard },
      { path: '/kids/vyvoz',   label: 'Вывозы',           desc: 'Таблица вывозов',         icon: Truck },
      { path: '/kids/control', label: 'Контроль',         desc: 'Проблемные магазины',     icon: AlertCircle },
    ],
  },
  {
    label: 'Заказы',
    color: '#f59e0b',
    items: [
      { path: '/orders',       label: 'Контроль заказов', desc: 'Просроченные заказы СПБ', icon: Clock },
    ],
  },
  {
    label: 'Данные',
    color: '#6b7280',
    items: [
      { path: '/upload',       label: 'Загрузить данные', desc: 'Импорт Excel-файлов',     icon: Upload },
    ],
  },
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
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <img src="/kari-logo.svg" alt="KARI" className="w-8 h-8 object-contain flex-shrink-0" style={{ filter: 'brightness(0) invert(1)' }} />
            <div>
              <div className="font-black text-white text-base tracking-wider leading-none">КАРИ</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Аналитика вывозов</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {sections.map((section) => (
            <div key={section.label} className="mb-1">
              <div className="flex items-center gap-2 px-5 pt-3 pb-1.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {section.label}
                </p>
              </div>

              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 mx-3 px-3 py-2 rounded-lg mb-0.5 transition-all ${
                      isActive ? 'text-white' : 'hover:bg-white/5'
                    }`
                  }
                  style={({ isActive }) => isActive ? { backgroundColor: section.color } : {}}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={15}
                        className="flex-shrink-0"
                        style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.45)' }}
                      />
                      <div>
                        <div
                          className="text-sm font-medium leading-tight"
                          style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.8)' }}
                        >
                          {item.label}
                        </div>
                        <div className="text-xs leading-tight" style={{ color: isActive ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)' }}>
                          {item.desc}
                        </div>
                      </div>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>KARI Dashboard v2.0</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>Вывозы и приёмки</p>
        </div>
      </aside>
    </>
  );
}
