import { useData } from '../context/DataContext';
import SalesPage from './SalesPage';

export default function SalesMonthBelPage() {
  const { belSalesMonth } = useData();
  return <SalesPage fileData={belSalesMonth} title="Отчёт по продажам за месяц — БЕЛ" />;
}
