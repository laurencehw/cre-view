'use client';

interface DataTrustBadgeProps {
  source?: 'SEC Filing' | 'NYC PLUTO' | 'Market Estimate' | string;
}

export default function DataTrustBadge({ source }: DataTrustBadgeProps) {
  if (!source) return null;

  const config: Record<string, { bg: string; text: string; border: string }> = {
    'SEC Filing': { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-800/50' },
    'NYC PLUTO': { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800/50' },
    'Market Estimate': { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800/50' },
  };

  const style = config[source] ?? config['Market Estimate'];

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {source}
    </span>
  );
}
