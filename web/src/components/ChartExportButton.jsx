import { useState } from 'react';
import { Download } from 'lucide-react';
import { exportChartNode } from '../lib/chartExport';

export default function ChartExportButton({ targetRef, filename, label = 'Download chart as PNG', size = 14 }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      title={label}
      aria-label={label}
      disabled={busy}
      style={{ opacity: busy ? 0.5 : 1 }}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await exportChartNode(targetRef, { filename });
        } catch (e) {
          console.error('[chartExport]', e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download size={size} aria-hidden="true" />
    </button>
  );
}