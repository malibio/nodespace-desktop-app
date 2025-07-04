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

// Import real NodeSpace types - clean dependency boundary with proper dependency injection
use chrono::NaiveDate;
use nodespace_core_logic::{CoreLogic, HierarchyComputation, NodeSpaceService};
use nodespace_core_types::{Node, NodeId};
use nodespace_data_store::{LanceDataStore, NodeType};
use nodespace_nlp_engine::LocalNLPEngine;

// NodeSpaceService integration with dependency injection pattern

// Additional response types for Tauri commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResponse {
    pub answer: String,
    pub sources: Vec<SearchResult>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub node: Node,
    pub score: f64,
    pub snippet: String,
}

// ADR-015: Image processing response structure for Core-UI integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageData {
    pub file_path: String,
    pub metadata: ImageMetadata,
    pub embeddings: Vec<f32>,
    pub blob_url: String,
    pub dimensions: (u32, u32),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageMetadata {
    pub filename: String,
    pub mime_type: String,
    pub file_size: u64,
    pub width: u32,
    pub height: u32,
    pub exif_data: Option<serde_json::Value>,
    pub ai_description: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultimodalSearchConfig {
    pub semantic_weight: f32,
    pub include_images: bool,
    pub max_results: usize,
    pub min_similarity_threshold: f32,
}

// NodeSpaceService integration with dependency injection

// Type alias for complex NodeSpaceService type
type NodeSpaceServiceType =
    Arc<Mutex<Option<Arc<NodeSpaceService<LanceDataStore, LocalNLPEngine>>>>>;

// Application state with NodeSpaceService
pub struct AppState {
    pub nodespace_service: NodeSpaceServiceType,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            nodespace_service: Arc::new(Mutex::new(None)),
        }
    }
}

// NodeSpaceService initialization helper with dependency injection
async fn initialize_nodespace_service(
) -> Result<Arc<NodeSpaceService<LanceDataStore, LocalNLPEngine>>, String> {
    log::info!("🚀 Initializing NodeSpaceService with dependency injection");

    // Database and model paths
    let db_path = "/Users/malibio/nodespace/data/lance_db";
    let models_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent() // /Users/malibio/nodespace/nodespace-desktop-app
        .unwrap()
        .parent() // /Users/malibio/nodespace
        .unwrap()
        .join("models");

    log::info!("🔍 Initializing service with database: {}", db_path);
    log::info!(
        "🔍 Initializing service with models: {}",
        models_dir.display()
    );

    // Use non-blocking factory method that properly wires NLP engine to data store for embedding generation
    let models_dir_str = models_dir.to_str()
        .ok_or_else(|| "Invalid models directory path".to_string())?;
    let service = NodeSpaceService::create_with_background_init(db_path, Some(models_dir_str))
        .await
        .map_err(|e| format!("Failed to initialize NodeSpaceService: {}", e))?;

    // Service is created immediately, initialization happens in background
    log::info!("🚀 NodeSpaceService created with background initialization");

    log_service_init("NodeSpaceService");
    log_service_ready("NodeSpaceService");

    log::info!("✅ NodeSpaceService initialized successfully");
    log::info!("   - Connected to LanceDB with data persistence");
    log::info!("   - Architecture: Desktop → NodeSpaceService → DataStore + NLPEngine");
    log::info!("   - Real AI integration and database persistence active");
    log::info!("   - Background initialization: GPU models loading in parallel");

    Ok(service)
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

    // Get or initialize the NodeSpaceService
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    // Convert metadata for service call
    let metadata_value = serde_json::Value::Object(metadata.into_iter().collect());
    let node_id = service
        .create_knowledge_node(&content, metadata_value)
        .await
        .map_err(|e| {
            // Handle case where service is initializing in background
            if e.to_string().contains("Service not ready: Initializing") {
                "Service is initializing in background. Please try again in a moment.".to_string()
            } else {
                format!("Failed to create knowledge node: {}", e)
            }
        })?;

    log::info!(
        "✅ Created knowledge node {} with NodeSpaceService and database persistence",
        node_id
    );
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
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    // Use real ServiceContainer to update node in place
    let node_id_obj = NodeId::from_string(node_id.clone());

    service
        .update_node(&node_id_obj, &content)
        .await
        .map_err(|e| format!("Failed to update node: {}", e))?;

    log::info!(
        "✅ Updated node {} with real ServiceContainer and database persistence",
        node_id
    );
    Ok(())
}

// TODO: Enable once core-logic ServiceContainer has get_node method available

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
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    log::info!(
        "🚀 Processing RAG query with real AI and database: {}",
        question
    );

    // Use real ServiceContainer for RAG query processing with auto-retry
    let query_response = match service.process_query(&question).await {
        Ok(response) => response,
        Err(e) if e.to_string().contains("Service not ready: Initializing") => {
            // Auto-retry once after 2 seconds for better UX
            log::info!("AI services still initializing, auto-retrying in 2 seconds...");
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            
            service.process_query(&question).await.map_err(|retry_e| {
                if retry_e.to_string().contains("Service not ready: Initializing") {
                    "AI services are still initializing. Please try again in a moment.".to_string()
                } else {
                    format!("Failed to process query: {}", retry_e)
                }
            })?
        }
        Err(e) => return Err(format!("Failed to process query: {}", e)),
    };

    // Search for related nodes as sources using real database
    let search_results = service
        .semantic_search(&question, 5)
        .await
        .unwrap_or_default();

    // Convert to SearchResult format preserving individual relevance scores
    let source_results: Vec<SearchResult> = search_results.into_iter().map(|search_result| {
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
    }).collect();

    // Convert to Tauri response format - keeping individual scores
    let response = QueryResponse {
        answer: query_response.answer,
        sources: source_results,
        confidence: query_response.confidence as f64,
    };

    log::info!("✅ RAG query processed with real AI and database persistence");
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
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    log::info!(
        "🔍 Performing semantic search with real embeddings and database: {} (limit: {})",
        query,
        limit
    );

    // Use real ServiceContainer for semantic search with auto-retry
    let search_results = match service.semantic_search(&query, limit).await {
        Ok(results) => results,
        Err(e) if e.to_string().contains("Service not ready: Initializing") => {
            // Auto-retry once after 2 seconds for better UX
            log::info!("AI search services still initializing, auto-retrying in 2 seconds...");
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            
            service.semantic_search(&query, limit).await.map_err(|retry_e| {
                if retry_e.to_string().contains("Service not ready: Initializing") {
                    "AI search services are still initializing. Please try again in a moment.".to_string()
                } else {
                    format!("Failed to perform semantic search: {}", retry_e)
                }
            })?
        }
        Err(e) => return Err(format!("Failed to perform semantic search: {}", e)),
    };

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

    log::info!(
        "✅ Semantic search completed with real AI embeddings and database, found {} results",
        results.len()
    );
    Ok(results)
}

// Date navigation Tauri commands

#[tauri::command]
async fn get_nodes_for_date(
    date_str: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    log_command("get_nodes_for_date", &format!("date: {}", date_str));


    // Parse the date string
    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Get or initialize the NodeSpaceService
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    // Use hierarchical API with fallback to flat nodes
    match service.get_hierarchical_nodes_for_date(date).await {
        Ok(hierarchical_data) => {
            log::info!(
                "✅ Retrieved hierarchical data for date {} with {} children",
                date_str,
                hierarchical_data.children.len()
            );

            serde_json::to_value(hierarchical_data)
                .map_err(|e| format!("Failed to serialize hierarchical data: {}", e))
        }
        Err(e) => {
            log::warn!(
                "⚠️ Hierarchical API failed for date {}, falling back to flat nodes: {}",
                date_str,
                e
            );

            let nodes = service
                .get_nodes_for_date(date)
                .await
                .map_err(|e| format!("Failed to get nodes for date (fallback): {}", e))?;

            log::info!(
                "✅ Fallback retrieved {} flat nodes for date {}",
                nodes.len(),
                date_str
            );

            serde_json::to_value(nodes)
                .map_err(|e| format!("Failed to serialize fallback nodes: {}", e))
        }
    }
}

// Removed navigate_to_date - using get_nodes_for_date instead for date navigation

// Removed create_or_get_date_node - use get_nodes_for_date and navigate_to_date instead

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
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    // Auto-save content changes to database
    let node_id_obj = NodeId::from_string(node_id.clone());

    service
        .update_node(&node_id_obj, &content)
        .await
        .map_err(|e| format!("Failed to auto-save node content: {}", e))?;

    log::info!("✅ Auto-saved content for node {} to database", node_id);
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn update_node_structure(
    operation: String,
    node_id: String,
    parent_id: Option<String>,
    former_parent_id: Option<String>,
    hierarchy_level: u32,
    node_content: String,
    node_type: String,
    timestamp: String,
    date_str: String,
    before_sibling_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command(
        "update_node_structure",
        &format!(
            "operation: {}, node_id: {}, parent_id: {:?}, former_parent_id: {:?}, hierarchy_level: {}, content: '{}', type: {}, timestamp: {}, date_str: {}, before_sibling_id: {:?}",
            operation,
            node_id,
            parent_id,
            former_parent_id,
            hierarchy_level,
            node_content.chars().take(30).collect::<String>(),
            node_type,
            timestamp,
            date_str,
            before_sibling_id
        ),
    );

    // Get or initialize the ServiceContainer
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let _service = service_guard.as_ref().unwrap();

    // Immediately save structure changes (parent/child relationships)
    let node_id_obj = NodeId::from_string(node_id.clone());

    log::info!(
        "🔄 Structure change '{}' for node {} - parent_id: {:?}, before_sibling_id: {:?}",
        operation,
        node_id,
        parent_id,
        before_sibling_id
    );

    // Convert before_sibling_id to NodeId if provided
    let before_sibling_node_id = before_sibling_id
        .as_ref()
        .map(|id| NodeId::from_string(id.clone()));

    // Implement specific relationship updates based on operation type
    match operation.as_str() {
        "indent" => {
            // Convert parent_id string to NodeId if provided
            let parent_node_id = parent_id.as_ref().map(|id| NodeId::from_string(id.clone()));

            // Set the new parent relationship
            _service
                .set_node_parent(&node_id_obj, parent_node_id.as_ref())
                .await
                .map_err(|e| format!("Failed to indent node: {}", e))?;

            // Update sibling positioning if before_sibling_id is provided
            if before_sibling_node_id.is_some() {
                _service
                    .update_sibling_order(&node_id_obj, None, before_sibling_node_id.as_ref())
                    .await
                    .map_err(|e| {
                        format!("Failed to update sibling order for indent operation: {}", e)
                    })?;
            }

            log::info!(
                "✅ Successfully indented node {} under parent {:?}, before sibling {:?}",
                node_id,
                parent_id,
                before_sibling_id
            );
        }
        "outdent" => {
            // Remove parent relationship (move to root level under date node)
            _service
                .set_node_parent(&node_id_obj, None)
                .await
                .map_err(|e| format!("Failed to outdent node: {}", e))?;

            log::info!("✅ Successfully outdented node {} to root level", node_id);
        }
        "move" | "reorder" | "position" => {
            // Handle sibling positioning and parent changes
            let parent_node_id = parent_id.as_ref().map(|id| NodeId::from_string(id.clone()));

            // Update parent relationship
            _service
                .set_node_parent(&node_id_obj, parent_node_id.as_ref())
                .await
                .map_err(|e| format!("Failed to update parent for move operation: {}", e))?;

            // Update sibling positioning if before_sibling_id is provided
            if before_sibling_node_id.is_some() {
                _service
                    .update_sibling_order(&node_id_obj, None, before_sibling_node_id.as_ref())
                    .await
                    .map_err(|e| {
                        format!("Failed to update sibling order for move operation: {}", e)
                    })?;
            }

            log::info!(
                "✅ Successfully moved node {} to parent {:?}, before sibling {:?}",
                node_id,
                parent_id,
                before_sibling_id
            );
        }
        "create_child" | "add_child" => {
            // Handle child creation structure changes (if Core-UI sends these)
            let parent_node_id = parent_id.as_ref().map(|id| NodeId::from_string(id.clone()));

            _service
                .set_node_parent(&node_id_obj, parent_node_id.as_ref())
                .await
                .map_err(|e| format!("Failed to set parent for child creation: {}", e))?;

            // Update sibling positioning if before_sibling_id is provided
            if before_sibling_node_id.is_some() {
                _service
                    .update_sibling_order(&node_id_obj, None, before_sibling_node_id.as_ref())
                    .await
                    .map_err(|e| {
                        format!("Failed to update sibling order for child creation: {}", e)
                    })?;
            }

            log::info!(
                "✅ Successfully set parent for child creation: node {} under parent {:?}, before sibling {:?}",
                node_id,
                parent_id,
                before_sibling_id
            );
        }
        _ => {
            log::warn!(
                "🔄 Unhandled structure operation: '{}' for node {}",
                operation,
                node_id
            );
            log::warn!("   Available operations: indent, outdent, move, reorder, position, create_child, add_child");
            log::warn!("   If this is a valid operation, please add it to the match statement");

            // Still try to handle basic parent relationship update as fallback
            if let Some(parent_id) = parent_id.as_ref() {
                let parent_node_id = NodeId::from_string(parent_id.clone());
                match _service
                    .set_node_parent(&node_id_obj, Some(&parent_node_id))
                    .await
                {
                    Ok(_) => {
                        log::info!("✅ Fallback: Updated parent relationship for unknown operation")
                    }
                    Err(e) => log::error!("❌ Fallback failed: {}", e),
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn delete_node(
    node_id: String,
    deletion_context: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command(
        "delete_node",
        &format!("node_id: {}, context: {}", node_id, deletion_context),
    );

    // Get or initialize the ServiceContainer
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    let node_id_obj = NodeId::from_string(node_id.clone());

    log::info!(
        "🗑️ Deleting node {} with context: {}",
        node_id,
        deletion_context
    );

    // Parse deletion context from Core-UI
    let children_ids: Vec<NodeId> = deletion_context
        .get("childrenIds")
        .and_then(|v| v.as_array())
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str())
        .map(|s| NodeId::from_string(s.to_string()))
        .collect();

    let children_transferred_to = deletion_context
        .get("childrenTransferredTo")
        .and_then(|v| v.as_str())
        .map(|s| NodeId::from_string(s.to_string()));

    // Call the lean deletion method from core-logic
    service
        .delete_node_with_children_transfer(
            &node_id_obj,
            children_ids,
            children_transferred_to.as_ref(),
        )
        .await
        .map_err(|e| format!("Failed to delete node: {}", e))?;

    log::info!("✅ Successfully deleted node {}", node_id);
    Ok(())
}

#[tauri::command]
async fn create_node_for_date(
    date_str: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<NodeId, String> {
    log_command(
        "create_node_for_date",
        &format!("date: {}, content_len: {}", date_str, content.len()),
    );

    // Allow empty content for new node creation (user will fill it in later)
    // This enables creating nodes via Enter key that start empty

    // Parse the date string
    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Get or initialize the NodeSpaceService
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    log::info!(
        "🚀 Creating node for date {} using core-logic date-aware API with content: {}",
        date_str,
        content.chars().take(50).collect::<String>()
    );

    // Use proper date-aware creation from core-logic
    let node_id = service
        .create_node_for_date(date, &content, NodeType::Text, None)
        .await
        .map_err(|e| format!("Failed to create node for date: {}", e))?;

    log::info!(
        "✅ Created node {} for date {} with proper date context and hierarchical structure",
        node_id,
        date_str
    );
    Ok(node_id)
}

// Fire-and-forget node creation with provided UUID from core-ui (NS-124 integration)
#[tauri::command]
async fn create_node_for_date_with_id(
    node_id: String,
    date_str: String,
    content: String,
    parent_id: Option<String>,
    node_type: Option<String>,
    before_sibling_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command(
        "create_node_for_date_with_id",
        &format!(
            "node_id: {}, date: {}, content_len: {}, parent_id: {:?}, node_type: {:?}, before_sibling_id: {:?}",
            node_id,
            date_str,
            content.len(),
            parent_id,
            node_type,
            before_sibling_id
        ),
    );


    // Parse the date string
    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Convert string to NodeId
    let node_id_obj = NodeId::from_string(node_id.clone());

    // Get or initialize the NodeSpaceService
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    log::info!(
        "🚀 Creating node with provided UUID {} for date {} with content: {}",
        node_id,
        date_str,
        content.chars().take(50).collect::<String>()
    );

    // Convert parent_id string to NodeId if provided
    let parent_node_id = parent_id.map(NodeId::from_string);

    // Convert node_type string to NodeType enum (using data-store variants)
    let node_type_enum = match node_type.as_deref() {
        Some("task") => NodeType::Task,
        Some("image") => NodeType::Image,
        Some("date") => NodeType::Date,
        _ => NodeType::Text, // Default to Text (only 4 variants available)
    };

    // Convert before_sibling_id string to NodeId if provided
    let before_sibling_node_id = before_sibling_id.map(NodeId::from_string);

    // Use enhanced core-logic API with hierarchy support
    let result = service
        .create_node_for_date_with_id(
            node_id_obj,            // node_id
            date,                   // date
            &content,               // content
            node_type_enum,         // node_type
            None,                   // metadata (not used for text/date nodes)
            parent_node_id,         // parent_id
            before_sibling_node_id, // before_sibling_id
        )
        .await;

    match result {
        Ok(_) => {
            log::info!(
                "✅ Created node with provided UUID {} for date {} using fire-and-forget pattern",
                node_id,
                date_str
            );
            Ok(())
        }
        Err(e) => {
            log::error!(
                "❌ Failed to create node with provided ID: {}",
                e
            );
            Err(format!("Failed to create node with provided ID: {}", e))
        }
    }
}

#[tauri::command]
async fn get_today_date() -> Result<String, String> {
    let today = chrono::Utc::now().date_naive();
    Ok(today.format("%Y-%m-%d").to_string())
}

// Unified node management command for single callback architecture
#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn upsert_node(
    node_id: String,
    date_str: String,
    content: String,
    parent_id: Option<String>,
    before_sibling_id: Option<String>,
    node_type: String,
    metadata: Option<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command(
        "upsert_node",
        &format!(
            "id: {}, date: {}, content_len: {}, parent: {:?}, before_sibling: {:?}, type: {}, has_metadata: {}",
            &node_id[0..8.min(node_id.len())],
            date_str,
            content.len(),
            parent_id.as_ref().map(|id| &id[0..8.min(id.len())]),
            before_sibling_id.as_ref().map(|id| &id[0..8.min(id.len())]),
            node_type,
            metadata.is_some()
        ),
    );

    log::info!("🔄 UNIFIED UPSERT: Processing node operation");
    log::info!("   📝 Node ID: {}", node_id);
    log::info!("   📅 Date: {}", date_str);
    log::info!(
        "   📄 Content: '{}'",
        content.chars().take(50).collect::<String>()
    );
    log::info!("   🏷️ Type: {}", node_type);
    log::info!("   👨‍👩‍👧‍👦 Parent: {:?}", parent_id);
    log::info!("   🔗 Before Sibling: {:?}", before_sibling_id);
    log::info!(
        "   📊 Metadata: {}",
        if metadata.is_some() {
            "present"
        } else {
            "none"
        }
    );

    // Parse the date string
    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Convert string to NodeId
    let node_id_obj = NodeId::from_string(node_id.clone());

    // Get or initialize the NodeSpaceService
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    // Convert node_type string to NodeType enum
    let node_type_enum = match node_type.as_str() {
        "task" => NodeType::Task,
        "image" => NodeType::Image,
        "date" => NodeType::Date,
        "ai-chat" => NodeType::Text, // Use Text type for now until NodeType::AIChat is available
        _ => NodeType::Text,
    };

    // Convert parent_id and before_sibling_id to NodeId objects
    let parent_node_id = parent_id.map(NodeId::from_string);
    let before_sibling_node_id = before_sibling_id.map(NodeId::from_string);

    // Special handling for AIChatNode metadata
    if node_type == "ai-chat" && metadata.is_some() {
        log::info!("🤖 Processing AIChatNode with enhanced metadata");

        // Log metadata structure for debugging
        if let Some(ref meta) = metadata {
            log::info!("📊 AIChatNode metadata structure:");
            log::info!(
                "   Question: {}",
                meta.get("question")
                    .and_then(|v| v.as_str())
                    .unwrap_or("N/A")
            );
            log::info!(
                "   Response: {}",
                meta.get("response")
                    .and_then(|v| v.as_str())
                    .map(|s| format!("{}...", &s[..50.min(s.len())]))
                    .unwrap_or("N/A".to_string())
            );
            log::info!(
                "   Sources: {}",
                meta.get("node_sources")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.len())
                    .unwrap_or(0)
            );
            log::info!(
                "   Confidence: {}",
                meta.get("overall_confidence")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0)
            );
        }
    }

    // Use core-logic upsert method when available, fallback to existing methods
    // TODO: Replace with actual upsert_node call when core-logic implements it
    log::info!("🚀 Using fallback implementation until core-logic provides upsert_node()");

    // For now, use enhanced create_node_for_date_with_id which supports metadata
    match service
        .create_node_for_date_with_id(
            node_id_obj,
            date,
            &content,
            node_type_enum,
            metadata, // Pass metadata directly
            parent_node_id,
            before_sibling_node_id,
        )
        .await
    {
        Ok(_) => {
            log::info!("✅ Unified upsert completed successfully");

            if node_type == "ai-chat" {
                log::info!("🤖 AIChatNode created with simplified metadata structure");
                log::info!("   📚 Vector embedding: Content only (title)");
                log::info!("   📊 Metadata stored: Q&A conversation data");
            }

            Ok(())
        }
        Err(e) => {
            log::error!("❌ Unified upsert failed: {}", e);
            Err(format!("Failed to upsert node: {}", e))
        }
    }
}

// ADR-015: Multimodal file processing commands for Core-UI integration

#[tauri::command]
async fn create_image_node(_state: State<'_, AppState>) -> Result<ImageData, String> {
    log_command("create_image_node", "opening file dialog");

    // 1. Open OS file dialog for image selection
    // Note: This is a simplified implementation due to Tauri API changes
    // For now, return an error until proper file dialog integration is implemented
    Err("File dialog not yet implemented - waiting for Tauri API update".to_string())
}


#[tauri::command]
async fn process_dropped_files(
    file_paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<ImageData>, String> {
    log_command(
        "process_dropped_files",
        &format!("processing {} files", file_paths.len()),
    );

    let mut results = Vec::new();

    for file_path in file_paths {
        // Only process image files
        if is_image_file(&file_path) {
            match process_image_file(file_path, &state).await {
                Ok(image_data) => results.push(image_data),
                Err(e) => log::warn!("Failed to process image file: {}", e),
            }
        }
    }

    Ok(results)
}

#[tauri::command]
async fn multimodal_search(
    query: String,
    config: MultimodalSearchConfig,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    log_command(
        "multimodal_search",
        &format!(
            "query: {}, include_images: {}",
            query, config.include_images
        ),
    );

    if query.trim().is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    // Get or initialize the NodeSpaceService
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    // Use semantic search with multimodal capability
    let search_results = service
        .semantic_search(&query, config.max_results)
        .await
        .map_err(|e| format!("Failed to perform multimodal search: {}", e))?;

    // Convert to search results with enhanced snippets for images
    let results: Vec<SearchResult> = search_results
        .into_iter()
        .filter(|result| result.score >= config.min_similarity_threshold)
        .map(|search_result| {
            let snippet = create_search_snippet(&search_result.node);
            SearchResult {
                node: search_result.node,
                score: search_result.score as f64,
                snippet,
            }
        })
        .collect();

    log::info!(
        "✅ Multimodal search completed, found {} results",
        results.len()
    );
    Ok(results)
}

// Helper functions for image processing

async fn process_image_file(
    file_path: String,
    _state: &State<'_, AppState>,
) -> Result<ImageData, String> {
    use std::fs;

    // 2. Validate file (type, size, security)
    if !is_image_file(&file_path) {
        return Err("File is not a supported image format".to_string());
    }

    let metadata =
        fs::metadata(&file_path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

    if metadata.len() > 10 * 1024 * 1024 {
        // 10MB limit
        return Err("Image file too large (max 10MB)".to_string());
    }

    // 3. Read and validate image data
    let image_data =
        fs::read(&file_path).map_err(|e| format!("Failed to read image file: {}", e))?;

    let img =
        image::load_from_memory(&image_data).map_err(|e| format!("Invalid image format: {}", e))?;

    let (width, height) = (img.width(), img.height());

    // 4. Extract metadata (EXIF, camera info)
    let filename = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let mime_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    // 5. Embeddings are automatically generated by the data store when nodes are created
    // For now, provide a placeholder vector that will be replaced when the node is stored
    let embeddings = vec![0.0; 384]; // Placeholder - actual embeddings generated by data store

    // 6. Create blob URL for UI display
    use base64::{engine::general_purpose, Engine as _};
    let base64_data = general_purpose::STANDARD.encode(&image_data);
    let blob_url = format!("data:{};base64,{}", mime_type, base64_data);

    let image_metadata = ImageMetadata {
        filename,
        mime_type,
        file_size: metadata.len(),
        width,
        height,
        exif_data: None,      // TODO: Extract EXIF data
        ai_description: None, // TODO: Generate AI description
        created_at: chrono::Utc::now(),
    };

    let image_data = ImageData {
        file_path,
        metadata: image_metadata,
        embeddings,
        blob_url,
        dimensions: (width, height),
    };

    log::info!(
        "✅ Processed image file: {} ({}x{})",
        image_data.metadata.filename,
        width,
        height
    );
    Ok(image_data)
}

fn is_image_file(file_path: &str) -> bool {
    let path = std::path::Path::new(file_path);
    if let Some(extension) = path.extension().and_then(|ext| ext.to_str()) {
        matches!(
            extension.to_lowercase().as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp"
        )
    } else {
        false
    }
}

fn create_search_snippet(node: &Node) -> String {
    if let Some(content_str) = node.content.as_str() {
        let snippet_len = content_str.len().min(100);
        if content_str.len() > snippet_len {
            format!("{}...", &content_str[..snippet_len])
        } else {
            content_str.to_string()
        }
    } else {
        // For non-text content (like images), create a descriptive snippet
        if let Some(metadata) = node.metadata.as_ref().and_then(|m| m.as_object()) {
            if let Some(node_type) = metadata.get("node_type").and_then(|v| v.as_str()) {
                match node_type {
                    "image" => {
                        let filename = metadata
                            .get("filename")
                            .and_then(|v| v.as_str())
                            .unwrap_or("image");
                        format!("Image: {}", filename)
                    }
                    _ => "...".to_string(),
                }
            } else {
                "...".to_string()
            }
        } else {
            "...".to_string()
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize custom logging first
    if let Err(e) = init_logging() {
        eprintln!("Failed to initialize logging: {}", e);
    }

    log_startup();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::default())
        .setup(|_app| {
            // Skip Tauri plugin logging since we already initialized fern logging

            log_service_init("Application State");
            log_service_ready("Application State");

            log::info!("🎉 NodeSpace Desktop with real ServiceContainer integration initialized");
            log::info!("   ✅ Clean dependency boundary: Desktop → ServiceContainer → Data Store + NLP Engine");
            log::info!("   ✅ Zero ML dependencies in desktop app");
            log::info!("   ✅ Real AI processing and database persistence via ServiceContainer");
            log::info!("   ✅ Multimodal file processing capabilities enabled");
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
            // get_node, // TODO: Enable once core-logic ServiceContainer has get_node method
            process_query,
            semantic_search,
            get_nodes_for_date,
            update_node_content,
            update_node_structure,
            delete_node,
            create_node_for_date,
            create_node_for_date_with_id,
            get_today_date,
            // Unified node management for single callback architecture
            upsert_node,
            // ADR-015: Multimodal file processing commands
            create_image_node,
            process_dropped_files,
            multimodal_search
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
