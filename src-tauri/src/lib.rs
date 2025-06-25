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
use chrono::{Local, NaiveDate};
use nodespace_core_logic::{
    CoreLogic, DateNavigation, DateNode, HierarchicalNode, NavigationResult, ServiceContainer,
};
use nodespace_core_types::{Node, NodeId};
// NOTE: No direct data-store or nlp-engine imports - clean architecture boundary

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

// Application state with real ServiceContainer
pub struct AppState {
    pub service_container: Arc<Mutex<Option<Arc<ServiceContainer>>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            service_container: Arc::new(Mutex::new(None)),
        }
    }
}

// ServiceContainer initialization helper - real integration
async fn initialize_service_container() -> Result<Arc<ServiceContainer>, String> {
    log::info!("Initializing ServiceContainer with database integration");

    // Desktop app determines platform-specific paths
    let database_path = "/Users/malibio/nodespace/nodespace-data-store/data/sample.db";
    let model_path = std::path::PathBuf::from(
        "/Users/malibio/nodespace/nodespace-nlp-engine/models/gemma-3-1b-it-onnx/model.onnx",
    );

    let service_container =
        ServiceContainer::new_with_database_and_model_paths(database_path, model_path)
            .await
            .map_err(|e| format!("Failed to initialize ServiceContainer: {}", e))?;

    log_service_init("Real ServiceContainer");
    log_service_ready("Real ServiceContainer");

    log::info!("ServiceContainer initialized successfully");
    log::debug!("Connected to SurrealDB with sample data");

    Ok(Arc::new(service_container))
}

// Tauri commands for MVP functionality
#[tauri::command]
async fn greet(name: String) -> Result<String, String> {
    Ok(format!(
        "Hello, {}! Welcome to NodeSpace with real AI integration.",
        name
    ))
}

#[tauri::command]
async fn create_knowledge_node(
    content: String,
    metadata: HashMap<String, serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<NodeId, String> {
    log_command(
        "create_knowledge_node",
        &format!("content_len: {}", content.len()),
    );

    if content.trim().is_empty() {
        return Err(AppError::InvalidInput("Content cannot be empty".to_string()).into());
    }

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let service_container = service_guard.as_ref().unwrap();

    // Extract date from metadata or use current date
    let current_date = Local::now().format("%Y-%m-%d").to_string();
    let date = metadata
        .get("date")
        .and_then(|v| v.as_str())
        .unwrap_or(&current_date);

    let node_id = service_container
        .create_text_node(&content, date)
        .await
        .map_err(|e| format!("Failed to create knowledge node: {}", e))?;

    log::debug!("Created knowledge node {}", node_id);
    Ok(node_id)
}

#[tauri::command]
async fn update_node(
    node_id: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command(
        "update_node",
        &format!("node_id: {}, content_len: {}", node_id, content.len()),
    );

    if content.trim().is_empty() {
        return Err(AppError::InvalidInput("Content cannot be empty".to_string()).into());
    }

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let service_container = service_guard.as_ref().unwrap();

    let node_id_obj = NodeId::from_string(node_id.clone());

    service_container
        .update_node(&node_id_obj, &content)
        .await
        .map_err(|e| format!("Failed to update node: {}", e))?;

    log::debug!("Updated node {}", node_id);
    Ok(())
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

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let service_container = service_guard.as_ref().unwrap();

    log::debug!("Processing RAG query: {}", question);

    let query_response = service_container
        .process_query(&question)
        .await
        .map_err(|e| format!("Failed to process query: {}", e))?;

    let search_results = service_container
        .semantic_search(&question, 5)
        .await
        .unwrap_or_default();

    let source_nodes: Vec<Node> = search_results.into_iter().map(|r| r.node).collect();

    // Convert to Tauri response format
    let response = QueryResponse {
        answer: query_response.answer,
        sources: source_nodes,
        confidence: query_response.confidence as f64,
    };

    log::debug!("RAG query processed successfully");
    Ok(response)
}

#[tauri::command]
async fn semantic_search(
    query: String,
    limit: usize,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    log_command(
        "semantic_search",
        &format!("query: {}, limit: {}", query, limit),
    );

    if query.trim().is_empty() {
        return Err(AppError::InvalidInput("Search query cannot be empty".to_string()).into());
    }

    if limit == 0 || limit > 100 {
        return Err(AppError::InvalidInput("Limit must be between 1 and 100".to_string()).into());
    }

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let service_container = service_guard.as_ref().unwrap();

    log::debug!("Performing semantic search: {} (limit: {})", query, limit);

    let search_results = service_container
        .semantic_search(&query, limit)
        .await
        .map_err(|e| format!("Failed to perform semantic search: {}", e))?;

    // Convert to search results
    let results: Vec<SearchResult> = search_results
        .into_iter()
        .map(|search_result| {
            let snippet = if let Some(content_str) = search_result.node.content.as_str() {
                let snippet_len = content_str.len().min(100);
                format!("{}...", &content_str[..snippet_len])
            } else {
                "...".to_string()
            };

            SearchResult {
                node: search_result.node,
                score: search_result.score as f64,
                snippet,
            }
        })
        .collect();

    log::debug!("Semantic search completed, found {} results", results.len());
    Ok(results)
}

// Date navigation Tauri commands

#[tauri::command]
async fn get_nodes_for_date(
    #[allow(non_snake_case)] dateStr: String,
    state: State<'_, AppState>,
) -> Result<Vec<Node>, String> {
    log_command("get_nodes_for_date", &format!("date: {}", dateStr));

    // Parse the date string
    let date = NaiveDate::parse_from_str(&dateStr, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let service_container = service_guard.as_ref().unwrap();

    let nodes = DateNavigation::get_nodes_for_date(&**service_container, date)
        .await
        .map_err(|e| format!("Failed to get nodes for date: {}", e))?;

    log::debug!(
        "Retrieved {} nodes for date {} from database",
        nodes.len(),
        dateStr
    );

    Ok(nodes)
}

#[tauri::command]
async fn get_hierarchical_nodes_for_date(
    #[allow(non_snake_case)] dateStr: String,
    state: State<'_, AppState>,
) -> Result<Vec<HierarchicalNode>, String> {
    log_command(
        "get_hierarchical_nodes_for_date",
        &format!("date: {}", dateStr),
    );

    // Parse the date string
    let date = NaiveDate::parse_from_str(&dateStr, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let service_container = service_guard.as_ref().unwrap();

    let hierarchical_nodes =
        DateNavigation::get_hierarchical_nodes_for_date(&**service_container, date)
            .await
            .map_err(|e| format!("Failed to get hierarchical nodes for date: {}", e))?;

    log::debug!(
        "Retrieved {} hierarchical nodes for date {} from database",
        hierarchical_nodes.len(),
        dateStr
    );

    Ok(hierarchical_nodes)
}

#[tauri::command]
async fn navigate_to_date(
    #[allow(non_snake_case)] dateStr: String,
    state: State<'_, AppState>,
) -> Result<NavigationResult, String> {
    log_command("navigate_to_date", &format!("date: {}", dateStr));

    // Parse the date string
    let date = NaiveDate::parse_from_str(&dateStr, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let service_container = service_guard.as_ref().unwrap();

    let result = service_container
        .navigate_to_date(date)
        .await
        .map_err(|e| format!("Failed to navigate to date: {}", e))?;

    log::debug!(
        "Navigated to date {} - {} nodes",
        dateStr,
        result.nodes.len()
    );
    Ok(result)
}

#[tauri::command]
async fn create_or_get_date_node(
    #[allow(non_snake_case)] dateStr: String,
    state: State<'_, AppState>,
) -> Result<DateNode, String> {
    log_command("create_or_get_date_node", &format!("date: {}", dateStr));

    // Parse the date string
    let date = NaiveDate::parse_from_str(&dateStr, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let service_container = service_guard.as_ref().unwrap();

    let date_node = service_container
        .create_or_get_date_node(date)
        .await
        .map_err(|e| format!("Failed to create or get date node: {}", e))?;

    log::debug!(
        "Created/retrieved date node for {} - {} children",
        dateStr,
        date_node.child_count
    );
    Ok(date_node)
}

// Real-time async saving commands
#[tauri::command]
async fn update_node_content(
    node_id: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command(
        "update_node_content",
        &format!("node_id: {}, content_len: {}", node_id, content.len()),
    );

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let service_container = service_guard.as_ref().unwrap();

    let node_id_obj = NodeId::from_string(node_id.clone());

    service_container
        .update_node(&node_id_obj, &content)
        .await
        .map_err(|e| format!("Failed to auto-save node content: {}", e))?;

    log::debug!("Auto-saved content for node {}", node_id);
    Ok(())
}

#[tauri::command]
async fn update_node_structure(
    operation: String,
    node_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command(
        "update_node_structure",
        &format!("operation: {}, node_id: {}", operation, node_id),
    );

    // Get or initialize the ServiceContainer
    let mut service_guard = state.service_container.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_service_container().await?);
    }
    let _service_container = service_guard.as_ref().unwrap();

    let _node_id_obj = NodeId::from_string(node_id.clone());

    log::debug!("Structure change '{}' for node {}", operation, node_id);

    Ok(())
}

#[tauri::command]
async fn get_today_date() -> Result<String, String> {
    let today = chrono::Utc::now().date_naive();
    Ok(today.format("%Y-%m-%d").to_string())
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
            log_service_init("Application State");
            log_service_ready("Application State");

            log::info!("NodeSpace Desktop initialized successfully");
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                log_shutdown();
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            create_knowledge_node,
            update_node,
            process_query,
            semantic_search,
            get_nodes_for_date,
            get_hierarchical_nodes_for_date,
            navigate_to_date,
            create_or_get_date_node,
            update_node_content,
            update_node_structure,
            get_today_date
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
