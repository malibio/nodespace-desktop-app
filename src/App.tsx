import { useState, useRef, useEffect, useCallback } from 'react';
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
  // const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  
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


  // NS-124 Integration: Use actual onNodeCreateWithId callback interface
  const callbacks: NodeSpaceCallbacks = {
    onNodesChange: (newNodes: BaseNode[]) => {
      setNodes(newNodes);
    },
    onNodeChange: (nodeId: string, content: string) => {
      // Fire-and-forget pattern: All nodes are real, just debounce auto-save
      debouncedSaveContent(nodeId, content);
    },
    // NEW: NS-124 callback interface - Frontend provides UUID, backend uses it
    onNodeCreateWithId: (nodeId: string, content: string, parentId?: string) => {
      try {
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        // Fire-and-forget: Use create_node_for_date_with_id (NS-124 pattern)
        invoke('create_node_for_date_with_id', {
          nodeId: nodeId,
          dateStr: dateStr,
          content: content || '',
        }).catch(error => {
          console.error('Background node creation failed (fire-and-forget):', error);
        });
        
        // Return Promise<void> for fire-and-forget pattern
        return Promise.resolve();
      } catch (error) {
        console.error('Failed to process node creation:', error);
        return Promise.reject(error);
      }
    },
    // LEGACY: Keep old callback for compatibility until core-ui migration complete
    onNodeCreate: async (content: string, parentId?: string, nodeType?: string) => {
      // Legacy fallback - generate UUID and delegate to onNodeCreateWithId
      const nodeId = crypto.randomUUID();
      await callbacks.onNodeCreateWithId?.(nodeId, content, parentId);
      return nodeId;
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

  // const addNode = () => {
  //   const newNode = new TextNode('New node');
  //   setNodes([...nodes, newNode]);
  // };

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
      
      // Immediate date node creation: If empty date, create a real empty node for UX
      if (frontendNodes.length === 0) {
        try {
          console.log(`📝 Creating immediate date node for empty date: ${dateStr}`);
          
          // Generate UUID upfront (NS-124 pattern)
          const nodeId = crypto.randomUUID();
          
          // Fire-and-forget: Create node in background using create_node_for_date_with_id
          invoke('create_node_for_date_with_id', {
            nodeId: nodeId,
            dateStr: dateStr,
            content: '', // Start with empty content - user can type immediately
          }).catch(error => {
            console.error('Background immediate node creation failed (fire-and-forget):', error);
          });
          
          // Create a real node in UI state immediately with generated UUID
          const newNode = new TextNode('');
          (newNode as any).id = nodeId;
          setNodes([newNode]);
        } catch (error) {
          console.error('Failed to create immediate date node:', error);
          // Fallback to empty interface
          setNodes([]);
        }
      } else {
        setNodes(frontendNodes);
      }
    } catch (error) {
      console.error('Failed to load hierarchical data for date:', error);
      // On error, just show empty interface
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Removed handleVirtualNodeContent - no longer needed with fire-and-forget pattern

  // Load nodes when date changes
  useEffect(() => {
    // ONNX migration is complete - re-enabling date navigation
    loadNodesForDate(selectedDate);
  }, [selectedDate, loadNodesForDate]);

  // Debounced auto-save for content changes - fire-and-forget pattern
  const debouncedSaveContent = useCallback(
    debounce(async (nodeId: string, content: string) => {
      try {
        // All nodes are real nodes now - no virtual node checks needed
        await invoke('update_node_content', { nodeId, content });
      } catch (error) {
        // Handle expected errors gracefully (e.g., node was deleted)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Record not found') && !errorMessage.includes('not found')) {
          console.error('Failed to auto-save node content:', error);
        }
      }
    }, 500), // 500ms delay
    [] // No dependencies needed for fire-and-forget pattern
  );

  // Removed debouncedCreateFromVirtual - no longer needed with fire-and-forget pattern

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
    let timeout: ReturnType<typeof setTimeout>;
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