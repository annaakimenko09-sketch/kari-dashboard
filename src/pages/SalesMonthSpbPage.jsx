import { useData } from '../context/DataContext';
import SalesPage from './SalesPage';

export default function SalesMonthSpbPage() {
  const { spbSalesMonth } = useData();
  return <SalesPage fileData={spbSalesMonth} title="Отчёт по продажам за месяц — СПБ" />;
}
