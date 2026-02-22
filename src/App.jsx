import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ShipmentsPage from './pages/ShipmentsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ControlPage from './pages/ControlPage';
import UploadPage from './pages/UploadPage';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
                <Route path="shipments" element={<ErrorBoundary><ShipmentsPage /></ErrorBoundary>} />
                <Route path="analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
                <Route path="control" element={<ErrorBoundary><ControlPage /></ErrorBoundary>} />
                <Route path="upload" element={<ErrorBoundary><UploadPage /></ErrorBoundary>} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </DataProvider>
    </ErrorBoundary>
  );
}
