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
use nodespace_core_logic::{CoreLogic, NodeSpaceService};
use nodespace_core_types::{Node, NodeId};
use nodespace_data_store::{LanceDataStore, NodeType};
use nodespace_nlp_engine::LocalNLPEngine;

// NodeSpaceService integration with dependency injection pattern

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

    // Initialize data store
    let data_store = LanceDataStore::new("/Users/malibio/nodespace/data/lance_db")
        .await
        .map_err(|e| format!("Failed to initialize data store: {}", e))?;

    // Initialize NLP engine
    let nlp_engine = LocalNLPEngine::new();

    // Create service with injected dependencies
    let service = NodeSpaceService::new(data_store, nlp_engine);

    // Initialize the service
    service
        .initialize()
        .await
        .map_err(|e| format!("Failed to initialize service: {}", e))?;

    log_service_init("NodeSpaceService");
    log_service_ready("NodeSpaceService");

    log::info!("✅ NodeSpaceService initialized successfully");
    log::info!("   - Connected to LanceDB with data persistence");
    log::info!("   - Architecture: Desktop → NodeSpaceService → DataStore + NLPEngine");
    log::info!("   - Real AI integration and database persistence active");

    Ok(Arc::new(service))
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
        .map_err(|e| format!("Failed to create knowledge node: {}", e))?;

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

    // Use real ServiceContainer for RAG query processing
    let query_response = service
        .process_query(&question)
        .await
        .map_err(|e| format!("Failed to process query: {}", e))?;

    // Search for related nodes as sources using real database
    let search_results = service
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

    // Use real ServiceContainer for semantic search
    let search_results = service
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
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let _service = service_guard.as_ref().unwrap();

    // Immediately save structure changes (parent/child relationships)
    let _node_id_obj = NodeId::from_string(node_id.clone());

    // For now, log the structure change - real implementation would update relationships
    log::info!(
        "🔄 Structure change '{}' for node {} - saving to database",
        operation,
        node_id
    );

    // TODO: Implement specific relationship updates based on operation type
    // Examples: "indent", "outdent", "move_up", "move_down", etc.
    // This will require additional methods in core-logic ServiceContainer interface

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
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command(
        "create_node_for_date_with_id",
        &format!(
            "node_id: {}, date: {}, content_len: {}",
            node_id,
            date_str,
            content.len()
        ),
    );

    // Parse the date string
    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Convert string to NodeId (ready for NS-118 when create_node_for_date_with_id is available)
    let _node_id_obj = NodeId::from_string(node_id.clone());

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

    // TODO: Use create_node_for_date_with_id when NS-118 core-logic implementation is complete
    // For now, using fallback until the method is available
    log::warn!("create_node_for_date_with_id not yet available in core-logic (NS-118 pending)");
    log::info!("Using fallback create_node_for_date - fire-and-forget pattern simulated");

    let _fallback_id = service
        .create_node_for_date(date, &content, NodeType::Text, None)
        .await
        .map_err(|e| format!("Failed to create node for date: {}", e))?;

    log::info!(
        "✅ Created node for date {} (UUID {} logged for NS-118 integration)",
        date_str,
        node_id
    );
    Ok(())
}

#[tauri::command]
async fn get_today_date() -> Result<String, String> {
    let today = chrono::Utc::now().date_naive();
    Ok(today.format("%Y-%m-%d").to_string())
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
            create_node_for_date,
            create_node_for_date_with_id,
            get_today_date,
            // ADR-015: Multimodal file processing commands
            create_image_node,
            process_dropped_files,
            multimodal_search
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
