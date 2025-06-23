import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DateNavigationBar } from "./components/DateNavigationBar";
import NodeSpaceEditor, { BaseNode, TextNode, DateNode, NodeSpaceCallbacks } from "nodespace-core-ui";
import "nodespace-core-ui/dist/nodeSpace.css";
import "./App.css";

function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [nodes, setNodes] = useState<BaseNode[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Load today's content on app launch
  useEffect(() => {
    handleDateChange(new Date());
  }, [handleDateChange]);

  const handleDateChange = useCallback(async (date: Date) => {
    setSelectedDate(date);
    
    try {
      // Load nodes for the selected date from core-logic
      const dateStr = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      const result = await invoke("navigate_to_date", { dateStr });
      
      console.log("Navigation result:", result);
      
      // Convert the result nodes to UI nodes
      if (result && result.nodes) {
        const dateNode = new DateNode(date, 'full');
        
        // Add child nodes from the database
        result.nodes.forEach((dbNode: any) => {
          if (dbNode.content && typeof dbNode.content === 'string') {
            const textNode = new TextNode(dbNode.content);
            dateNode.addChild(textNode);
          }
        });
        
        setNodes([dateNode]);
      } else {
        // Create empty date node if no content exists
        const dateNode = new DateNode(date, 'full');
        const textNode = new TextNode("Start writing your thoughts for today...");
        dateNode.addChild(textNode);
        setNodes([dateNode]);
      }
    } catch (error) {
      console.error("Failed to load nodes for date:", error);
      // Fallback to demo content
      const dateNode = new DateNode(date, 'full');
      const textNode = new TextNode("Start writing your thoughts for today...");
      dateNode.addChild(textNode);
      setNodes([dateNode]);
    }
  }, []);

  const handleNodesChange = useCallback(async (newNodes: BaseNode[]) => {
    setNodes(newNodes);
    
    // Persist changes through core-logic to data-store
    try {
      for (const node of newNodes) {
        if (node.getNodeType() === 'text') {
          const textNode = node as TextNode;
          const content = textNode.getContent();
          
          // Only persist non-empty content
          if (content && content.trim() !== "Start writing your thoughts for today...") {
            await invoke("create_knowledge_node", {
              content: content,
              metadata: {
                date: selectedDate.toISOString().split('T')[0],
                node_type: "text",
                parent_date: selectedDate.toISOString().split('T')[0]
              }
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to persist node changes:", error);
    }
  }, [selectedDate]);

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
    onNodesChange: handleNodesChange,
    onSlashCommand: (type: string, currentNode: BaseNode) => {
      console.log("Slash command:", type, currentNode);
      // TODO: Handle slash commands (create new nodes, AI chat, etc.)
    },
    onEnterKey: (currentNode: BaseNode) => {
      console.log("Enter key pressed:", currentNode);
      // TODO: Handle enter key (create new sibling node)
    }
  };

  return (
    <div className="container">
      <DateNavigationBar 
        selectedDate={selectedDate} 
        onDateChange={handleDateChange} 
      />
      
      <div className="editor-header">
        <h1>NodeSpace Journal</h1>
        <p>Currently viewing: {selectedDate.toDateString()}</p>
      </div>
      
      <div className="editor-container">
        <NodeSpaceEditor
          nodes={nodes}
          focusedNodeId={focusedNodeId}
          callbacks={callbacks}
          onFocus={setFocusedNodeId}
          onBlur={() => setFocusedNodeId(null)}
          collapsedNodes={collapsedNodes}
          onCollapseChange={handleCollapseChange}
          className="journal-editor"
        />
      </div>
    </div>
  );
}

export default App;