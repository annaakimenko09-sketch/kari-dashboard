import { useData } from '../context/DataContext';
import SalesPage from './SalesPage';

export default function SalesYearBelPage() {
  const { belSalesYear } = useData();
  return <SalesPage fileData={belSalesYear} title="Отчёт по продажам за год — БЕЛ" />;
}
