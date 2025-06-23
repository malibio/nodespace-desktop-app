use crate::error::AppError;
use crate::{Node, NodeId, QueryResponse, SearchResult};
use std::collections::HashMap;

/// Test utilities for business logic validation
pub struct TestUtils;

impl TestUtils {
    pub fn create_test_node(content: &str) -> Node {
        let node_id = NodeId(uuid::Uuid::new_v4().to_string());
        let now = chrono::Utc::now().to_rfc3339();
        let mut metadata = HashMap::new();
        metadata.insert(
            "type".to_string(),
            serde_json::Value::String("test".to_string()),
        );

        Node {
            id: node_id,
            content: serde_json::Value::String(content.to_string()),
            metadata: Some(serde_json::Value::Object(metadata.into_iter().collect())),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn validate_node_content(content: &str) -> Result<(), AppError> {
        if content.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "Content cannot be empty".to_string(),
            ));
        }
        Ok(())
    }

    pub fn validate_search_query(query: &str) -> Result<(), AppError> {
        if query.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "Search query cannot be empty".to_string(),
            ));
        }
        Ok(())
    }

    pub fn validate_search_limit(limit: usize) -> Result<(), AppError> {
        if limit == 0 || limit > 100 {
            return Err(AppError::InvalidInput(
                "Limit must be between 1 and 100".to_string(),
            ));
        }
        Ok(())
    }

    pub fn validate_question(question: &str) -> Result<(), AppError> {
        if question.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "Question cannot be empty".to_string(),
            ));
        }
        Ok(())
    }

    pub fn create_mock_query_response(question: &str) -> QueryResponse {
        QueryResponse {
            answer: format!("This is a placeholder response to: '{}'", question),
            sources: vec![],
            confidence: 0.5,
        }
    }

    pub fn create_search_results(nodes: Vec<Node>, query: &str) -> Vec<SearchResult> {
        nodes
            .into_iter()
            .filter(|node| {
                if let serde_json::Value::String(content) = &node.content {
                    content.to_lowercase().contains(&query.to_lowercase())
                } else {
                    false
                }
            })
            .map(|node| SearchResult {
                snippet: if let serde_json::Value::String(content) = &node.content {
                    content.chars().take(100).collect::<String>() + "..."
                } else {
                    "...".to_string()
                },
                score: 0.8,
                node,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_test_node() {
        let content = "Test content";
        let node = TestUtils::create_test_node(content);

        if let serde_json::Value::String(node_content) = &node.content {
            assert_eq!(node_content, content);
        } else {
            panic!("Expected content to be a string");
        }
        assert!(!node.id.0.is_empty());
        assert!(!node.created_at.is_empty());
        assert!(!node.updated_at.is_empty());
        assert_eq!(node.created_at, node.updated_at);
        if let Some(serde_json::Value::Object(metadata)) = &node.metadata {
            assert!(metadata.contains_key("type"));
        } else {
            panic!("Expected metadata to be an object");
        }
    }

    #[test]
    fn test_validate_node_content_valid() {
        assert!(TestUtils::validate_node_content("Valid content").is_ok());
        assert!(TestUtils::validate_node_content("  Valid content  ").is_ok());
    }

    #[test]
    fn test_validate_node_content_invalid() {
        assert!(TestUtils::validate_node_content("").is_err());
        assert!(TestUtils::validate_node_content("   ").is_err());
        assert!(TestUtils::validate_node_content("\t\n  ").is_err());
    }

    #[test]
    fn test_validate_search_query_valid() {
        assert!(TestUtils::validate_search_query("valid query").is_ok());
        assert!(TestUtils::validate_search_query("  valid query  ").is_ok());
    }

    #[test]
    fn test_validate_search_query_invalid() {
        assert!(TestUtils::validate_search_query("").is_err());
        assert!(TestUtils::validate_search_query("   ").is_err());
        assert!(TestUtils::validate_search_query("\t\n  ").is_err());
    }

    #[test]
    fn test_validate_search_limit_valid() {
        assert!(TestUtils::validate_search_limit(1).is_ok());
        assert!(TestUtils::validate_search_limit(50).is_ok());
        assert!(TestUtils::validate_search_limit(100).is_ok());
    }

    #[test]
    fn test_validate_search_limit_invalid() {
        assert!(TestUtils::validate_search_limit(0).is_err());
        assert!(TestUtils::validate_search_limit(101).is_err());
        assert!(TestUtils::validate_search_limit(1000).is_err());
    }

    #[test]
    fn test_validate_question_valid() {
        assert!(TestUtils::validate_question("What is NodeSpace?").is_ok());
        assert!(TestUtils::validate_question("  What is NodeSpace?  ").is_ok());
    }

    #[test]
    fn test_validate_question_invalid() {
        assert!(TestUtils::validate_question("").is_err());
        assert!(TestUtils::validate_question("   ").is_err());
        assert!(TestUtils::validate_question("\t\n  ").is_err());
    }

    #[test]
    fn test_create_mock_query_response() {
        let question = "What is NodeSpace?";
        let response = TestUtils::create_mock_query_response(question);

        assert!(response.answer.contains(question));
        assert_eq!(response.confidence, 0.5);
        assert!(response.sources.is_empty());
    }

    #[test]
    fn test_create_search_results() {
        let nodes = vec![
            TestUtils::create_test_node("This contains search term"),
            TestUtils::create_test_node("This does not contain the term"),
            TestUtils::create_test_node("Another search term example"),
        ];

        let results = TestUtils::create_search_results(nodes, "search");

        assert_eq!(results.len(), 2);
        for result in results {
            if let serde_json::Value::String(content) = &result.node.content {
                assert!(content.to_lowercase().contains("search"));
            } else {
                panic!("Expected content to be a string");
            }
            assert_eq!(result.score, 0.8);
            assert!(!result.snippet.is_empty());
        }
    }

    #[test]
    fn test_create_search_results_no_matches() {
        let nodes = vec![
            TestUtils::create_test_node("This is content"),
            TestUtils::create_test_node("Another piece of content"),
        ];

        let results = TestUtils::create_search_results(nodes, "nonexistent");
        assert!(results.is_empty());
    }

    #[test]
    fn test_node_serialization() {
        let node = TestUtils::create_test_node("Test content");
        let serialized = serde_json::to_string(&node).unwrap();
        let deserialized: Node = serde_json::from_str(&serialized).unwrap();

        assert_eq!(node.id.0, deserialized.id.0);
        assert_eq!(node.content, deserialized.content);
        assert_eq!(node.created_at, deserialized.created_at);
        assert_eq!(node.updated_at, deserialized.updated_at);
    }

    #[test]
    fn test_query_response_serialization() {
        let response = TestUtils::create_mock_query_response("test question");
        let serialized = serde_json::to_string(&response).unwrap();
        let deserialized: QueryResponse = serde_json::from_str(&serialized).unwrap();

        assert_eq!(response.answer, deserialized.answer);
        assert_eq!(response.confidence, deserialized.confidence);
        assert_eq!(response.sources.len(), deserialized.sources.len());
    }

    #[test]
    fn test_search_result_serialization() {
        let node = TestUtils::create_test_node("Test content");
        let search_result = SearchResult {
            node: node.clone(),
            score: 0.9,
            snippet: "Test snippet".to_string(),
        };

        let serialized = serde_json::to_string(&search_result).unwrap();
        let deserialized: SearchResult = serde_json::from_str(&serialized).unwrap();

        assert_eq!(search_result.node.id.0, deserialized.node.id.0);
        assert_eq!(search_result.score, deserialized.score);
        assert_eq!(search_result.snippet, deserialized.snippet);
    }
}
