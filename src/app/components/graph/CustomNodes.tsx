import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GraphNodeData, nodeColors, getNodeColors } from './GraphUtils';

// Icons as SVG components
const BuildingIcon = ({ color }: { color: string }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const CpuIcon = ({ color }: { color: string }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const TruckIcon = ({ color }: { color: string }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

const FolderIcon = ({ color }: { color: string }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
);

const ChevronDownIcon = ({ color }: { color: string }) => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

const getIcon = (type: string, color: string) => {
  switch (type) {
    case 'ORG':
      return <BuildingIcon color={color} />;
    case 'ASSET':
      return <CpuIcon color={color} />;
    case 'SUPPLIER':
      return <TruckIcon color={color} />;
    case 'ASSETS_COLLAPSED':
      return <FolderIcon color={color} />;
    case 'SUPPLIERS_COLLAPSED':
      return <FolderIcon color={color} />;
    default:
      return <CpuIcon color={color} />;
  }
};

const getTypeBadgeColor = (type: string, isDarkBg = false) => {
  if (isDarkBg) {
    switch (type) {
      case 'ORG':
        return 'bg-blue-500/30 text-blue-200 border-blue-400/50';
      case 'ASSET':
        return 'bg-green-500/30 text-green-200 border-green-400/50';
      case 'SUPPLIER':
        return 'bg-purple-500/30 text-purple-200 border-purple-400/50';
      case 'GROUP':
        return 'bg-amber-500/30 text-amber-200 border-amber-400/50';
      default:
        return 'bg-gray-500/30 text-gray-200 border-gray-400/50';
    }
  }
  switch (type) {
    case 'ORG':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'ASSET':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'SUPPLIER':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'GROUP':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

// Glassmorphism Node Component with improved visibility
const GlassNode = memo(({ data, selected }: NodeProps<GraphNodeData>) => {
  const colors = getNodeColors(data.type);
  const isSelected = selected;
  
  // Check if this is a GROUP node (for root organization)
  const isGroupNode = data.type === 'ORG' && data.metadata?.type === 'GROUP';
  
  // Check if this is a collapsed node
  const isCollapsed = data.type === 'ASSETS_COLLAPSED' || data.type === 'SUPPLIERS_COLLAPSED';

  // Determine badge label
  const badgeLabel = useMemo(() => {
    if (data.type === 'ASSETS_COLLAPSED') {
      return data.metadata?.count ? `Assets (${data.metadata.count})` : 'Assets';
    }
    if (data.type === 'SUPPLIERS_COLLAPSED') {
      return data.metadata?.count ? `Suppliers (${data.metadata.count})` : 'Suppliers';
    }
    return data.type;
  }, [data.type, data.metadata]);

  // Dark theme styling for better text visibility
  const isDarkTheme = true;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />
      <div
        className={`
          relative rounded-xl px-4 py-3 min-w-[180px] max-w-[220px]
          transition-all duration-200 ease-out cursor-pointer
          ${isSelected ? 'ring-2 ring-offset-2' : 'hover:ring-1 hover:ring-offset-1'}
        `}
        style={{
          // Dark background with slight transparency for glass effect
          background: isDarkTheme 
            ? `linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)`
            : colors.bg,
          borderColor: isSelected 
            ? colors.border 
            : isGroupNode 
              ? '#4f8cff' 
              : `${colors.border}60`,
          boxShadow: isSelected
            ? `0 8px 32px ${colors.border}40, 0 0 0 2px ${colors.border}30`
            : isGroupNode
              ? `0 4px 20px rgba(79, 140, 255, 0.3), 0 0 0 1px rgba(79, 140, 255, 0.2)`
              : `0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px ${colors.border}20`,
          backdropFilter: 'blur(12px)',
          borderWidth: isGroupNode ? '2px' : '1px',
        }}
      >
        {/* Glow effect */}
        <div
          className="absolute -inset-px rounded-xl opacity-40 blur-xl"
          style={{
            background: isGroupNode
              ? `linear-gradient(135deg, rgba(79, 140, 255, 0.3), transparent)`
              : `linear-gradient(135deg, ${colors.border}25, transparent)`,
          }}
        />

        {/* Content with vertical layout: ICON → NAME → BADGE */}
        <div className="relative flex flex-col items-center text-center">
          {/* Icon */}
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mb-2"
            style={{
              backgroundColor: `${colors.border}20`,
              border: `1px solid ${colors.border}40`,
            }}
          >
            {getIcon(data.type, colors.icon)}
          </div>

          {/* Node Name with text shadow for visibility */}
          <p 
            className="text-[13px] font-semibold truncate w-full leading-tight px-1"
            style={{
              color: '#ffffff',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5), 0 0 8px rgba(255, 255, 255, 0.1)',
            }}
          >
            {data.name}
          </p>
          
          {/* Type Badge */}
          <span
            className={`
              inline-block mt-1.5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider
              rounded-md border ${getTypeBadgeColor(data.metadata?.type || data.type, isDarkTheme)}
            `}
          >
            {badgeLabel}
          </span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />
    </>
  );
});

GlassNode.displayName = 'GlassNode';

// Tooltip Component with viewport-aware positioning
interface TooltipProps {
  data: GraphNodeData;
  position: { x: number; y: number };
}

const Tooltip = memo(({ data, position }: TooltipProps) => {
  const nodeType = data.type === 'ASSETS_COLLAPSED' || data.type === 'SUPPLIERS_COLLAPSED' ? 'ASSET' : data.type;
  const colors = getNodeColors(nodeType);
  const metadata = data.metadata;
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 260, height: 320 });

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  };

  // Measure tooltip dimensions after render
  useEffect(() => {
    if (tooltipRef.current) {
      setTooltipSize({
        width: tooltipRef.current.offsetWidth,
        height: tooltipRef.current.offsetHeight,
      });
    }
  }, []);

  // Calculate viewport-aware position
  const tooltipPosition = useMemo(() => {
    const offset = 16;
    const padding = 16;
    
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    
    // Default position: slightly to the right and below cursor
    let posX = position.x + offset;
    let posY = position.y + offset;
    
    // Check right overflow - move to left of cursor if needed
    if (posX + tooltipSize.width > windowWidth - padding) {
      posX = position.x - tooltipSize.width - offset;
    }
    
     
    if (posY + tooltipSize.height > windowHeight - padding) {
      posY = position.y - tooltipSize.height - offset;
    }
    
     
    posX = Math.max(padding, posX);
    posY = Math.max(padding, posY);
    
    return { left: posX, top: posY };
  }, [position.x, position.y, tooltipSize.width, tooltipSize.height]);

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 rounded-xl shadow-2xl border overflow-y-auto"
      style={{
        left: tooltipPosition.left,
        top: tooltipPosition.top,
        maxWidth: '260px',
        maxHeight: '320px',
        minWidth: '200px',
        padding: '12px',
        backgroundColor: 'rgba(30, 41, 59, 0.98)',
        backdropFilter: 'blur(16px)',
        borderColor: `${colors.border}40`,
        boxShadow: `0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px ${colors.border}20`,
      }}
    >
      {/* Compact Header */}
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-700">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${colors.border}25` }}
        >
          {getIcon(data.type, colors.icon)}
        </div>
        <div className="min-w-0 flex-1">
          <p 
            className="text-sm font-semibold truncate" 
            style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}
          >
            {data.name}
          </p>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider`}
            style={{ color: colors.icon }}
          >
            {data.type === 'ASSETS_COLLAPSED' 
              ? (data.metadata?.count ? `Assets (${data.metadata.count})` : 'Assets')
              : data.type === 'SUPPLIERS_COLLAPSED'
              ? (data.metadata?.count ? `Suppliers (${data.metadata.count})` : 'Suppliers')
              : data.type
            }
          </span>
        </div>
      </div>

      {/* Compact Metadata - Show only important fields */}
      <div className="space-y-1">
        {Object.entries(metadata)
          .filter(([key]) => {
            // Filter to show only most relevant fields
            const relevantKeys = [
              'code', 'Type', 'type', 'Status', 'status', 
              'City', 'city', 'Country', 'country',
              'Assets Count', 'count',
              'Asset Code', 'Supplier', 'Supplier Type'
            ];
            return relevantKeys.some(k => key.toLowerCase().includes(k.toLowerCase()));
          })
          .slice(0, 6) // Limit to 6 items for compact view
          .map(([key, value]) => (
          <div key={key} className="flex justify-between text-xs">
            <span className="text-slate-400 capitalize truncate flex-shrink-0 mr-2">
              {key.replace(/_/g, ' ')}
            </span>
            <span 
              className="text-slate-200 font-medium truncate text-right" 
              title={formatValue(value)}
              style={{ textShadow: '0 1px 1px rgba(0, 0, 0, 0.2)' }}
            >
              {formatValue(value)}
            </span>
          </div>
        ))}
        {Object.keys(metadata).length > 6 && (
          <div className="text-xs text-slate-500 text-center pt-1">
            +{Object.keys(metadata).length - 6} more fields
          </div>
        )}
      </div>
    </div>
  );
});

Tooltip.displayName = 'Tooltip';

export { GlassNode, Tooltip, getIcon, getTypeBadgeColor };
