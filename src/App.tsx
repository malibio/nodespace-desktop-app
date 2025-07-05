import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  
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

  const debouncedSaveContent = useMemo(
    () => debounce(async (nodeId: string, content: string) => {
      try {
        await invoke('update_node_content', { nodeId, content });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Record not found') && !errorMessage.includes('not found')) {
          console.error('Failed to auto-save node content:', error);
        }
      }
    }, 500),
    []
  );

  const handleNodeDeletion = useCallback(async (nodeId: string, deletionContext?: any) => {
    try {
      await invoke('delete_node', {
        nodeId: nodeId,
        deletionContext: deletionContext || {}
      });
    } catch (error) {
      console.error('Failed to persist node deletion:', error);
    }
  }, []);

  const handleAIChatQuery = useCallback(async (request: any) => {
    const startTime = Date.now();
    
    try {
      const queryResponse = await invoke<{
        answer: string;
        sources: Array<{
          node: any;
          score: number;
          snippet: string;
        }>;
        confidence: number;
        generation_time_ms?: number;
        overall_confidence?: number;
      }>('process_query', {
        question: request.query.trim()
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const enhancedResponse = {
        ...queryResponse,
        generation_time_ms: responseTime,
        overall_confidence: queryResponse.confidence || 0.5
      };

      const metadata = {
        question: request.query,
        response: enhancedResponse.answer,
        confidence: enhancedResponse.confidence,
        generation_time_ms: enhancedResponse.generation_time_ms,
        overall_confidence: enhancedResponse.overall_confidence,
        node_sources: enhancedResponse.sources.map(source => ({
          node_id: source.node.id,
          score: source.score,
          snippet: source.snippet,
          created_at: source.node.created_at
        })),
        created_at: new Date().toISOString()
      };

      return {
        answer: enhancedResponse.answer,
        metadata: metadata
      };
    } catch (error) {
      return {
        answer: "I apologize, but I encountered an error while processing your question. Please try again.",
        metadata: {
          question: request.query,
          response: "Error occurred during processing",
          error: error instanceof Error ? error.message : String(error),
          confidence: 0.0,
          overall_confidence: 0.0,
          node_sources: [],
          created_at: new Date().toISOString()
        }
      };
    }
  }, []);

  const saveStructureChange = useCallback(async (
    operation: string,
    nodeId: string,
    parentId: string | null,
    formerParentId: string | null,
    hierarchyLevel: number,
    nodeContent: string,
    nodeType: string,
    timestamp: string,
    dateStr: string,
    beforeSiblingId?: string | null
  ) => {
    try {
      await invoke('update_node_structure', {
        operation,
        nodeId,
        parentId,
        formerParentId,
        hierarchyLevel,
        nodeContent,
        nodeType,
        timestamp,
        dateStr,
        beforeSiblingId
      });
    } catch (error) {
      console.error('Failed to save structure change:', error);
    }
  }, []);

  const nodeSpaceCallbacks: NodeSpaceCallbacks = useMemo(() => ({
    onNodeUpdate: async (nodeId: string, newContent: string, nodeType: string) => {
      const trimmedContent = newContent.trim();
      if (trimmedContent.length === 0) return;
      
      debouncedSaveContent(nodeId, trimmedContent);
    },

    onNodeCreation: async (
      nodeId: string,
      content: string,
      parentId: string | null,
      nodeType: string,
      beforeSiblingId?: string | null
    ) => {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      try {
        await invoke('create_node_for_date_with_id', {
          nodeId,
          dateStr,
          content,
          parentId,
          nodeType: nodeType || 'text',
          beforeSiblingId
        });
      } catch (error) {
        console.error('Failed to create node with backend:', error);
      }
    },

    onNodeStructureChange: saveStructureChange,
    
    onNodeDeletion: handleNodeDeletion,

    onFocusChange: (nodeId: string | null) => {
      setFocusedNodeId(nodeId);
    },

    onSemanticSearch: async (searchQuery: string) => {
      if (!searchQuery || searchQuery.trim().length === 0) {
        return [];
      }

      try {
        const searchResults = await invoke<Array<{
          node: BaseNode;
          score: number;
          snippet: string;
        }>>('semantic_search', {
          query: searchQuery.trim(),
          limit: 10
        });

        return searchResults.map(result => ({
          ...result.node,
          searchScore: result.score,
          searchSnippet: result.snippet
        }));
      } catch (error) {
        console.error('Failed to perform semantic search:', error);
        return [];
      }
    },

    onAIChatQuery: handleAIChatQuery,

    onUpsertNode: async (
      nodeId: string,
      content: string,
      parentId: string | null,
      beforeSiblingId: string | null,
      nodeType: string,
      metadata?: any
    ) => {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      try {
        await invoke('upsert_node', {
          nodeId,
          dateStr,
          content,
          parentId,
          beforeSiblingId,
          nodeType,
          metadata
        });
      } catch (error) {
        console.error('Failed to upsert node:', error);
      }
    }
  }), [selectedDate, debouncedSaveContent, saveStructureChange, handleNodeDeletion, handleAIChatQuery]);

  const loadNodesForDate = useCallback(async (date: Date) => {
    try {
      const dateString = date.toISOString().split('T')[0];
      const data = await invoke<any>('get_nodes_for_date', { dateStr: dateString });
      
      if (data && (data.children || data.length !== undefined)) {
        const nodeData = data.children || data;
        setNodes(Array.isArray(nodeData) ? nodeData : []);
      } else {
        setNodes([]);
      }
    } catch (error) {
      console.error('Error loading nodes for date:', error);
      setNodes([]);
    }
  }, []);

  useEffect(() => {
    loadNodesForDate(selectedDate);
  }, [selectedDate, loadNodesForDate]);

  const handleDateChange = useCallback((date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      setShowDatePicker(false);
    }
  }, []);

  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const goToPreviousDay = useCallback(() => {
    const previousDay = new Date(selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    setSelectedDate(previousDay);
  }, [selectedDate]);

  const goToNextDay = useCallback(() => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <div className={`app ${isDarkMode ? 'dark-mode' : ''}`}>
      <div className="header">
        <div className="header-left">
          <h1 className="app-title">NodeSpace</h1>
          <div className="date-navigation">
            <button onClick={goToPreviousDay} className="nav-button">←</button>
            <button 
              onClick={() => setShowDatePicker(!showDatePicker)} 
              className="date-display"
            >
              {formatDisplayDate(selectedDate)}
            </button>
            <button onClick={goToNextDay} className="nav-button">→</button>
            {!isToday && (
              <button onClick={goToToday} className="today-button">Today</button>
            )}
          </div>
          <div className="node-count">
            Nodes: {totalNodeCount}
          </div>
        </div>

        <div className="header-right">
          <button onClick={toggleDarkMode} className="theme-toggle">
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {showDatePicker && (
        <div className="date-picker-overlay">
          <div className="date-picker-container">
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              inline
              calendarClassName="custom-calendar"
            />
            <button 
              onClick={() => setShowDatePicker(false)} 
              className="close-picker"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="main-content">
        <NodeSpaceEditor
          nodes={nodes}
          collapsedNodes={collapsedNodes}
          onCollapseChange={handleCollapseChange}
          focusedNodeId={focusedNodeId}
          onFocusChange={setFocusedNodeId}
          isDarkMode={isDarkMode}
          callbacks={nodeSpaceCallbacks}
        />
      </div>
    </div>
  );
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default App;