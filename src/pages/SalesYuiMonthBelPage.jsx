import { useData } from '../context/DataContext';
import SalesYuiPage from './SalesYuiPage';

export default function SalesYuiMonthBelPage() {
  const { belSalesYuiMonth } = useData();
  return <SalesYuiPage fileData={belSalesYuiMonth} title="Отчёт по продажам ЮИ за месяц — БЕЛ" />;
}
