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
  const [nodes, setNodes] = useState<BaseNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasUserEdits, setHasUserEdits] = useState<boolean>(false);
  
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
      // Track that user has made edits
      setHasUserEdits(true);
      // Auto-save content changes with debouncing
      debouncedSaveContent(nodeId, content);
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

  const addNode = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const metadata = {
        created_date: dateStr,
        nodeType: "text"
      };
      
      await invoke<string>('create_knowledge_node', { 
        content: 'New node', 
        metadata: metadata 
      });
      
      // Reload to show the new node with proper backend ID
      loadNodesForDate(selectedDate);
    } catch (error) {
      console.error('❌ Failed to create new node:', error);
      // Fallback to frontend-only node
      const newNode = new TextNode('New node');
      setNodes([...nodes, newNode]);
    }
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

  // Convert backend Node data to frontend BaseNode instances with proper hierarchy
  const convertToBaseNodes = (backendNodes: any[]): BaseNode[] => {
    // Step 1: Create all nodes as individual instances
    const nodeMap = new Map<string, BaseNode>();
    const parentChildMap = new Map<string, string[]>(); // parent_id -> [child_ids]
    
    backendNodes.forEach((nodeData) => {
      const content = typeof nodeData.content === 'string' ? nodeData.content : JSON.stringify(nodeData.content);
      
      // Skip pure date header nodes (like "# June 27, 2025") but keep content nodes that start with #
      if (content.trim().startsWith('# ') && 
          (content.includes('June') || content.includes('July') || content.includes('August')) && 
          (content.includes('2025') || content.includes('2024')) &&
          content.length < 50) { // Short date headers only
        return;
      }
      
      // Determine node type from metadata or default to TextNode
      const nodeType = nodeData.metadata?.nodeType || 'text';
      
      let node: BaseNode;
      switch (nodeType) {
        case 'ai-chat':
          node = new AIChatNode(content, nodeData.id);
          break;
        case 'task':
          node = new TaskNode(content, nodeData.id);
          break;
        default:
          node = new TextNode(content, nodeData.id);
      }
      // Store sibling pointer information for UI ordering
      (node as any).next_sibling = nodeData.next_sibling;
      (node as any).previous_sibling = nodeData.previous_sibling;
      
      nodeMap.set(nodeData.id, node);
      
      // Build parent-child mapping
      const parentId = nodeData.metadata?.parent_id;
      if (parentId) {
        if (!parentChildMap.has(parentId)) {
          parentChildMap.set(parentId, []);
        }
        parentChildMap.get(parentId)!.push(nodeData.id);
      }
    });
    
    // Step 2: Build the hierarchy by adding children to parents
    parentChildMap.forEach((childIds, parentId) => {
      const parentNode = nodeMap.get(parentId);
      if (parentNode) {
        // Sort children by sibling order
        const sortedChildIds = sortChildrenBySiblingOrder(childIds, nodeMap);
        
        sortedChildIds.forEach(childId => {
          const childNode = nodeMap.get(childId);
          if (childNode) {
            parentNode.addChild(childNode);
          }
        });
      }
    });
    
    // Step 3: Return only root nodes (nodes without parents in current set)
    const rootNodes: BaseNode[] = [];
    
    nodeMap.forEach((node, nodeId) => {
      // Check if this node has a parent in our current node set
      const parentId = backendNodes.find(n => n.id === nodeId)?.metadata?.parent_id;
      const hasParentInCurrentSet = parentId && nodeMap.has(parentId);
      
      if (!hasParentInCurrentSet) {
        rootNodes.push(node);
      }
    });
    
    return rootNodes;
  };

  // Helper function to sort children by sibling order
  const sortChildrenBySiblingOrder = (childIds: string[], nodeMap: Map<string, BaseNode>): string[] => {
    if (childIds.length <= 1) return childIds;
    
    // Find the first child (one with no previous_sibling)
    const firstChildId = childIds.find(childId => {
      const node = nodeMap.get(childId);
      return !(node as any).previous_sibling;
    });
    
    if (!firstChildId) return childIds; // No clear ordering, return as-is
    
    // Build the ordered sequence
    const ordered: string[] = [];
    let currentId: string | undefined = firstChildId;
    
    while (currentId && childIds.includes(currentId)) {
      ordered.push(currentId);
      const currentNode = nodeMap.get(currentId);
      currentId = (currentNode as any).next_sibling;
    }
    
    // Add any remaining children that weren't in the sibling chain
    childIds.forEach(id => {
      if (!ordered.includes(id)) {
        ordered.push(id);
      }
    });
    
    return ordered;
  };

  // Sort nodes by sibling pointer relationships for proper sequence display
  const sortNodesBySiblingOrder = (nodes: any[]): any[] => {
    if (nodes.length === 0) return nodes;

    // Create a map for quick lookup
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const sortedNodes: any[] = [];
    const visited = new Set<string>();

    // Find nodes that have no previous sibling (start of sequences)
    const firstNodes = nodes.filter(node => !node.previous_sibling);

    // Process each sequence starting from first nodes
    for (const firstNode of firstNodes) {
      let currentNode = firstNode;
      
      // Follow the sibling chain
      while (currentNode && !visited.has(currentNode.id)) {
        visited.add(currentNode.id);
        sortedNodes.push(currentNode);
        
        // Move to next sibling
        currentNode = currentNode.next_sibling ? nodeMap.get(currentNode.next_sibling) : null;
      }
    }

    // Add any remaining nodes that weren't part of sibling chains
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        sortedNodes.push(node);
      }
    }

    return sortedNodes;
  };

  // Load nodes for a specific date from database
  const loadNodesForDate = useCallback(async (date: Date) => {
    try {
      setLoading(true);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const backendNodes = await invoke<any[]>('get_nodes_for_date', { 
        dateStr: dateStr 
      });
      
      const frontendNodes = convertToBaseNodes(backendNodes);
      
      // Only update nodes if user hasn't started editing (to prevent overwriting user input)
      if (!hasUserEdits) {
        if (frontendNodes.length === 0) {
          // Create and save an empty node to the backend first
          createEmptyNodeForDate(selectedDate);
        } else {
          setNodes(frontendNodes);
        }
      }
    } catch (error) {
      console.error('Failed to load nodes for date:', error);
      // Fallback to empty text node on error so user can start typing
      const emptyNode = new TextNode('');
      setNodes([emptyNode]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a backend-persisted empty node for a date
  const createEmptyNodeForDate = useCallback(async (date: Date) => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      const metadata = {
        created_date: dateStr,
        nodeType: "text"
      };
      
      const nodeId = await invoke<string>('create_knowledge_node', { 
        content: '', 
        metadata: metadata 
      });
      
      // Now reload the data to show the new empty node
      loadNodesForDate(date);
    } catch (error) {
      console.error('❌ Failed to create empty node:', error);
      // Fallback to frontend-only empty node
      const emptyNode = new TextNode('');
      setNodes([emptyNode]);
    }
  }, [loadNodesForDate]);

  // Load nodes when date changes with slight delay to allow backend persistence
  useEffect(() => {
    // Reset edit tracking when changing dates
    setHasUserEdits(false);
    
    const timer = setTimeout(() => {
      loadNodesForDate(selectedDate);
    }, 50); // Small delay to ensure backend writes complete
    
    return () => clearTimeout(timer);
  }, [selectedDate, loadNodesForDate]);

  // Debounced auto-save for content changes
  const debouncedSaveContent = useCallback(
    debounce(async (nodeId: string, content: string) => {
      try {
        await invoke('update_node_content', { nodeId, content });
      } catch (error) {
        console.error('❌ Failed to auto-save node content:', error);
      }
    }, 500), // 500ms debounce for efficient batching
    []
  );

  // Immediate save for structure changes including sibling relationships
  const saveStructureChange = useCallback(async (operation: string, nodeId: string) => {
    try {
      await invoke('update_node_structure', { operation, nodeId });
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
        focusedNodeId={focusedNodeId}
        callbacks={callbacks}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onRemoveNode={handleRemoveNode}
        collapsedNodes={collapsedNodes}
        onCollapseChange={handleCollapseChange}
        className={isDarkMode ? 'ns-dark-mode' : ''}
      />
      
    </div>
  );
}

export default App;