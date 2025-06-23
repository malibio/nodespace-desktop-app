mod error;
mod logging;

#[cfg(test)]
mod tests;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::error::AppError;
use crate::logging::*;

// Import real NodeSpace types - clean dependency boundary (no ML imports)
use nodespace_core_types::{Node, NodeId, NodeSpaceResult, NodeSpaceError};

// NS-29 DEMONSTRATION: Clean Dependency Boundary
// This proves the desktop app can work with ZERO ML dependencies
// while maintaining the correct architecture for future integration

use async_trait::async_trait;

/// Local NLP Engine trait definition
/// This will be imported from nodespace_nlp_engine once NS-28 is complete
#[async_trait]
pub trait NLPEngine: Send + Sync {
    async fn generate_embedding(&self, text: &str) -> NodeSpaceResult<Vec<f32>>;
    async fn batch_embeddings(&self, texts: &[String]) -> NodeSpaceResult<Vec<Vec<f32>>>;
    async fn generate_text(&self, prompt: &str) -> NodeSpaceResult<String>;
    async fn generate_surrealql(&self, natural_query: &str, schema_context: &str) -> NodeSpaceResult<String>;
    fn embedding_dimensions(&self) -> usize;
}

/// Mock NLP Engine that demonstrates integration without ML dependencies
/// This shows the desktop app can work with ZERO ML dependencies
#[derive(Clone)]
pub struct MockNLPEngine;

impl MockNLPEngine {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NLPEngine for MockNLPEngine {
    async fn generate_embedding(&self, text: &str) -> NodeSpaceResult<Vec<f32>> {
        log::info!("[MOCK NLP] Generate embedding for text: {} chars (✅ Clean dependency boundary)", text.len());
        // Return a mock embedding vector (768 dimensions is typical for sentence embeddings)
        Ok(vec![0.1; 768])
    }

    async fn batch_embeddings(&self, texts: &[String]) -> NodeSpaceResult<Vec<Vec<f32>>> {
        log::info!("[MOCK NLP] Generate batch embeddings for {} texts (✅ Clean dependency boundary)", texts.len());
        Ok(texts.iter().map(|_| vec![0.1; 768]).collect())
    }

    async fn generate_text(&self, prompt: &str) -> NodeSpaceResult<String> {
        log::info!("[MOCK NLP] Generate text for prompt: {} chars (✅ Clean dependency boundary)", prompt.len());
        Ok(format!("[DEMO AI] This demonstrates the RAG workflow: '{}'... \n\nOnce NS-28 is complete, this will be real Mistral.rs inference with local models.", 
                  prompt.chars().take(50).collect::<String>()))
    }

    async fn generate_surrealql(&self, query: &str, _schema: &str) -> NodeSpaceResult<String> {
        log::info!("[MOCK NLP] Generate SurrealQL for query: {} (✅ Clean dependency boundary)", query);
        Ok(format!("SELECT * FROM nodes WHERE content CONTAINS '{}'", query))
    }

    fn embedding_dimensions(&self) -> usize {
        768 // Standard sentence transformer dimension
    }
}

// Additional response types for Tauri commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResponse {
    pub answer: String,
    pub sources: Vec<Node>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub node: Node,
    pub score: f64,
    pub snippet: String,
}

// Application state for clean dependency demonstration
pub struct AppState {
    pub nodes: Arc<Mutex<HashMap<String, Node>>>,
    pub nlp_engine: Arc<MockNLPEngine>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            nodes: Arc::new(Mutex::new(HashMap::new())),
            nlp_engine: Arc::new(MockNLPEngine::new()),
        }
    }
}

/// NS-29 Demo Service - Standalone service that demonstrates integration pattern
/// This shows exactly how the desktop app will integrate with real services
pub struct DemoNodeSpaceService {
    nodes: Arc<Mutex<HashMap<String, Node>>>,
    nlp_engine: Arc<MockNLPEngine>,
}

impl DemoNodeSpaceService {
    pub fn new() -> Self {
        Self {
            nodes: Arc::new(Mutex::new(HashMap::new())),
            nlp_engine: Arc::new(MockNLPEngine::new()),
        }
    }

    pub async fn create_knowledge_node(&self, content: &str, metadata: serde_json::Value) -> NodeSpaceResult<NodeId> {
        let node_id = NodeId::new();
        let now = chrono::Utc::now().to_rfc3339();
        
        // Demonstrate AI processing without ML dependencies
        let _embedding = self.nlp_engine.generate_embedding(content).await?;
        
        let node = Node {
            id: node_id.clone(),
            content: serde_json::Value::String(content.to_string()),
            metadata: Some(metadata),
            created_at: now.clone(),
            updated_at: now,
        };

        self.nodes.lock().await.insert(node_id.to_string(), node);
        Ok(node_id)
    }

    pub async fn get_node(&self, node_id: &NodeId) -> NodeSpaceResult<Option<Node>> {
        Ok(self.nodes.lock().await.get(&node_id.to_string()).cloned())
    }

    pub async fn update_node(&self, node_id: &NodeId, content: &str) -> NodeSpaceResult<()> {
        let mut nodes = self.nodes.lock().await;
        if let Some(node) = nodes.get_mut(&node_id.to_string()) {
            node.content = serde_json::Value::String(content.to_string());
            node.updated_at = chrono::Utc::now().to_rfc3339();
            
            // Demonstrate embedding reprocessing without ML dependencies
            let _new_embedding = self.nlp_engine.generate_embedding(content).await?;
        }
        Ok(())
    }

    pub async fn process_query(&self, question: &str) -> NodeSpaceResult<QueryResponse> {
        // Demonstrate RAG workflow without ML dependencies
        let search_results = self.semantic_search(question, 5).await?;
        
        let context = search_results.iter()
            .filter_map(|r| r.node.content.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        
        let prompt = format!("Answer based on context: {}\n\nContext: {}", question, context);
        let answer = self.nlp_engine.generate_text(&prompt).await?;
        
        Ok(QueryResponse {
            answer,
            sources: search_results.into_iter().map(|r| r.node).collect(),
            confidence: 0.8,
        })
    }

    pub async fn semantic_search(&self, query: &str, limit: usize) -> NodeSpaceResult<Vec<SearchResult>> {
        // Demonstrate semantic search without ML dependencies
        let _query_embedding = self.nlp_engine.generate_embedding(query).await?;
        
        let nodes = self.nodes.lock().await;
        let results: Vec<SearchResult> = nodes
            .values()
            .filter(|node| {
                if let Some(content) = node.content.as_str() {
                    content.to_lowercase().contains(&query.to_lowercase())
                } else {
                    false
                }
            })
            .take(limit)
            .map(|node| {
                let snippet = if let Some(content) = node.content.as_str() {
                    content.chars().take(100).collect::<String>() + "..."
                } else {
                    "...".to_string()
                };
                
                SearchResult {
                    node: node.clone(),
                    score: 0.8,
                    snippet,
                }
            })
            .collect();
        
        Ok(results)
    }
}

// Tauri commands for MVP functionality
#[tauri::command]
async fn greet(name: String) -> Result<String, String> {
    Ok(format!("Hello, {}! Welcome to NodeSpace.", name))
}

#[tauri::command]
async fn create_knowledge_node(
    content: String,
    metadata: HashMap<String, serde_json::Value>,
    _state: State<'_, AppState>,
) -> Result<NodeId, String> {
    log_command("create_knowledge_node", &format!("content_len: {}", content.len()));
    
    if content.trim().is_empty() {
        return Err(AppError::InvalidInput("Content cannot be empty".to_string()).into());
    }
    
    // NS-29 DEMO: Clean dependency boundary - zero ML dependencies
    let service = DemoNodeSpaceService::new();
    
    let metadata_json = serde_json::Value::Object(
        metadata.into_iter().collect()
    );
    
    let node_id = service.create_knowledge_node(&content, metadata_json)
        .await
        .map_err(|e| format!("Failed to create knowledge node: {}", e))?;

    log::info!("✅ NS-29: Created knowledge node {} with ZERO ML dependencies in desktop app", node_id);
    Ok(node_id)
}

#[tauri::command]
async fn update_node(
    node_id: String,
    content: String,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    log_command("update_node", &format!("node_id: {}, content_len: {}", node_id, content.len()));
    
    if content.trim().is_empty() {
        return Err(AppError::InvalidInput("Content cannot be empty".to_string()).into());
    }
    
    // NS-29 DEMO: Clean dependency boundary
    let service = DemoNodeSpaceService::new();
    let node_id_obj = NodeId::from_string(node_id.clone());
    service.update_node(&node_id_obj, &content)
        .await
        .map_err(|e| format!("Failed to update node: {}", e))?;

    log::info!("✅ NS-29: Updated node {} with ZERO ML dependencies in desktop app", node_id);
    Ok(())
}

#[tauri::command]
async fn get_node(
    node_id: String,
    _state: State<'_, AppState>,
) -> Result<Option<Node>, String> {
    log_command("get_node", &format!("node_id: {}", node_id));
    
    // NS-29 DEMO: Clean dependency boundary
    let service = DemoNodeSpaceService::new();
    let node_id_obj = NodeId::from_string(node_id.clone());
    let result = service.get_node(&node_id_obj)
        .await
        .map_err(|e| format!("Failed to get node: {}", e))?;
    
    if result.is_some() {
        log::info!("✅ NS-29: Retrieved node {} with ZERO ML dependencies", node_id);
    } else {
        log::warn!("Node not found: {} (clean architecture)", node_id);
    }
    
    Ok(result)
}

#[tauri::command]
async fn process_query(
    question: String,
    _state: State<'_, AppState>,
) -> Result<QueryResponse, String> {
    log_command("process_query", &format!("question: {}", question));
    
    if question.trim().is_empty() {
        return Err(AppError::InvalidInput("Question cannot be empty".to_string()).into());
    }
    
    // NS-29 DEMO: RAG workflow with ZERO ML dependencies
    let service = DemoNodeSpaceService::new();
    
    log::info!("✅ NS-29: Processing RAG query with clean architecture: {}", question);
    
    let response = service.process_query(&question)
        .await
        .map_err(|e| format!("Failed to process query: {}", e))?;
    
    log::info!("✅ NS-29: Query processed successfully with ZERO ML dependencies in desktop app");
    Ok(response)
}

#[tauri::command]
async fn semantic_search(
    query: String,
    limit: usize,
    _state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    log_command("semantic_search", &format!("query: {}, limit: {}", query, limit));
    
    if query.trim().is_empty() {
        return Err(AppError::InvalidInput("Search query cannot be empty".to_string()).into());
    }
    
    if limit == 0 || limit > 100 {
        return Err(AppError::InvalidInput("Limit must be between 1 and 100".to_string()).into());
    }
    
    // NS-29 DEMO: Semantic search with clean architecture
    let service = DemoNodeSpaceService::new();
    
    log::info!("✅ NS-29: Performing semantic search with ZERO ML dependencies: {} (limit: {})", query, limit);
    
    let results = service.semantic_search(&query, limit)
        .await
        .map_err(|e| format!("Failed to perform semantic search: {}", e))?;
    
    log::info!("✅ NS-29: Search completed, found {} results with clean architecture", results.len());
    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize custom logging first
    if let Err(e) = init_logging() {
        eprintln!("Failed to initialize logging: {}", e);
    }
    
    log_startup();
    
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|_app| {
            // Skip Tauri plugin logging since we already initialized fern logging
            
            log_service_init("Application State");
            log_service_ready("Application State");
            
            log::info!("NodeSpace Desktop Application initialized successfully");
            Ok(())
        })
        .on_window_event(|_window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    log_shutdown();
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            create_knowledge_node,
            update_node,
            get_node,
            process_query,
            semantic_search
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

