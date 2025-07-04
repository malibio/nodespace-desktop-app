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
  // Start with empty nodes, proper date-based loading happens in useEffect
  const [nodes, setNodes] = useState<BaseNode[]>([]);
  
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

  // Debounced auto-save for content changes - fire-and-forget pattern
  // Use useMemo to create debounced function only once
  const debouncedSaveContent = useMemo(
    () => debounce(async (nodeId: string, content: string) => {
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
    [] // Empty deps = create once and never recreate
  );

  // Handle node deletion with backend persistence
  const handleNodeDeletion = useCallback(async (nodeId: string, deletionContext?: any) => {
    try {
      console.log(`💾 Sending deletion to backend: ${nodeId.slice(0, 8)}...`);
      console.log(`📤 Deletion context:`, deletionContext);
      
      await invoke('delete_node', {
        nodeId: nodeId,
        deletionContext: deletionContext || {}
      });
      
      console.log(`✅ Node deletion persisted successfully`);
    } catch (error) {
      console.error('Failed to persist node deletion:', error);
      // Note: Core-UI has already removed the node from the UI tree
      // In case of backend failure, the deletion remains in the UI but not in database
      // This is acceptable for the fire-and-forget pattern
    }
  }, []);

  // Enhanced AIChatNode query handler with metadata storage
  const handleAIChatQuery = useCallback(async (request: any) => {
    console.log(`🚀 ===== onAIChatQuery TRIGGERED =====`);
    console.log(`🤖 AI Chat Query received: "${request.query}"`);
    console.log(`🎯 Node ID: ${request.node_id?.slice(0, 8) || 'unknown'}`);
    console.log(`💬 Current content: "${request.current_content || 'N/A'}"`);
    
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Processing RAG query: "${request.query}"`);
      
      // Use enhanced process_query Tauri command for full RAG pipeline
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
      const actualGenerationTime = queryResponse.generation_time_ms || (endTime - startTime);
      
      console.log(`✅ RAG query processing completed in ${actualGenerationTime}ms`);
      console.log(`📊 Overall Confidence: ${queryResponse.confidence}`);
      console.log(`📚 Found ${queryResponse.sources.length} source(s)`);
      console.log(`💬 AI Answer: "${queryResponse.answer.slice(0, 100)}..."`);
      
      // DEBUG: Log individual source scores to check if they're different
      console.log(`🔍 Individual Source Scores:`);
      queryResponse.sources.forEach((sourceResult, index) => {
        console.log(`  Source ${index}: score=${sourceResult.score}, node_id=${sourceResult.node.id?.slice(0, 8)}`);
      });
      
      // Prepare simplified metadata structure for storage
      const questionTimestamp = new Date().toISOString();
      const responseTimestamp = new Date().toISOString();
      
      const enhancedMetadata = {
        question: request.query,
        question_timestamp: questionTimestamp,
        response: queryResponse.answer,
        response_timestamp: responseTimestamp,
        generation_time_ms: actualGenerationTime,
        overall_confidence: queryResponse.overall_confidence || queryResponse.confidence,
        node_sources: queryResponse.sources.map(sourceResult => ({
          node_id: sourceResult.node.id?.toString() || 'unknown',
          content: sourceResult.node.content?.toString() || 'No content available',
          retrieval_score: sourceResult.score, // Use individual relevance score from search
          context_tokens: Math.ceil((sourceResult.node.content?.toString().length || 0) / 4), // Approximate
          node_type: sourceResult.node.node_type || 'text',
          last_modified: sourceResult.node.last_modified || new Date().toISOString()
        })),
        error: null
      };
      
      // Save metadata using onNodeUpdate if we have node context
      if (request.node_id && request.current_content !== undefined) {
        console.log(`💾 Saving AIChatNode metadata for node ${request.node_id.slice(0, 8)}...`);
        
        // Save directly via Tauri (Core-UI will eventually trigger onNodeUpdate)
        setTimeout(() => {
          invoke('upsert_node', {
            nodeId: request.node_id,
            dateStr: selectedDate.toISOString().split('T')[0],
            content: request.current_content,
            parentId: request.parent_id || null,
            beforeSiblingId: request.before_sibling_id || null,
            nodeType: 'ai-chat',
            metadata: enhancedMetadata
          }).catch(error => {
            console.error('Failed to save AIChatNode metadata:', error);
          });
        }, 0);
      }
      
      // Convert to RAGQueryResponse format expected by Core-UI
      const ragResponse = {
        message_id: `msg_${Date.now()}`,
        content: queryResponse.answer,
        rag_context: {
          sources_used: enhancedMetadata.node_sources,
          retrieval_score: queryResponse.confidence,
          context_tokens: enhancedMetadata.node_sources.reduce((sum, source) => sum + source.context_tokens, 0),
          generation_time_ms: actualGenerationTime,
          knowledge_summary: `Found ${queryResponse.sources.length} relevant knowledge sources`
        }
      };
      
      console.log(`📤 Returning RAG response with enhanced metadata`);
      return ragResponse;
      
    } catch (error) {
      console.error('AI Chat query failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ RAG query processing failed: ${errorMessage}`);
      
      // Save error metadata if we have node context
      if (request.node_id && request.current_content !== undefined) {
        const errorMetadata = {
          question: request.query,
          question_timestamp: new Date().toISOString(),
          response: "I encountered an error processing your question.",
          response_timestamp: new Date().toISOString(),
          generation_time_ms: Date.now() - startTime,
          overall_confidence: 0.0,
          node_sources: [],
          error: errorMessage
        };
        
        // Save error state
        invoke('upsert_node', {
          nodeId: request.node_id,
          dateStr: selectedDate.toISOString().split('T')[0],
          content: request.current_content,
          parentId: request.parent_id || null,
          beforeSiblingId: request.before_sibling_id || null,
          nodeType: 'ai-chat',
          metadata: errorMetadata
        }).catch(console.error);
      }
      
      // Still return error to Core-UI for user feedback
      throw new Error(`RAG processing failed: ${errorMessage}`);
    }
  }, [selectedDate]);

  // Single Callback Integration: Replace all callbacks with unified onNodeUpdate
  // Memoize callbacks to prevent Core-UI ContentPersistenceManager from recreating
  const callbacks: NodeSpaceCallbacks = useMemo(() => {
    const callbacksObj = {
    onNodesChange: (newNodes: BaseNode[]) => {
      setNodes(newNodes);
    },
    
    // SINGLE UNIFIED CALLBACK: Handles all node operations
    onNodeUpdate: (nodeId: string, nodeData: {
      content: string;
      parentId?: string;
      beforeSiblingId?: string;
      nodeType: string;
      metadata?: any;
    }) => {
      console.log(`🔄 onNodeUpdate called:`);
      console.log(`   Node ID: ${nodeId.slice(0, 8)}...`);
      console.log(`   Content: '${nodeData.content}'`);
      console.log(`   Parent ID: ${nodeData.parentId?.slice(0, 8) || 'null'}`);
      console.log(`   Before Sibling: ${nodeData.beforeSiblingId?.slice(0, 8) || 'null'}`);
      console.log(`   Node Type: ${nodeData.nodeType}`);
      console.log(`   Has Metadata: ${!!nodeData.metadata}`);
      
      try {
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        // Use unified upsert command for all node operations
        invoke('upsert_node', {
          nodeId: nodeId,
          dateStr: dateStr,
          content: nodeData.content,
          parentId: nodeData.parentId || null,
          beforeSiblingId: nodeData.beforeSiblingId || null,
          nodeType: nodeData.nodeType,
          metadata: nodeData.metadata || null
        }).catch(error => {
          console.error('Node upsert failed:', error);
        });
        
      } catch (error) {
        console.error('Failed to process node update:', error);
      }
    },
    
    // Keep semantic search for text nodes
    onSemanticSearch: async (question: string, nodeId: string): Promise<string> => {
      console.log(`🔥 ===== onSemanticSearch TRIGGERED =====`);
      console.log(`🔍 Semantic search request: "${question}" from node ${nodeId.slice(0, 8)}...`);
      
      try {
        // Use existing process_query Tauri command which implements RAG pipeline
        const queryResponse = await invoke<{
          answer: string;
          sources: Array<{
            node: any;
            score: number;
            snippet: string;
          }>;
          confidence: number;
        }>('process_query', {
          question: question
        });
        
        console.log(`✅ Semantic search completed with confidence: ${queryResponse.confidence}`);
        console.log(`📚 Found ${queryResponse.sources.length} source(s)`);
        
        // Return the plain text answer - Core-UI handles all formatting
        return queryResponse.answer;
      } catch (error) {
        console.error('Semantic search failed:', error);
        // Throw error - Core-UI will catch and display user-friendly message
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Semantic search failed: ${errorMessage}`);
      }
    },
    
    // Enhanced AIChatQuery with metadata storage
    onAIChatQuery: handleAIChatQuery
  };
  
  // Debug: Log callback registration (uncomment if needed)
  // console.log(`📋 Callbacks registered:`, {
  //   onAIChatQuery: !!callbacksObj.onAIChatQuery,
  //   onSemanticSearch: !!callbacksObj.onSemanticSearch,
  //   onNodeChange: !!callbacksObj.onNodeChange
  // });
  
  return callbacksObj;
  }, [selectedDate, debouncedSaveContent, handleNodeDeletion, handleAIChatQuery]); // Include dependencies that callbacks use

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

  // Convert hierarchical backend data to Core-UI BaseNode tree structure
  const convertToBaseNodes = (hierarchicalData: any): BaseNode[] => {
    if (!hierarchicalData?.children) return [];
    
    const nodeMap = new Map<string, BaseNode>();
    const rootNodes: BaseNode[] = [];
    
    const processNode = (hierarchicalNode: any, parentNode?: BaseNode) => {
      const nodeData = hierarchicalNode.node;
      const content = typeof nodeData.content === 'string' ? nodeData.content : JSON.stringify(nodeData.content);
      
      // Determine node type from the current structure
      const nodeType = nodeData.type || 'text';
      
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
      
      // Store node in map for reference
      nodeMap.set(nodeData.id, node);
      
      // Build parent-child relationships
      if (parentNode) {
        parentNode.addChild(node);
      } else {
        rootNodes.push(node);
      }
      
      // Process children recursively, passing current node as parent
      if (hierarchicalNode.children && hierarchicalNode.children.length > 0) {
        hierarchicalNode.children.forEach((childHierarchicalNode: any) => {
          processNode(childHierarchicalNode, node);
        });
      }
    };
    
    hierarchicalData.children.forEach((child: any) => processNode(child));
    return rootNodes;
  };


  // Simplified date loading using hierarchical API from backend
  const loadNodesForDate = useCallback(async (date: Date) => {
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const hierarchicalData = await invoke<any>('get_nodes_for_date', { 
        dateStr: dateStr 
      });
      
      // Direct mapping from hierarchical backend data to BaseNodes
      const frontendNodes = convertToBaseNodes(hierarchicalData);
      
      // Let Core-UI handle empty state automatically - pass whatever we get
      console.log(`📊 Setting nodes for ${dateStr}:`, frontendNodes.length, 'nodes');
      setNodes(frontendNodes);
    } catch (error) {
      console.error('Failed to load hierarchical data for date:', error);
      // On error, just show empty interface
      setNodes([]);
    }
  }, []);

  // Removed handleVirtualNodeContent - no longer needed with fire-and-forget pattern

  // Load nodes when date changes (remove loadNodesForDate dependency to prevent excessive calls)
  useEffect(() => {
    // ONNX migration is complete - re-enabling date navigation
    loadNodesForDate(selectedDate);
  }, [selectedDate]); // Only depend on selectedDate, not the function

  // Removed debouncedCreateFromVirtual - no longer needed with fire-and-forget pattern

  // Immediate save for structure changes with comprehensive hierarchy details
  const saveStructureChange = useCallback(async (operation: string, nodeId: string, details?: any) => {
    try {
      console.log(`💾 Saving structure change: ${operation} for node ${nodeId.slice(0, 8)}...`);
      
      // Extract hierarchy information from Core-UI details object
      const parentId = details?.newParentId || details?.parentId || null;
      const formerParentId = details?.formerParentId || null;
      const hierarchyLevel = details?.hierarchyLevel || 0;
      const nodeContent = details?.nodeContent || '';
      const nodeType = details?.nodeType || 'text';
      const timestamp = details?.timestamp || new Date().toISOString();
      const beforeSiblingId = details?.beforeSiblingId || null;
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      console.log(`📤 Sending to backend:`);
      console.log(`   Operation: ${operation}`);
      console.log(`   Node ID: ${nodeId.slice(0, 8)}...`);
      console.log(`   New Parent ID: ${parentId?.slice(0, 8) || 'null'}`);
      console.log(`   Former Parent ID: ${formerParentId?.slice(0, 8) || 'null'}`);
      console.log(`   Hierarchy Level: ${hierarchyLevel}`);
      console.log(`   Before Sibling ID: ${beforeSiblingId?.slice(0, 8) || 'null'}`);
      console.log(`   Date: ${dateStr}`);
      
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
      console.log(`✅ Structure change saved successfully`);
      
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

      <div className="editor-container">
        <NodeSpaceEditor
          nodes={nodes}
          callbacks={callbacks}
          focusedNodeId={focusedNodeId}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onRemoveNode={handleRemoveNode}
          collapsibleNodeTypes={new Set(['text', 'task', 'date', 'entity', 'image'])}
        />
      </div>
    </div>
  );
}

export default App;