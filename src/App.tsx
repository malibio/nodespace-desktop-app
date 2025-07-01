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
  // Start with empty nodes, proper date-based loading happens in useEffect
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
      // Check if this is a virtual node first
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
      try {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const newNodeId = await invoke<string>('create_node_for_date', {
          dateStr: dateStr,
          content: content || '', // Allow empty initial content
          virtualNodeId: null // No virtual node ID for Enter-created nodes
        });
        
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

  // Simplified node conversion - hierarchy handled by backend
  // Direct mapping from hierarchical backend data to BaseNode array
  const convertToBaseNodes = (hierarchicalData: any): BaseNode[] => {
    if (!hierarchicalData?.children) return [];
    
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
    return result;
  };


  // Simplified date loading using hierarchical API from backend
  const loadNodesForDate = useCallback(async (date: Date) => {
    try {
      setLoading(true);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const hierarchicalData = await invoke<any>('get_nodes_for_date', { 
        dateStr: dateStr 
      });
      
      // Direct mapping from hierarchical backend data to BaseNodes
      const frontendNodes = convertToBaseNodes(hierarchicalData);
      
      // Handle empty date state with virtual empty node
      if (frontendNodes.length === 0) {
        const virtualEmptyNode = new TextNode('');
        (virtualEmptyNode as any).isVirtual = true;
        (virtualEmptyNode as any).dateContext = dateStr;
        setNodes([virtualEmptyNode]);
      } else {
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

  // Handle virtual node content changes
  const handleVirtualNodeContent = useCallback(async (nodeId: string, providedContent: string) => {
    // Find the virtual node
    const virtualNode = nodes.find(n => n.getNodeId() === nodeId);
    
    if (!virtualNode || !(virtualNode as any).isVirtual) {
      return;
    }

    // Use current node content instead of debounced content to avoid stale data
    const currentContent = typeof virtualNode.getContent() === 'string' ? virtualNode.getContent() : '';
    
    if (currentContent.trim() === '') {
      return;
    }

    try {
      const dateContext = (virtualNode as any).dateContext;
      
      // Create real node for the date, reusing the virtual node ID
      const newNodeId = await invoke<string>('create_node_for_date', {
        dateStr: dateContext,
        content: currentContent.trim(),
        virtualNodeId: nodeId // Pass the virtual node ID to reuse it
      });

      // Since we reused the virtual node ID, newNodeId should equal nodeId
      if (newNodeId === nodeId) {
        // Simply mark the virtual node as real (no ID change needed)
        const updatedNodes = nodes.map(node => {
          if (node.getNodeId() === nodeId) {
            delete (node as any).isVirtual;
            delete (node as any).dateContext;
            return node;
          }
          return node;
        });
        setNodes(updatedNodes);
      } else {
        console.warn(`Unexpected! Backend generated different ID: ${newNodeId} vs ${nodeId}`);
        // Fallback to old behavior if somehow IDs don't match
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
          return;
        }
        
        await invoke('update_node_content', { nodeId, content });
      } catch (error) {
        // Handle expected errors gracefully (e.g., node was converted/deleted)
        if (!error.toString().includes('Record not found') && !error.toString().includes('not found')) {
          console.error('Failed to auto-save node content:', error);
        }
      }
    }, 500), // 500ms delay
    [nodes] // Add nodes dependency so we have current state
  );

  // Debounced virtual node to real node conversion
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
      await invoke('update_node_structure', { operation, nodeId });
      
      // Note: Structure changes are already reflected in the local state via onNodesChange callback
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