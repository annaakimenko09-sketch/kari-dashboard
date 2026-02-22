import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, Bell } from 'lucide-react';
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
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
            <p className="text-xs text-gray-500">
              Регион: СПБ и БЕЛ
              {parsedFiles.length > 0 && (
                <span className="ml-2 text-green-600">
                  · Загружено файлов: {parsedFiles.length}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {parsedFiles.length === 0 && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                Загрузите Excel-файлы
              </span>
            )}
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
