import { useData } from '../context/DataContext';
import ControlTemplate from './ControlTemplate';

export default function ControlObuvPage() {
  const { obuvSummary, parsedFiles } = useData();
  return <ControlTemplate summary={obuvSummary} parsedFiles={parsedFiles} accentColor="#E91E8C" productGroup="Обувь" />;
}
