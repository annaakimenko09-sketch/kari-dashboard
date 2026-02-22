import { useData } from '../context/DataContext';
import ShipmentsTemplate from './ShipmentsTemplate';

export default function ShipmentsKidsPage() {
  const { kidsSummary, parsedFiles } = useData();
  return (
    <ShipmentsTemplate
      summary={kidsSummary}
      parsedFiles={parsedFiles}
      accentColor="#8b5cf6"
      exportName="vyvoz_kids.xlsx"
    />
  );
}
