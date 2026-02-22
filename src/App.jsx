import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

import DashboardObuvPage  from './pages/DashboardObuvPage';
import DashboardKidsPage  from './pages/DashboardKidsPage';
import ShipmentsObuvPage  from './pages/ShipmentsObuvPage';
import ShipmentsKidsPage  from './pages/ShipmentsKidsPage';
import ControlObuvPage    from './pages/ControlObuvPage';
import ControlKidsPage    from './pages/ControlKidsPage';
import OrdersPage         from './pages/OrdersPage';
import UploadPage         from './pages/UploadPage';

export default function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Layout />}>
                {/* Redirect root to /obuv */}
                <Route index element={<Navigate to="/obuv" replace />} />

                {/* Обувь */}
                <Route path="obuv"         element={<ErrorBoundary><DashboardObuvPage /></ErrorBoundary>} />
                <Route path="obuv/vyvoz"   element={<ErrorBoundary><ShipmentsObuvPage /></ErrorBoundary>} />
                <Route path="obuv/control" element={<ErrorBoundary><ControlObuvPage /></ErrorBoundary>} />

                {/* Кидс */}
                <Route path="kids"         element={<ErrorBoundary><DashboardKidsPage /></ErrorBoundary>} />
                <Route path="kids/vyvoz"   element={<ErrorBoundary><ShipmentsKidsPage /></ErrorBoundary>} />
                <Route path="kids/control" element={<ErrorBoundary><ControlKidsPage /></ErrorBoundary>} />

                {/* Заказы */}
                <Route path="orders"       element={<ErrorBoundary><OrdersPage /></ErrorBoundary>} />

                {/* Загрузка */}
                <Route path="upload"       element={<ErrorBoundary><UploadPage /></ErrorBoundary>} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </DataProvider>
    </ErrorBoundary>
  );
}
