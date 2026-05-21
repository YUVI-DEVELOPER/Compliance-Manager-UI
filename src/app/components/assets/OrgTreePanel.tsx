import React, { useState, useCallback } from "react";
import { OrgNode } from "../../../services/org.service";

interface OrgTreePanelProps {
  orgTree: OrgNode[];
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string | null) => void;
}

interface TreeNodeProps {
  node: OrgNode;
  level: number;
  selectedOrgId: string | null;
  onSelect: (orgId: string) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (orgId: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  selectedOrgId,
  onSelect,
  expandedNodes,
  onToggleExpand,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedOrgId === node.id;

  const handleClick = () => {
    onSelect(node.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(node.id);
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
          isSelected
            ? "bg-blue-100 text-blue-800 font-medium"
            : "hover:bg-slate-100 text-slate-700"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4" />
        )}
        <svg
          className={`w-4 h-4 ${isSelected ? "text-blue-600" : "text-slate-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {node.type === "COMPANY" ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          ) : node.type === "DEPARTMENT" ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          )}
        </svg>
        <span className="truncate text-sm">{node.name}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedOrgId={selectedOrgId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function OrgTreePanel({ orgTree, selectedOrgId, onSelectOrg }: OrgTreePanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const handleToggleExpand = useCallback((orgId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  }, []);

  const handleSelectOrg = useCallback(
    (orgId: string) => {
      onSelectOrg(selectedOrgId === orgId ? null : orgId);
    },
    [onSelectOrg, selectedOrgId]
  );

  const handleClearSelection = useCallback(() => {
    onSelectOrg(null);
  }, [onSelectOrg]);

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Organizations</h3>
      </div>

      {/* Clear selection button */}
      {selectedOrgId && (
        <div className="px-4 py-2 border-b border-slate-200">
          <button
            onClick={handleClearSelection}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear selection
          </button>
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {orgTree.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4">No organizations found</div>
        ) : (
          orgTree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              selectedOrgId={selectedOrgId}
              onSelect={handleSelectOrg}
              expandedNodes={expandedNodes}
              onToggleExpand={handleToggleExpand}
            />
          ))
        )}
      </div>
    </div>
  );
}
