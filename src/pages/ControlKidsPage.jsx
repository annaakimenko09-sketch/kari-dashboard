import { useData } from '../context/DataContext';
import ControlTemplate from './ControlTemplate';

export default function ControlKidsPage() {
  const { kidsSummary, parsedFiles } = useData();
  return <ControlTemplate summary={kidsSummary} parsedFiles={parsedFiles} accentColor="#8b5cf6" productGroup="Кидс" />;
}
