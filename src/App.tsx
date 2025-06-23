import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TextNode, BaseNode, TaskNode } from 'nodespace-core-ui';
import NodeSpaceEditor from 'nodespace-core-ui';
import { NodeSpaceCallbacks } from 'nodespace-core-ui';
import { countAllNodes } from 'nodespace-core-ui';
import DatePicker from 'react-datepicker';
import { invoke } from '@tauri-apps/api/core';
import "react-datepicker/dist/react-datepicker.css";
import "nodespace-core-ui/dist/nodeSpace.css";
import './App.css';

function App() {
  const [nodes, setNodes] = useState<BaseNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  
  const totalNodeCount = countAllNodes(nodes);
  const callbacks: NodeSpaceCallbacks = {
    onNodesChange: (newNodes: BaseNode[]) => {
      setNodes(newNodes);
    },
    onNodeChange: (nodeId: string, content: string) => {
      // Auto-save content changes with debouncing
      debouncedSaveContent(nodeId, content);
    },
    onStructureChange: (operation: string, nodeId: string) => {
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

  const handleCollapseChange = (nodeId: string, collapsed: boolean) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (collapsed) {
        newSet.add(nodeId);
      } else {
        newSet.delete(nodeId);
      }
      return newSet;
    });
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

  // Convert backend Node data to frontend BaseNode instances
  const convertToBaseNodes = (backendNodes: any[]): BaseNode[] => {
    return backendNodes.map(nodeData => {
      const content = typeof nodeData.content === 'string' ? nodeData.content : JSON.stringify(nodeData.content);
      const node = new TextNode(content);
      // Set the ID to match backend
      (node as any).id = nodeData.id;
      return node;
    });
  };

  // Load nodes for a specific date from database
  const loadNodesForDate = useCallback(async (date: Date) => {
    try {
      setLoading(true);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`🔄 NS-39: Loading nodes for date: ${dateStr}`);
      const backendNodes = await invoke<any[]>('get_nodes_for_date', { 
        date_str: dateStr 
      });
      
      console.log(`✅ NS-39: Loaded ${backendNodes.length} nodes from database`);
      const frontendNodes = convertToBaseNodes(backendNodes);
      
      // Ensure there's always at least one node for editing
      if (frontendNodes.length === 0) {
        const defaultNode = new TextNode('Start writing here...');
        setNodes([defaultNode]);
      } else {
        setNodes(frontendNodes);
      }
    } catch (error) {
      console.error('Failed to load nodes for date:', error);
      // Fallback to default node on error
      const defaultNode = new TextNode('Start writing here...');
      setNodes([defaultNode]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load nodes when date changes
  useEffect(() => {
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

  // Immediate save for structure changes  
  const saveStructureChange = useCallback(async (operation: string, nodeId: string) => {
    try {
      console.log(`🔄 NS-39: Saving structure change '${operation}' for node ${nodeId}`);
      await invoke('update_node_structure', { operation, nodeId });
      console.log(`✅ NS-39: Saved structure change for node ${nodeId}`);
    } catch (error) {
      console.error('Failed to save structure change:', error);
    }
  }, []);

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
        callbacks={callbacks}
        focusedNodeId={focusedNodeId}
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