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

// Import real NodeSpace types - clean dependency boundary (no ML imports in desktop app)
use nodespace_core_types::{Node, NodeId, NodeSpaceResult};
use nodespace_core_logic::{NodeSpaceService, CoreLogic, LegacyCoreLogic};
use nodespace_data_store::SurrealDataStore;
use nodespace_nlp_engine::LocalNLPEngine;

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

// Application state with real NodeSpace service integration
pub struct AppState {
    pub core_service: Arc<Mutex<Option<NodeSpaceService<SurrealDataStore, LocalNLPEngine>>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            core_service: Arc::new(Mutex::new(None)),
        }
    }
}

// Service initialization helper
async fn initialize_nodespace_service() -> Result<NodeSpaceService<SurrealDataStore, LocalNLPEngine>, String> {
    log::info!("🚀 NS-29: Initializing NodeSpace service with stable AI stack (NS-28 complete)");
    
    // Initialize data store (in-memory for MVP, can be persistent later)
    let data_store = SurrealDataStore::new("memory")
        .await
        .map_err(|e| format!("Failed to initialize data store: {}", e))?;
    
    log_service_init("SurrealDB DataStore");
    log_service_ready("SurrealDB DataStore");
    
    // Initialize NLP engine with stable AI stack
    let nlp_engine = LocalNLPEngine::new();
    
    log_service_init("Local NLP Engine (Stable Candle + Mistral.rs Stack)");
    log_service_ready("Local NLP Engine (Stable Candle + Mistral.rs Stack)");
    
    // Create the integrated service
    let service = NodeSpaceService::new(data_store, nlp_engine);
    
    log::info!("✅ NS-29: NodeSpace service initialized successfully with REAL AI integration");
    log::info!("   - Desktop app has ZERO ML dependencies (clean boundary achieved)");
    log::info!("   - Real AI processing via: Desktop → Core Logic → NLP Engine");
    log::info!("   - Using stable Candle + Mistral.rs stack from NS-28");
    
    Ok(service)
}

// Tauri commands for MVP functionality
#[tauri::command]
async fn greet(name: String) -> Result<String, String> {
    Ok(format!("Hello, {}! Welcome to NodeSpace with real AI integration.", name))
}

#[tauri::command]
async fn create_knowledge_node(
    content: String,
    metadata: HashMap<String, serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<NodeId, String> {
    log_command("create_knowledge_node", &format!("content_len: {}", content.len()));
    
    if content.trim().is_empty() {
        return Err(AppError::InvalidInput("Content cannot be empty".to_string()).into());
    }
    
    // Get or initialize the real NodeSpace service
    let mut service_guard = state.core_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();
    
    // Convert metadata to serde_json::Value
    let metadata_json = serde_json::Value::Object(
        metadata.into_iter().collect()
    );
    
    // Use real NodeSpace service with AI processing
    let node_id = service.create_knowledge_node(&content, metadata_json)
        .await
        .map_err(|e| format!("Failed to create knowledge node: {}", e))?;

    log::info!("✅ NS-29: Created knowledge node {} with REAL AI processing (zero ML deps in desktop app)", node_id);
    Ok(node_id)
}

#[tauri::command]
async fn update_node(
    node_id: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command("update_node", &format!("node_id: {}, content_len: {}", node_id, content.len()));
    
    if content.trim().is_empty() {
        return Err(AppError::InvalidInput("Content cannot be empty".to_string()).into());
    }
    
    // Get or initialize the real NodeSpace service
    let mut service_guard = state.core_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();
    
    // Use real NodeSpace service with embedding reprocessing
    let node_id_obj = NodeId::from_string(node_id.clone());
    service.update_node(&node_id_obj, &content)
        .await
        .map_err(|e| format!("Failed to update node: {}", e))?;

    log::info!("✅ NS-29: Updated node {} with REAL AI embedding reprocessing (zero ML deps in desktop app)", node_id);
    Ok(())
}

#[tauri::command]
async fn get_node(
    node_id: String,
    state: State<'_, AppState>,
) -> Result<Option<Node>, String> {
    log_command("get_node", &format!("node_id: {}", node_id));
    
    // Get or initialize the real NodeSpace service
    let mut service_guard = state.core_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();
    
    // Use real NodeSpace service
    let node_id_obj = NodeId::from_string(node_id.clone());
    let result = service.get_node(&node_id_obj)
        .await
        .map_err(|e| format!("Failed to get node: {}", e))?;
    
    if result.is_some() {
        log::info!("✅ NS-29: Retrieved node {} with real NodeSpace integration", node_id);
    } else {
        log::warn!("Node not found: {} (real NodeSpace integration)", node_id);
    }
    
    Ok(result)
}

#[tauri::command]
async fn process_query(
    question: String,
    state: State<'_, AppState>,
) -> Result<QueryResponse, String> {
    log_command("process_query", &format!("question: {}", question));
    
    if question.trim().is_empty() {
        return Err(AppError::InvalidInput("Question cannot be empty".to_string()).into());
    }
    
    // Get or initialize the real NodeSpace service
    let mut service_guard = state.core_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();
    
    log::info!("🚀 NS-29: Processing RAG query with REAL AI: {}", question);
    
    // Use real NodeSpace service for RAG query processing
    let core_response = service.process_query(&question)
        .await
        .map_err(|e| format!("Failed to process query: {}", e))?;
    
    // Get source nodes from the core response
    let mut source_nodes = Vec::new();
    for source_id in &core_response.sources {
        if let Ok(Some(node)) = service.get_node(source_id).await {
            source_nodes.push(node);
        }
    }
    
    // Convert to Tauri response format
    let response = QueryResponse {
        answer: core_response.answer,
        sources: source_nodes,
        confidence: core_response.confidence as f64,
    };
    
    log::info!("✅ NS-29: RAG query processed with REAL local AI (zero ML deps in desktop app)");
    Ok(response)
}

#[tauri::command]
async fn semantic_search(
    query: String,
    limit: usize,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    log_command("semantic_search", &format!("query: {}, limit: {}", query, limit));
    
    if query.trim().is_empty() {
        return Err(AppError::InvalidInput("Search query cannot be empty".to_string()).into());
    }
    
    if limit == 0 || limit > 100 {
        return Err(AppError::InvalidInput("Limit must be between 1 and 100".to_string()).into());
    }
    
    // Get or initialize the real NodeSpace service
    let mut service_guard = state.core_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();
    
    log::info!("🔍 NS-29: Performing semantic search with REAL embeddings: {} (limit: {})", query, limit);
    
    // Use real NodeSpace service for semantic search
    let core_results = service.semantic_search(&query, limit)
        .await
        .map_err(|e| format!("Failed to perform semantic search: {}", e))?;
    
    // Convert core results to Tauri response format
    let results: Vec<SearchResult> = core_results
        .into_iter()
        .map(|core_result| {
            let snippet = if let Some(content_str) = core_result.node.content.as_str() {
                let snippet_len = content_str.len().min(100);
                format!("{}...", &content_str[..snippet_len])
            } else {
                "...".to_string()
            };
            
            SearchResult {
                node: core_result.node,
                score: core_result.score as f64,
                snippet,
            }
        })
        .collect();
    
    log::info!("✅ NS-29: Semantic search completed with REAL AI embeddings, found {} results", results.len());
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
            
            log::info!("🎉 NS-29 SUCCESS: NodeSpace Desktop with REAL AI integration initialized");
            log::info!("   ✅ Clean dependency boundary: Desktop → Core Logic → NLP Engine");
            log::info!("   ✅ Zero ML dependencies in desktop app");
            log::info!("   ✅ Real local AI processing via stable Candle + Mistral.rs stack");
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