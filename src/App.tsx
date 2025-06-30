import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TextNode, BaseNode, TaskNode, AIChatNode } from 'nodespace-core-ui';
import NodeSpaceEditor from 'nodespace-core-ui';
import { NodeSpaceCallbacks } from 'nodespace-core-ui';
import { countAllNodes } from 'nodespace-core-ui';
import DatePicker from 'react-datepicker';
import { invoke } from '@tauri-apps/api/core';
import "react-datepicker/dist/react-datepicker.css";
import "nodespace-core-ui/dist/nodeSpace.css";
import './App.css';

function App() {
  // NS-105: Start with empty nodes, proper date-based loading happens in useEffect
  const [nodes, setNodes] = useState<BaseNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  
  const totalNodeCount = countAllNodes(nodes);
  const handleCollapseChange = useCallback((nodeId: string, collapsed: boolean) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (collapsed) {
        newSet.add(nodeId);
      } else {
        newSet.delete(nodeId);
      }
      return newSet;
    });
  }, []);


  const callbacks: NodeSpaceCallbacks = {
    onNodesChange: (newNodes: BaseNode[]) => {
      setNodes(newNodes);
    },
    onNodeChange: (nodeId: string, content: string) => {
      // NS-105: Check if this is a virtual node first
      const node = nodes.find(n => n.getNodeId() === nodeId);
      if (node && (node as any).isVirtual) {
        // Handle virtual node content change with debouncing
        debouncedCreateFromVirtual(nodeId, content);
      } else {
        // Auto-save content changes with debouncing for real nodes
        debouncedSaveContent(nodeId, content);
      }
    },
    onNodeStructureChange: (operation: string, nodeId: string) => {
      // Immediately save structure changes (parent/child relationships)
      saveStructureChange(operation, nodeId);
    }
  };

  const handleFocus = (nodeId: string) => {
    setFocusedNodeId(nodeId);
  };

  const handleBlur = () => {
    setFocusedNodeId(null);
  };

  const handleRemoveNode = (node: BaseNode) => {
    if (totalNodeCount > 1) {
      if (node.parent) {
        node.parent.removeChild(node);
      } else {
        const newNodes = nodes.filter(n => n.getNodeId() !== node.getNodeId());
        setNodes(newNodes);
        return;
      }
      setNodes([...nodes]);
    }
  };

  const addNode = () => {
    const newNode = new TextNode('New node');
    setNodes([...nodes, newNode]);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
    }
    setShowDatePicker(false);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // NS-111: Simplified node conversion - hierarchy now handled by backend
  const convertHierarchicalToBaseNodes = (hierarchicalData: any): BaseNode[] => {
    if (!hierarchicalData) return [];
    
    // Handle both new hierarchical format and legacy flat format for backward compatibility
    if (hierarchicalData.children) {
      // New hierarchical format from NS-110
      console.log(`🏗️ NS-111: Converting hierarchical data with ${hierarchicalData.children.length} children`);
      return flattenHierarchicalNodes(hierarchicalData.children);
    } else if (Array.isArray(hierarchicalData)) {
      // Legacy flat format fallback
      console.log(`📦 NS-111: Converting legacy flat nodes (${hierarchicalData.length} nodes)`);
      return hierarchicalData.map(nodeData => createBaseNodeFromData(nodeData));
    }
    
    return [];
  };
  
  // Helper to flatten hierarchical structure into BaseNode array
  const flattenHierarchicalNodes = (hierarchicalNodes: any[]): BaseNode[] => {
    const result: BaseNode[] = [];
    
    const processNode = (hierarchicalNode: any) => {
      const baseNode = createBaseNodeFromData(hierarchicalNode.node);
      
      // Store hierarchy metadata for UI rendering
      (baseNode as any).depth = hierarchicalNode.depth || 0;
      (baseNode as any).siblingIndex = hierarchicalNode.sibling_index || 0;
      (baseNode as any).parentId = hierarchicalNode.parent_id || null;
      
      result.push(baseNode);
      
      // Process children recursively
      if (hierarchicalNode.children && hierarchicalNode.children.length > 0) {
        hierarchicalNode.children.forEach(processNode);
      }
    };
    
    hierarchicalNodes.forEach(processNode);
    return result;
  };
  
  // Helper to create BaseNode from node data
  const createBaseNodeFromData = (nodeData: any): BaseNode => {
    const content = typeof nodeData.content === 'string' ? nodeData.content : JSON.stringify(nodeData.content);
    
    // Determine node type from metadata or default to TextNode
    const nodeType = nodeData.metadata?.nodeType || 'text';
    
    let node: BaseNode;
    switch (nodeType) {
      case 'ai-chat':
        node = new AIChatNode(content);
        break;
      case 'task':
        node = new TaskNode(content);
        break;
      default:
        node = new TextNode(content);
    }
    
    // Set the ID to match backend
    (node as any).id = nodeData.id;
    return node;
  };


  // NS-111: Simplified date loading using hierarchical API from backend
  const loadNodesForDate = useCallback(async (date: Date) => {
    try {
      setLoading(true);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`🔄 NS-111: Loading hierarchical data for date: ${dateStr}`);
      const hierarchicalData = await invoke<any>('get_nodes_for_date', { 
        dateStr: dateStr 
      });
      
      console.log(`✅ NS-111: Received structured data from backend for ${dateStr}`);
      
      // Convert hierarchical data to frontend nodes (handles both new and legacy formats)
      const frontendNodes = convertHierarchicalToBaseNodes(hierarchicalData);
      
      // NS-105: Handle empty date state with virtual empty node
      if (frontendNodes.length === 0) {
        console.log(`📝 NS-111: Empty date detected, creating virtual empty node for ${dateStr}`);
        const virtualEmptyNode = new TextNode('');
        // Mark this as a virtual node that hasn't been persisted yet
        (virtualEmptyNode as any).isVirtual = true;
        (virtualEmptyNode as any).dateContext = dateStr;
        setNodes([virtualEmptyNode]);
      } else {
        console.log(`🏗️ NS-111: Setting ${frontendNodes.length} hierarchically structured nodes`);
        setNodes(frontendNodes);
      }
    } catch (error) {
      console.error('Failed to load hierarchical data for date:', error);
      // Fallback to virtual empty node on error
      const virtualEmptyNode = new TextNode('');
      (virtualEmptyNode as any).isVirtual = true;
      (virtualEmptyNode as any).dateContext = date.toISOString().split('T')[0];
      setNodes([virtualEmptyNode]);
    } finally {
      setLoading(false);
    }
  }, []);

  // NS-105: Handle virtual node content changes
  const handleVirtualNodeContent = useCallback(async (nodeId: string, content: string) => {
    // Find the virtual node
    const virtualNode = nodes.find(n => n.getNodeId() === nodeId);
    if (!virtualNode || !(virtualNode as any).isVirtual || content.trim() === '') {
      return;
    }

    try {
      const dateContext = (virtualNode as any).dateContext;
      console.log(`🔄 NS-105: Converting virtual node to real node for date ${dateContext}`);
      
      // Create real node for the date
      const newNodeId = await invoke<string>('create_node_for_date', {
        dateStr: dateContext,
        content: content.trim()
      });

      console.log(`✅ NS-105: Created real node ${newNodeId} for date ${dateContext}`);
      
      // Reload nodes for the current date to get the updated hierarchy
      await loadNodesForDate(selectedDate);
      
    } catch (error) {
      console.error('Failed to create real node from virtual node:', error);
    }
  }, [nodes, selectedDate, loadNodesForDate]);

  // Load nodes when date changes
  useEffect(() => {
    // ONNX migration is complete - re-enabling date navigation
    loadNodesForDate(selectedDate);
  }, [selectedDate, loadNodesForDate]);

  // Debounced auto-save for content changes
  const debouncedSaveContent = useCallback(
    debounce(async (nodeId: string, content: string) => {
      try {
        console.log(`💾 NS-39: Auto-saving content for node ${nodeId}`);
        await invoke('update_node_content', { nodeId, content });
        console.log(`✅ NS-39: Auto-saved content for node ${nodeId}`);
      } catch (error) {
        console.error('Failed to auto-save node content:', error);
      }
    }, 500), // 500ms delay
    []
  );

  // NS-105: Debounced virtual node to real node conversion
  const debouncedCreateFromVirtual = useCallback(
    debounce(async (nodeId: string, content: string) => {
      if (content.trim() !== '') {
        await handleVirtualNodeContent(nodeId, content);
      }
    }, 500), // 500ms delay
    [handleVirtualNodeContent]
  );

  // Immediate save for structure changes including sibling relationships
  const saveStructureChange = useCallback(async (operation: string, nodeId: string) => {
    try {
      console.log(`🔄 NS-46: Saving structure change '${operation}' for node ${nodeId}`);
      
      // Handle sibling relationship operations
      if (operation.includes('move_') || operation.includes('reorder')) {
        console.log(`📝 NS-46: Processing sibling relationship change: ${operation}`);
      }
      
      await invoke('update_node_structure', { operation, nodeId });
      console.log(`✅ NS-46: Saved structure change for node ${nodeId}`);
      
      // Reload nodes to reflect updated sibling relationships
      await loadNodesForDate(selectedDate);
    } catch (error) {
      console.error('Failed to save structure change:', error);
    }
  }, [selectedDate, loadNodesForDate]);

  // Helper function for debouncing
  function debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  return (
    <div className={`app-container ${isDarkMode ? 'ns-dark-mode' : ''}`}>
      <div className="app-header">
        <div className="date-navigation">
          <button onClick={() => navigateDate('prev')} className="nav-button">
            ‹
          </button>
          <div className="date-display-container">
            <button onClick={() => setShowDatePicker(!showDatePicker)} className="date-display">
              {formatDate(selectedDate)}
            </button>
            {showDatePicker && (
              <div className="date-picker-wrapper">
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateChange}
                  inline
                />
              </div>
            )}
          </div>
          <button onClick={() => navigateDate('next')} className="nav-button">
            ›
          </button>
        </div>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle">
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <NodeSpaceEditor
        nodes={nodes}
        focusedNodeId={focusedNodeId}
        callbacks={callbacks}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onRemoveNode={handleRemoveNode}
        collapsedNodes={collapsedNodes}
        onCollapseChange={handleCollapseChange}
      />
    </div>
  );
}

export default App;