import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import { useData } from '../context/DataContext';

const pageTitles = {
  '/': 'Dashboard',
  '/shipments': 'Вывозы товаров',
  '/analytics': 'Аналитика',
  '/control': 'Контроль проблем',
  '/upload': 'Загрузить данные',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { parsedFiles } = useData();

  const title = pageTitles[location.pathname] || 'КАРИ';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
                Регион: СПБ и БЕЛ
                {parsedFiles.length > 0 && (
                  <span className="ml-2" style={{ color: '#E91E8C' }}>
                    · Загружено файлов: {parsedFiles.length}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {parsedFiles.length === 0 && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                Загрузите Excel-файлы
              </span>
            )}
            {/* KARI badge */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#111827' }}
            >
              <div className="w-4 h-4 rounded flex items-center justify-center text-white font-black text-xs" style={{ backgroundColor: '#E91E8C' }}>K</div>
              <span className="text-xs font-bold text-white tracking-wider">КАРИ</span>
            </div>
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
