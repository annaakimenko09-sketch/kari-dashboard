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
import AcceptancePage     from './pages/AcceptancePage';
import ScanningSpbPage    from './pages/ScanningSpbPage';
import ScanningBelPage    from './pages/ScanningBelPage';
import JewelrySpbPage    from './pages/JewelrySpbPage';
import JewelryBelPage    from './pages/JewelryBelPage';
import CapsuleSpbPage    from './pages/CapsuleSpbPage';
import CapsuleBelPage    from './pages/CapsuleBelPage';
import PricingSpbPage    from './pages/PricingSpbPage';
import PricingBelPage    from './pages/PricingBelPage';
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

                {/* Приёмка */}
                <Route path="acceptance"     element={<ErrorBoundary><AcceptancePage /></ErrorBoundary>} />
                <Route path="acceptance/spb" element={<ErrorBoundary><ScanningSpbPage /></ErrorBoundary>} />
                <Route path="acceptance/bel" element={<ErrorBoundary><ScanningBelPage /></ErrorBoundary>} />

                {/* ЮИ */}
                <Route path="jewelry/spb" element={<ErrorBoundary><JewelrySpbPage /></ErrorBoundary>} />
                <Route path="jewelry/bel" element={<ErrorBoundary><JewelryBelPage /></ErrorBoundary>} />

                {/* Капсулы */}
                <Route path="capsule/spb" element={<ErrorBoundary><CapsuleSpbPage /></ErrorBoundary>} />
                <Route path="capsule/bel" element={<ErrorBoundary><CapsuleBelPage /></ErrorBoundary>} />

                {/* Цены на полупарах */}
                <Route path="pricing/spb" element={<ErrorBoundary><PricingSpbPage /></ErrorBoundary>} />
                <Route path="pricing/bel" element={<ErrorBoundary><PricingBelPage /></ErrorBoundary>} />

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
