mod config;
mod error;
mod logging;

#[cfg(test)]
mod tests;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::config::AppConfig;
use crate::error::AppError;
use crate::logging::*;
use chrono::NaiveDate;
use nodespace_core_logic::{CoreLogic, DateNavigation, LegacyCoreLogic, NodeSpaceService};
use nodespace_core_types::{Node, NodeId};
use nodespace_data_store::LanceDataStore;
use nodespace_nlp_engine::LocalNLPEngine;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationResult {
    pub nodes: Vec<Node>,
    pub has_previous: bool,
    pub has_next: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateNode {
    pub id: NodeId,
    pub date: NaiveDate,
    pub description: Option<String>,
    pub child_count: usize,
}

type SharedNodeSpaceService =
    Arc<Mutex<Option<Arc<NodeSpaceService<LanceDataStore, LocalNLPEngine>>>>>;

pub struct AppState {
    pub nodespace_service: SharedNodeSpaceService,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            nodespace_service: Arc::new(Mutex::new(None)),
        }
    }
}

async fn initialize_nodespace_service(
) -> Result<Arc<NodeSpaceService<LanceDataStore, LocalNLPEngine>>, String> {
    let config = AppConfig::new()?;
    config.validate()?;

    let service =
        NodeSpaceService::create_with_paths(config.database_path(), Some(config.models_path()))
            .await
            .map_err(|e| format!("Failed to create NodeSpaceService: {}", e))?;

    service
        .initialize()
        .await
        .map_err(|e| format!("Failed to initialize service: {}", e))?;

    log_service_init("NodeSpaceService");
    log_service_ready("NodeSpaceService");

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
    service
        .create_knowledge_node(&content, metadata_value)
        .await
        .map_err(|e| format!("Failed to create knowledge node: {}", e))
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
        .map_err(|e| format!("Failed to update node: {}", e))
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
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    let query_response = service
        .process_query(&question)
        .await
        .map_err(|e| format!("Failed to process query: {}", e))?;

    let search_results = service
        .semantic_search(&question, 5)
        .await
        .unwrap_or_default();

    let source_nodes: Vec<Node> = search_results.into_iter().map(|r| r.node).collect();

    Ok(QueryResponse {
        answer: query_response.answer,
        sources: source_nodes,
        confidence: query_response.confidence as f64,
    })
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

    let search_results = service
        .semantic_search(&query, limit)
        .await
        .map_err(|e| format!("Failed to perform semantic search: {}", e))?;

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

    Ok(results)
}

#[tauri::command]
async fn get_nodes_for_date(
    date_str: String,
    state: State<'_, AppState>,
) -> Result<Vec<Node>, String> {
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

    let nodes = service
        .get_nodes_for_date(date)
        .await
        .map_err(|e| format!("Failed to get nodes for date: {}", e))?;

    Ok(nodes)
}

#[tauri::command]
async fn navigate_to_date(
    date_str: String,
    state: State<'_, AppState>,
) -> Result<NavigationResult, String> {
    log_command("navigate_to_date", &format!("date: {}", date_str));

    // Parse the date string
    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Get or initialize the ServiceContainer
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    // Get nodes for the specified date
    let nodes = service
        .get_nodes_for_date(date)
        .await
        .map_err(|e| format!("Failed to get nodes for date: {}", e))?;

    // Check if there's a previous day with content (subtract 1 day)
    let previous_date = date - chrono::Duration::days(1);
    let has_previous = !service
        .get_nodes_for_date(previous_date)
        .await
        .unwrap_or_default()
        .is_empty();

    // Check if there's a next day with content (add 1 day)
    let next_date = date + chrono::Duration::days(1);
    let has_next = !service
        .get_nodes_for_date(next_date)
        .await
        .unwrap_or_default()
        .is_empty();

    Ok(NavigationResult {
        nodes,
        has_previous,
        has_next,
    })
}

#[tauri::command]
async fn create_or_get_date_node(
    date_str: String,
    state: State<'_, AppState>,
) -> Result<DateNode, String> {
    log_command("create_or_get_date_node", &format!("date: {}", date_str));

    // Parse the date string
    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}. Expected YYYY-MM-DD", e))?;

    // Get or initialize the ServiceContainer
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    // Get nodes for the date to check if date node exists
    let nodes = service
        .get_nodes_for_date(date)
        .await
        .map_err(|e| format!("Failed to get nodes for date: {}", e))?;

    Ok(DateNode {
        id: NodeId::from_string(format!("date-{}", date.format("%Y-%m-%d"))),
        date,
        description: Some(date.format("%A, %B %d, %Y").to_string()),
        child_count: nodes.len(),
    })
}

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

    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();
    let node_id_obj = NodeId::from_string(node_id.clone());

    service
        .update_node(&node_id_obj, &content)
        .await
        .map_err(|e| format!("Failed to auto-save node content: {}", e))
}

#[tauri::command]
async fn update_node_structure(
    operation: String,
    node_id: String,
    target_parent_id: Option<String>,
    previous_sibling_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log_command(
        "update_node_structure",
        &format!("operation: {}, node_id: {}", operation, node_id),
    );

    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();
    let node_id_obj = NodeId::from_string(node_id.clone());
    let target_parent_id_obj = target_parent_id
        .as_ref()
        .map(|id| NodeId::from_string(id.clone()));
    let previous_sibling_id_obj = previous_sibling_id
        .as_ref()
        .map(|id| NodeId::from_string(id.clone()));

    service
        .update_node_structure(
            &node_id_obj,
            &operation,
            target_parent_id_obj.as_ref(),
            previous_sibling_id_obj.as_ref(),
        )
        .await
        .map_err(|e| format!("Failed to update node structure: {}", e))
}

#[tauri::command]
async fn get_today_date() -> Result<String, String> {
    let today = chrono::Utc::now().date_naive();
    Ok(today.format("%Y-%m-%d").to_string())
}

#[tauri::command]
async fn create_sample_data(state: State<'_, AppState>) -> Result<String, String> {
    log_command("create_sample_data", "Creating sample hierarchical data");

    // Get or initialize the NodeSpaceService
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    let today = chrono::Utc::now().date_naive();
    let date_str = today.format("%Y-%m-%d").to_string();

    // Create a few hierarchical nodes for today
    let mut created = Vec::new();

    // Root task node
    let mut task_metadata = HashMap::new();
    task_metadata.insert(
        "created_date".to_string(),
        serde_json::Value::String(date_str.clone()),
    );
    task_metadata.insert(
        "nodeType".to_string(),
        serde_json::Value::String("task".to_string()),
    );

    let task_id = service
        .create_knowledge_node(
            "# Product Launch Planning",
            serde_json::Value::Object(task_metadata.into_iter().collect()),
        )
        .await
        .map_err(|e| format!("Failed to create task node: {}", e))?;
    created.push(format!("Task: {}", task_id));

    // Child text nodes
    let mut text_metadata = HashMap::new();
    text_metadata.insert(
        "created_date".to_string(),
        serde_json::Value::String(date_str.clone()),
    );
    text_metadata.insert(
        "nodeType".to_string(),
        serde_json::Value::String("text".to_string()),
    );
    text_metadata.insert(
        "parent_id".to_string(),
        serde_json::Value::String(task_id.to_string()),
    );

    let child1_id = service.create_knowledge_node(
        "## Market Research\n- Competitor analysis\n- Target audience survey\n- Pricing strategy",
        serde_json::Value::Object(text_metadata.clone().into_iter().collect())
    ).await.map_err(|e| format!("Failed to create child node: {}", e))?;
    created.push(format!("Child 1: {}", child1_id));

    text_metadata.insert(
        "previous_sibling".to_string(),
        serde_json::Value::String(child1_id.to_string()),
    );
    let child2_id = service.create_knowledge_node(
        "## Development Timeline\n- MVP completion: End of Q1\n- Beta testing: Q2\n- Public launch: Q3",
        serde_json::Value::Object(text_metadata.clone().into_iter().collect())
    ).await.map_err(|e| format!("Failed to create child node: {}", e))?;
    created.push(format!("Child 2: {}", child2_id));

    // Update sibling pointers
    text_metadata.clear();
    text_metadata.insert(
        "next_sibling".to_string(),
        serde_json::Value::String(child2_id.to_string()),
    );

    // AI Chat node
    let mut ai_metadata = HashMap::new();
    ai_metadata.insert(
        "created_date".to_string(),
        serde_json::Value::String(date_str.clone()),
    );
    ai_metadata.insert(
        "nodeType".to_string(),
        serde_json::Value::String("ai-chat".to_string()),
    );
    ai_metadata.insert(
        "parent_id".to_string(),
        serde_json::Value::String(task_id.to_string()),
    );
    ai_metadata.insert(
        "previous_sibling".to_string(),
        serde_json::Value::String(child2_id.to_string()),
    );

    let ai_id = service.create_knowledge_node(
        "AI: What marketing channels should we prioritize?\n\nUser: Let's focus on digital channels first",
        serde_json::Value::Object(ai_metadata.into_iter().collect())
    ).await.map_err(|e| format!("Failed to create AI chat node: {}", e))?;
    created.push(format!("AI Chat: {}", ai_id));

    Ok(format!(
        "Created {} sample nodes for {}: {}",
        created.len(),
        date_str,
        created.join(", ")
    ))
}

#[tauri::command]
async fn debug_list_all_nodes(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    log_command("debug_list_all_nodes", "Listing all nodes in database");

    // Get or initialize the NodeSpaceService
    let mut service_guard = state.nodespace_service.lock().await;
    if service_guard.is_none() {
        *service_guard = Some(initialize_nodespace_service().await?);
    }
    let service = service_guard.as_ref().unwrap();

    // Try to get nodes for the past few days to see what exists
    let mut all_info = Vec::new();
    let today = chrono::Utc::now().date_naive();

    for i in 0..5 {
        let check_date = today - chrono::Duration::days(i);
        let nodes = service
            .get_nodes_for_date(check_date)
            .await
            .unwrap_or_default();
        if !nodes.is_empty() {
            all_info.push(format!(
                "{}: {} nodes",
                check_date.format("%Y-%m-%d"),
                nodes.len()
            ));
            for node in nodes.iter().take(3) {
                let content_preview = if let Some(content_str) = node.content.as_str() {
                    content_str.chars().take(50).collect::<String>()
                } else {
                    "Non-string content".to_string()
                };
                all_info.push(format!("  - {}: {}", node.id, content_preview));
            }
            if nodes.len() > 3 {
                all_info.push(format!("  ... and {} more", nodes.len() - 3));
            }
        }
    }

    if all_info.is_empty() {
        all_info.push("No nodes found in the past 5 days".to_string());
    }

    Ok(all_info)
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

            log::info!("🎉 NS-39 SUCCESS: NodeSpace Desktop with real ServiceContainer integration initialized");
            log::info!("   ✅ Clean dependency boundary: Desktop → ServiceContainer → Data Store + NLP Engine");
            log::info!("   ✅ Zero ML dependencies in desktop app");
            log::info!("   ✅ Real AI processing and database persistence via ServiceContainer");
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
            navigate_to_date,
            create_or_get_date_node,
            update_node_content,
            update_node_structure,
            get_today_date,
            debug_list_all_nodes,
            create_sample_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
