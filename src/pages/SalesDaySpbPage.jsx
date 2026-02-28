import { useData } from '../context/DataContext';
import SalesPage from './SalesPage';

export default function SalesDaySpbPage() {
  const { spbSalesDay } = useData();
  return <SalesPage fileData={spbSalesDay} title="Ежедневный отчёт по продажам — СПБ" />;
}
