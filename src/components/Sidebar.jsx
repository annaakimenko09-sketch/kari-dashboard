import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  AlertCircle,
  Upload,
  Clock,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';

const BRAND = '#E91E8C';

const sections = [
  {
    label: 'Обувь',
    color: '#E91E8C',
    items: [
      { path: '/obuv',         label: 'Дашборд',          icon: LayoutDashboard },
      { path: '/obuv/vyvoz',   label: 'Вывозы',           icon: Truck },
      { path: '/obuv/control', label: 'Контроль',         icon: AlertCircle },
    ],
  },
  {
    label: 'Кидс',
    color: '#8b5cf6',
    items: [
      { path: '/kids',         label: 'Дашборд',          icon: LayoutDashboard },
      { path: '/kids/vyvoz',   label: 'Вывозы',           icon: Truck },
      { path: '/kids/control', label: 'Контроль',         icon: AlertCircle },
    ],
  },
  {
    label: 'Приёмка',
    color: '#10b981',
    items: [
      { path: '/acceptance/spb', label: 'СПБ', icon: ClipboardCheck },
      { path: '/acceptance/bel', label: 'БЕЛ', icon: ClipboardCheck },
    ],
  },
  {
    label: 'standalone',
    color: '#6b7280',
    items: [
      { path: '/orders',       label: 'Контроль заказов', icon: Clock },
      { path: '/upload',       label: 'Загрузить данные', icon: Upload },
    ],
  },
];

// Which section labels to show as expandable groups (not standalone items)
const GROUP_LABELS = ['Обувь', 'Кидс', 'Приёмка'];

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  // Track expanded groups
  const [expanded, setExpanded] = useState({ 'Обувь': true, 'Кидс': true, 'Приёмка': true });

  function toggleGroup(label) {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
  }

  const isCollapsed = collapsed && !open; // on mobile open overrides collapsed

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col transition-all duration-300
          lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-16' : 'w-64'}
        `}
        style={{ backgroundColor: '#111827', minWidth: isCollapsed ? '64px' : '256px' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between flex-shrink-0 px-4 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', minHeight: '60px' }}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Accent dot */}
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND }} />
              <div className="min-w-0">
                <div className="font-black text-white text-sm tracking-wider leading-none">КАРИ</div>
                <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>Аналитика</div>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-full flex justify-center">
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND }} />
            </div>
          )}

          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <X size={16} />
          </button>

          {/* Desktop collapse toggle */}
          {!open && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-md flex-shrink-0 hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              title={isCollapsed ? 'Развернуть' : 'Свернуть'}
            >
              {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
          {sections.map((section) => {
            const isGroup = GROUP_LABELS.includes(section.label);

            if (isGroup) {
              const isOpen = expanded[section.label];
              return (
                <div key={section.label} className="mb-1">
                  {/* Group header — clickable to expand/collapse */}
                  <button
                    onClick={() => !isCollapsed && toggleGroup(section.label)}
                    className="w-full flex items-center gap-2 px-4 pt-3 pb-1.5 hover:bg-white/5 transition-colors"
                    title={isCollapsed ? section.label : undefined}
                  >
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                    {!isCollapsed && (
                      <>
                        <span className="text-xs font-semibold uppercase tracking-widest flex-1 text-left" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {section.label}
                        </span>
                        <ChevronDown
                          size={12}
                          style={{
                            color: 'rgba(255,255,255,0.3)',
                            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </>
                    )}
                  </button>

                  {/* Items — shown when group expanded or sidebar collapsed (icons only) */}
                  {(isOpen || isCollapsed) && section.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end
                      onClick={onClose}
                      title={isCollapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg mb-0.5 transition-all ${
                          isCollapsed ? 'mx-2 px-2 py-2.5 justify-center' : 'mx-2 px-3 py-2'
                        } ${isActive ? 'text-white' : 'hover:bg-white/5'}`
                      }
                      style={({ isActive }) => isActive ? { backgroundColor: section.color } : {}}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            size={isCollapsed ? 18 : 15}
                            className="flex-shrink-0"
                            style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.45)' }}
                          />
                          {!isCollapsed && (
                            <span
                              className="text-sm font-medium leading-tight"
                              style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.8)' }}
                            >
                              {item.label}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              );
            }

            // Standalone items (no group header)
            return (
              <div key={section.label} className="mt-1">
                {!isCollapsed && (
                  <div className="h-px mx-4 mb-2 mt-1" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
                )}
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end
                    onClick={onClose}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg mb-0.5 transition-all ${
                        isCollapsed ? 'mx-2 px-2 py-2.5 justify-center' : 'mx-2 px-3 py-2'
                      } ${isActive ? 'text-white' : 'hover:bg-white/5'}`
                    }
                    style={({ isActive }) => isActive
                      ? { backgroundColor: item.path === '/upload' ? '#374151' : BRAND }
                      : {}
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          size={isCollapsed ? 18 : 15}
                          className="flex-shrink-0"
                          style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.45)' }}
                        />
                        {!isCollapsed && (
                          <span
                            className="text-sm font-medium leading-tight"
                            style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.8)' }}
                          >
                            {item.label}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>KARI Dashboard v2.1</p>
          </div>
        )}
      </aside>
    </>
  );
}
