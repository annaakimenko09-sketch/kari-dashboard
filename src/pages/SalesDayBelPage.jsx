import { useData } from '../context/DataContext';
import SalesPage from './SalesPage';

export default function SalesDayBelPage() {
  const { belSalesDay } = useData();
  return <SalesPage fileData={belSalesDay} title="Ежедневный отчёт по продажам — БЕЛ" />;
}
