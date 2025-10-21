'use client';

import { useEffect, useRef } from 'react';

// Data contract - single source of truth
interface InsightPanelData {
  scope: 'MSA' | 'State';
  msaCode: string;
  msaName: string;
  soc: string;
  year: number;
  employment: number | null;
  medianAnnual: number | null;
  meanAnnual: number | null;
  p10Annual: number | null;
  p25Annual?: number | null;
  p75Annual?: number | null;
  p90Annual: number | null;
  // Growth metrics (from employment history)
  yoyAbs?: number | null;
  yoyPct?: number | null;
  trendYoy?: 'Up' | 'Down' | 'Flat' | null;
  abs3y?: number | null;
  pct3y?: number | null;
  cagr3y?: number | null;
  trend3y?: 'Up' | 'Down' | 'Flat' | null;
  // Employment time series for sparkline
  employmentByYear?: Record<string, number | null>;
}

interface InsightPanelProps {
  data: InsightPanelData | null;
  position?: { x: number; y: number };
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function InsightPanel({ 
  data, 
  position, 
  onClose, 
  loading = false,
  error = null 
}: InsightPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Format number with US locale
  const formatNumber = (num: number | null): string => {
    if (num === null || num === undefined) return '—';
    return num.toLocaleString('en-US');
  };

  // Format currency
  const formatCurrency = (num: number | null): string => {
    if (num === null || num === undefined) return '—';
    return `$${num.toLocaleString('en-US')}`;
  };

  // Generate sparkline SVG from employment history
  const generateSparkline = (employmentByYear: Record<string, number | null>, trend: 'Up' | 'Down' | 'Flat' | null): string => {
    const years = ['2021', '2022', '2023', '2024'];
    const values = years.map(y => employmentByYear[y]).filter(v => v !== null) as number[];
    
    if (values.length < 2) return '';
    
    const width = 120;
    const height = 40;
    const padding = 4;
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    // Create points
    const points = years.map((year, i) => {
      const value = employmentByYear[year];
      if (value === null) return null;
      
      const x = padding + (i / (years.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      
      return { x, y, value, year };
    }).filter(p => p !== null);
    
    if (points.length < 2) return '';
    
    // Generate path
    const pathData = points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${p!.x},${p!.y}`
    ).join(' ');
    
    // Color based on trend
    const strokeColor = trend === 'Up' ? '#10b981' : trend === 'Down' ? '#ef4444' : '#9ca3af';
    const fillColor = trend === 'Up' ? 'rgba(16, 185, 129, 0.1)' : trend === 'Down' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(156, 163, 175, 0.1)';
    
    // Create area path for fill
    const areaPath = `${pathData} L ${points[points.length - 1]!.x},${height} L ${points[0]!.x},${height} Z`;
    
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display: block;">
        <defs>
          <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${strokeColor};stop-opacity:0.2" />
            <stop offset="100%" style="stop-color:${strokeColor};stop-opacity:0" />
          </linearGradient>
        </defs>
        <!-- Area fill -->
        <path d="${areaPath}" fill="url(#sparkGradient)" />
        <!-- Line -->
        <path d="${pathData}" stroke="${strokeColor}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Dots -->
        ${points.map(p => `<circle cx="${p!.x}" cy="${p!.y}" r="2.5" fill="${strokeColor}" stroke="white" stroke-width="1" />`).join('')}
      </svg>
    `;
  };

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    if (panelRef.current) {
      const focusableElements = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      };

      panelRef.current.addEventListener('keydown', handleTab as any);
      firstElement?.focus();

      return () => {
        panelRef.current?.removeEventListener('keydown', handleTab as any);
      };
    }
  }, [data]);

  if (!data && !loading && !error) return null;

  // Loading skeleton
  if (loading) {
    return (
      <div
        ref={panelRef}
        className="fixed md:absolute z-50 bg-white rounded-xl shadow-2xl"
        style={{
          bottom: 'env(safe-area-inset-bottom, 0)',
          left: 0,
          right: 0,
          maxWidth: '520px',
          ...(position && window.innerWidth >= 768 ? {
            position: 'absolute',
            left: `${position.x}px`,
            top: `${position.y}px`,
            bottom: 'auto',
            right: 'auto',
          } : {
            position: 'fixed',
            margin: '0 auto',
          })
        }}
      >
        <div className="p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-6"></div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
          <div className="h-12 bg-gray-100 rounded mt-6"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div
        ref={panelRef}
        className="fixed md:absolute z-50 bg-white rounded-xl shadow-2xl max-w-md"
        style={{
          bottom: 'env(safe-area-inset-bottom, 0)',
          left: 0,
          right: 0,
          margin: '0 auto',
          ...(position && window.innerWidth >= 768 ? {
            position: 'absolute',
            left: `${position.x}px`,
            top: `${position.y}px`,
            bottom: 'auto',
            right: 'auto',
          } : {})
        }}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Data Unavailable</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-600 text-sm">
            {error || 'Data unavailable for this MSA/SOC combination. BLS may have suppressed this data.'}
          </p>
        </div>
      </div>
    );
  }

  const hasWageRange = data.p10Annual !== null && data.p90Annual !== null;
  const hasPercentiles = hasWageRange && data.medianAnnual !== null;
  const isStateScope = data.scope === 'State';
  const hasAnomaly = data.medianAnnual !== null && (data.medianAnnual < 20000 || data.medianAnnual > 300000);

  // Smart positioning to keep panel in viewport
  const getSmartPosition = () => {
    if (!position || window.innerWidth < 768) {
      // Mobile: bottom sheet
      return {
        position: 'fixed' as const,
        bottom: 'env(safe-area-inset-bottom, 0)',
        left: 0,
        right: 0,
        maxWidth: '520px',
        margin: '0 auto',
      };
    }

    // Desktop: smart positioning with better edge detection
    const panelWidth = 520;
    const panelHeight = 650; // Generous estimate for all tiles + sparkline
    const margin = 16;
    const offset = 20; // Offset from click point

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Start with default position (right and down from click)
    let left = position.x + offset;
    let top = position.y + offset;

    // Horizontal positioning
    const fitsRight = (left + panelWidth + margin) <= viewportWidth;
    const fitsLeft = (position.x - offset - panelWidth) >= margin;

    if (!fitsRight && fitsLeft) {
      // Position to the left of click
      left = position.x - panelWidth - offset;
    } else if (!fitsRight) {
      // Center horizontally if doesn't fit either side
      left = Math.max(margin, (viewportWidth - panelWidth) / 2);
    }

    // Vertical positioning
    const fitsBelow = (top + panelHeight + margin) <= viewportHeight;
    const fitsAbove = (position.y - offset - panelHeight) >= margin;

    if (!fitsBelow && fitsAbove) {
      // Position above click
      top = position.y - panelHeight - offset;
    } else if (!fitsBelow) {
      // Align to bottom with margin
      top = Math.max(margin, viewportHeight - panelHeight - margin);
    }

    // Final boundary checks
    left = Math.max(margin, Math.min(left, viewportWidth - panelWidth - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - panelHeight - margin));

    return {
      position: 'absolute' as const,
      left: `${left}px`,
      top: `${top}px`,
      bottom: 'auto',
      right: 'auto',
      maxWidth: '520px',
      maxHeight: `${viewportHeight - margin * 2}px`,
      overflowY: 'auto' as const,
    };
  };

  return (
    <div
      ref={panelRef}
      className="fixed md:absolute z-50 bg-white rounded-xl shadow-2xl overflow-hidden"
      style={getSmartPosition()}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{data.msaName}</h2>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-white text-gray-700 border border-gray-200">
                MSA {data.msaCode}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-white text-gray-700 border border-gray-200">
                SOC {data.soc}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-white text-gray-700 border border-gray-200">
                {data.year}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg p-2 transition-all"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Metric Tiles - 3x2 Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Row 1: Employment | Mean Annual */}
          {/* Employment */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Employment</div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {formatNumber(data.employment)} {data.employment !== null && <span className="text-sm font-normal text-gray-600">jobs</span>}
            </div>
          </div>

          {/* Mean Annual */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="text-xs font-medium text-purple-700 uppercase tracking-wide mb-1">Mean Annual</div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {formatCurrency(data.meanAnnual)}
              {data.meanAnnual !== null && <span className="text-sm font-normal text-gray-600">/year</span>}
            </div>
          </div>

          {/* Row 2: YoY Growth | Median Annual */}
          {/* YoY Growth */}
          <div className={`rounded-lg p-4 border ${
            data.trendYoy === 'Up' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200' :
            data.trendYoy === 'Down' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' :
            'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
          }`} title="Computed from OEWS MSA employment (May 2023 vs May 2024)">
            <div className={`text-xs font-medium uppercase tracking-wide mb-1 ${
              data.trendYoy === 'Up' ? 'text-emerald-700' :
              data.trendYoy === 'Down' ? 'text-red-700' :
              'text-gray-700'
            }`}>YoY Growth</div>
            {data.yoyPct !== null && data.yoyPct !== undefined ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900 tabular-nums">
                    {data.yoyPct > 0 ? '+' : ''}{data.yoyPct}%
                  </span>
                  <span className={`text-2xl font-bold ${
                    data.trendYoy === 'Up' ? 'text-green-600 animate-pulse' : 
                    data.trendYoy === 'Down' ? 'text-red-600 animate-pulse' : 
                    'text-gray-400'
                  }`}>
                    {data.trendYoy === 'Up' ? '▲' : data.trendYoy === 'Down' ? '▼' : '–'}
                  </span>
                </div>
                {data.yoyAbs !== null && data.yoyAbs !== undefined && (
                  <div className="text-xs text-gray-600 mt-1">
                    {data.yoyAbs > 0 ? '+' : ''}{formatNumber(data.yoyAbs)} jobs
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-600">
                <span className="text-lg">—</span>
                <div className="text-xs text-gray-500 mt-1">Insufficient history</div>
              </div>
            )}
          </div>

          {/* Median Annual */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">Median Annual</div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {formatCurrency(data.medianAnnual)}
              {data.medianAnnual !== null && <span className="text-sm font-normal text-gray-600">/year</span>}
            </div>
          </div>

          {/* Row 3: 3-Year Trend | Wage Range */}
          {/* 3-Year Trend with Sparkline */}
          <div className={`rounded-lg p-4 border ${
            data.trend3y === 'Up' ? 'bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200' :
            data.trend3y === 'Down' ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200' :
            'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
          }`} title="Employment trend from OEWS MSA data (2021-2024)">
            <div className={`text-xs font-medium uppercase tracking-wide mb-2 ${
              data.trend3y === 'Up' ? 'text-teal-700' :
              data.trend3y === 'Down' ? 'text-orange-700' :
              'text-gray-700'
            }`}>3-Year Trend</div>
            {data.pct3y !== null && data.pct3y !== undefined && data.employmentByYear ? (
              <>
                {/* Sparkline Chart */}
                <div 
                  className="mb-2" 
                  dangerouslySetInnerHTML={{ 
                    __html: generateSparkline(data.employmentByYear, data.trend3y) 
                  }}
                />
                {/* Stats */}
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-gray-900 tabular-nums">
                      {data.pct3y > 0 ? '+' : ''}{data.pct3y}%
                    </span>
                    <span className={`text-lg font-bold ${
                      data.trend3y === 'Up' ? 'text-green-600 animate-pulse' : 
                      data.trend3y === 'Down' ? 'text-red-600 animate-pulse' : 
                      'text-gray-400'
                    }`}>
                      {data.trend3y === 'Up' ? '▲' : data.trend3y === 'Down' ? '▼' : '–'}
                    </span>
                  </div>
                  {data.abs3y !== null && data.abs3y !== undefined && (
                    <div className="text-xs text-gray-600">
                      {data.abs3y > 0 ? '+' : ''}{formatNumber(data.abs3y)}
                    </div>
                  )}
                </div>
                {data.cagr3y !== null && data.cagr3y !== undefined && (
                  <div className="text-xs text-gray-600 mt-1">
                    {data.cagr3y > 0 ? '+' : ''}{data.cagr3y}% CAGR
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-600">
                <span className="text-lg">—</span>
                <div className="text-xs text-gray-500 mt-1">Insufficient history</div>
              </div>
            )}
          </div>

          {/* Wage Range */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
            <div className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Wage Range</div>
            <div className="text-sm font-semibold text-gray-900 tabular-nums">
              {hasWageRange ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">10%</span>
                    <span className="text-base">{formatCurrency(data.p10Annual)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-gray-600">90%</span>
                    <span className="text-base">{formatCurrency(data.p90Annual)}</span>
                  </div>
                </>
              ) : '—'}
            </div>
          </div>
        </div>

        {/* Percentile Bar */}
        {hasPercentiles && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-3">Wage Distribution</div>
            <div className="relative h-8 bg-gradient-to-r from-blue-200 via-green-200 to-purple-200 rounded-full overflow-hidden">
              {/* P10 marker */}
              {data.p10Annual !== null && data.p90Annual !== null && data.medianAnnual !== null && (
                <>
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-600"
                    style={{ 
                      left: `${((data.p10Annual - (data.p10Annual || 0)) / ((data.p90Annual || 100000) - (data.p10Annual || 0))) * 100}%` 
                    }}
                  />
                  
                  {/* P25 marker (faint) */}
                  {data.p25Annual !== null && (
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-400 opacity-50"
                      style={{ 
                        left: `${((data.p25Annual - data.p10Annual) / (data.p90Annual - data.p10Annual)) * 100}%` 
                      }}
                    />
                  )}
                  
                  {/* Median marker (emphasized) */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-green-600 shadow-lg"
                    style={{ 
                      left: `${((data.medianAnnual - data.p10Annual) / (data.p90Annual - data.p10Annual)) * 100}%` 
                    }}
                  />
                  
                  {/* P75 marker (faint) */}
                  {data.p75Annual !== null && (
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-purple-400 opacity-50"
                      style={{ 
                        left: `${((data.p75Annual - data.p10Annual) / (data.p90Annual - data.p10Annual)) * 100}%` 
                      }}
                    />
                  )}
                  
                  {/* P90 marker */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-purple-600"
                    style={{ 
                      left: `${((data.p90Annual - data.p10Annual) / (data.p90Annual - data.p10Annual)) * 100}%` 
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600 tabular-nums">
              <span>P10: {formatCurrency(data.p10Annual)}</span>
              <span className="font-semibold text-green-700">Median: {formatCurrency(data.medianAnnual)}</span>
              <span>P90: {formatCurrency(data.p90Annual)}</span>
            </div>
          </div>
        )}

        {/* Footer Chips */}
        <div className="mt-6 flex flex-wrap gap-2 items-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            📊 BLS OEWS May {data.year}
          </span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
            isStateScope 
              ? 'bg-amber-100 text-amber-800 border-amber-200' 
              : 'bg-green-100 text-green-800 border-green-200'
          }`}>
            {isStateScope ? '⚠️ State overlay' : '✓ MSA scope'}
          </span>
          {hasAnomaly && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
              ⚠ Data anomaly
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

