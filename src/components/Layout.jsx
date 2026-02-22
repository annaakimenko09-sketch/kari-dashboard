import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import { useData } from '../context/DataContext';

const pageTitles = {
  '/obuv':         'Dashboard — Обувь',
  '/obuv/vyvoz':   'Вывозы — Обувь',
  '/obuv/control': 'Контроль — Обувь',
  '/kids':         'Dashboard — Кидс',
  '/kids/vyvoz':   'Вывозы — Кидс',
  '/kids/control': 'Контроль — Кидс',
  '/orders':       'Контроль заказов',
  '/upload':       'Загрузить данные',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { parsedFiles } = useData();

  const title = pageTitles[location.pathname] || 'КАРИ Аналитика';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" translate="no">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Red accent bar at top */}
        <div className="h-0.5 flex-shrink-0" style={{ backgroundColor: '#E91E8C' }} />

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} />
          </button>

          {/* Left accent line + title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: '#E91E8C' }} />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 leading-tight truncate">{title}</h1>
              <p className="text-xs text-gray-400 leading-tight">
                {parsedFiles.length > 0 ? (
                  <span style={{ color: '#E91E8C' }}>Загружено файлов: {parsedFiles.length}</span>
                ) : (
                  'Загрузите Excel-файлы'
                )}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src="/kari-logo.svg" alt="KARI" className="w-7 h-7 object-contain hidden sm:block" />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
