import { useData } from '../context/DataContext';
import SalesYuiPage from './SalesYuiPage';

export default function SalesYuiDayBelPage() {
  const { belSalesYuiDay } = useData();
  return <SalesYuiPage fileData={belSalesYuiDay} title="Ежедневный отчёт ЮИ — БЕЛ" />;
}
