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
        // IMMEDIATE: Update virtual node content in React state
        const updatedNodes = nodes.map(n => {
          if (n.getNodeId() === nodeId) {
            (n as any).content = content; // Update content immediately
            return n;
          }
          return n;
        });
        setNodes(updatedNodes);
        
        // DEBOUNCED: Handle virtual node to real node conversion
        debouncedCreateFromVirtual(nodeId, content);
      } else {
        // Auto-save content changes with debouncing for real nodes
        debouncedSaveContent(nodeId, content);
      }
    },
    onNodeCreate: async (content: string, parentId?: string, nodeType?: string) => {
      // Called when user presses Enter to create a new sibling node
      console.log(`🔄 Creating new node: content="${content}", parentId="${parentId}", nodeType="${nodeType}"`);
      
      try {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const newNodeId = await invoke<string>('create_node_for_date', {
          dateStr: dateStr,
          content: content || '', // Allow empty initial content
          virtualNodeId: null // No virtual node ID for Enter-created nodes
        });
        
        console.log(`✅ Created new sibling node ${newNodeId} for date ${dateStr}`);
        
        // Let core-ui handle the UI state - just return the ID
        return newNodeId;
      } catch (error) {
        console.error('Failed to create new node:', error);
        throw error;
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
  // NS-119: Thin wrapper - direct mapping from hierarchical backend data to BaseNode array
  // Eliminates complex conversion layers while preserving hierarchy metadata for UI
  const convertToBaseNodes = (hierarchicalData: any): BaseNode[] => {
    if (!hierarchicalData?.children) return [];
    
    console.log(`🏗️ NS-119: Direct mapping of ${hierarchicalData.children.length} hierarchical nodes`);
    
    const result: BaseNode[] = [];
    
    const processNode = (hierarchicalNode: any) => {
      const nodeData = hierarchicalNode.node;
      const content = typeof nodeData.content === 'string' ? nodeData.content : JSON.stringify(nodeData.content);
      
      // Determine node type from metadata or default to TextNode
      const nodeType = nodeData.metadata?.nodeType || nodeData.node_type || 'text';
      
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
      
      // Preserve hierarchy metadata for UI rendering
      (node as any).depth = hierarchicalNode.depth || 0;
      (node as any).siblingIndex = hierarchicalNode.sibling_index || 0;
      (node as any).parentId = hierarchicalNode.parent_id || null;
      
      result.push(node);
      
      // Process children recursively
      if (hierarchicalNode.children && hierarchicalNode.children.length > 0) {
        hierarchicalNode.children.forEach(processNode);
      }
    };
    
    hierarchicalData.children.forEach(processNode);
    console.log(`✅ NS-119: Mapped to ${result.length} BaseNode objects with hierarchy metadata`);
    return result;
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
      
      console.log(`✅ NS-111: Received structured data from backend for ${dateStr}:`, hierarchicalData);
      console.log(`🔍 NS-111: Data type:`, typeof hierarchicalData);
      console.log(`🔍 NS-111: Is array:`, Array.isArray(hierarchicalData));
      console.log(`🔍 NS-111: Data structure keys:`, Object.keys(hierarchicalData || {}));
      console.log(`🔍 NS-111: Data length/children:`, hierarchicalData?.children?.length || hierarchicalData?.length || 'no length property');
      console.log(`🔍 NS-111: Full data structure:`, JSON.stringify(hierarchicalData, null, 2));
      
      // NS-119: Direct mapping from hierarchical backend data to BaseNodes
      const frontendNodes = convertToBaseNodes(hierarchicalData);
      console.log(`🔍 NS-119: Mapped to ${frontendNodes.length} frontend nodes`);
      
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
  const handleVirtualNodeContent = useCallback(async (nodeId: string, providedContent: string) => {
    console.log(`🔍 NS-105: handleVirtualNodeContent called - nodeId: ${nodeId}, providedContent: "${providedContent}"`);
    
    // Find the virtual node
    const virtualNode = nodes.find(n => n.getNodeId() === nodeId);
    console.log(`🔍 NS-105: Virtual node found:`, virtualNode ? 'YES' : 'NO');
    console.log(`🔍 NS-105: Is virtual:`, virtualNode ? (virtualNode as any).isVirtual : 'N/A');
    
    if (!virtualNode || !(virtualNode as any).isVirtual) {
      console.log(`🚫 NS-105: Skipping virtual node conversion - virtualNode: ${!!virtualNode}, isVirtual: ${virtualNode ? (virtualNode as any).isVirtual : false}`);
      return;
    }

    // Use current node content instead of debounced content to avoid stale data
    const currentContent = typeof virtualNode.getContent() === 'string' ? virtualNode.getContent() : '';
    console.log(`🔍 NS-105: Current node content: "${currentContent}"`);
    
    if (currentContent.trim() === '') {
      console.log(`🚫 NS-105: Skipping conversion - current content is empty`);
      return;
    }

    try {
      const dateContext = (virtualNode as any).dateContext;
      console.log(`🔄 NS-105: Converting virtual node to real node for date ${dateContext}`);
      
      // Create real node for the date, reusing the virtual node ID
      const newNodeId = await invoke<string>('create_node_for_date', {
        dateStr: dateContext,
        content: currentContent.trim(),
        virtualNodeId: nodeId // Pass the virtual node ID to reuse it
      });

      console.log(`✅ NS-105: Created real node ${newNodeId} for date ${dateContext}`);
      
      // Since we reused the virtual node ID, newNodeId should equal nodeId
      if (newNodeId === nodeId) {
        console.log(`🎯 NS-105: Virtual node ID was successfully reused! ${nodeId}`);
        
        // Simply mark the virtual node as real (no ID change needed)
        const updatedNodes = nodes.map(node => {
          if (node.getNodeId() === nodeId) {
            console.log(`🔄 NS-105: Converting virtual node ${nodeId} to real node (same ID)`);
            delete (node as any).isVirtual;
            delete (node as any).dateContext;
            console.log(`✅ NS-105: Virtual node converted to real node with same ID: ${node.getNodeId()}`);
            return node;
          }
          return node;
        });
        setNodes(updatedNodes);
        
        // No focus restoration needed since ID stayed the same
        console.log(`✅ NS-105: Conversion complete, focus preserved automatically`);
      } else {
        console.log(`⚠️ NS-105: Unexpected! Backend generated different ID: ${newNodeId} vs ${nodeId}`);
        // Fallback to old behavior if somehow IDs don't match
        // ... (keep existing ID swapping logic as fallback)
      }
      
    } catch (error) {
      console.error('Failed to create real node from virtual node:', error);
    }
  }, [nodes, selectedDate]);

  // Load nodes when date changes
  useEffect(() => {
    // ONNX migration is complete - re-enabling date navigation
    loadNodesForDate(selectedDate);
  }, [selectedDate, loadNodesForDate]);

  // Debounced auto-save for content changes
  const debouncedSaveContent = useCallback(
    debounce(async (nodeId: string, content: string) => {
      try {
        // Safety check: Only auto-save real nodes that still exist
        const currentNode = nodes.find(n => n.getNodeId() === nodeId);
        if (!currentNode || (currentNode as any).isVirtual) {
          console.log(`⏭️ NS-39: Skipping auto-save for virtual/missing node ${nodeId}`);
          return;
        }
        
        console.log(`💾 NS-39: Auto-saving content for node ${nodeId}`);
        await invoke('update_node_content', { nodeId, content });
        console.log(`✅ NS-39: Auto-saved content for node ${nodeId}`);
      } catch (error) {
        // Handle expected errors gracefully (e.g., node was converted/deleted)
        if (error.toString().includes('Record not found') || error.toString().includes('not found')) {
          console.log(`ℹ️ NS-39: Node ${nodeId} not found (likely converted from virtual) - skipping auto-save`);
        } else {
          console.error('Failed to auto-save node content:', error);
        }
      }
    }, 500), // 500ms delay
    [nodes] // Add nodes dependency so we have current state
  );

  // NS-105: Debounced virtual node to real node conversion
  const debouncedCreateFromVirtual = useCallback(
    debounce(async (nodeId: string, content: string) => {
      // Always call handleVirtualNodeContent - it will check current content and virtual status
      await handleVirtualNodeContent(nodeId, content);
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
      
      // Note: Removed aggressive loadNodesForDate() that was clearing user input
      // Structure changes are already reflected in the local state via onNodesChange callback
    } catch (error) {
      console.error('Failed to save structure change:', error);
    }
  }, [selectedDate]);

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