use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Custom error types for the NodeSpace desktop application
#[derive(Error, Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum AppError {
    #[error("Service initialization failed: {0}")]
    ServiceInitialization(String),

    #[error("Data store error: {0}")]
    DataStore(String),

    #[error("NLP engine error: {0}")]
    NlpEngine(String),

    #[error("Node operation failed: {0}")]
    NodeOperation(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("State access error: {0}")]
    StateAccess(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        AppError::Serialization(error.to_string())
    }
}

impl<T> From<std::sync::PoisonError<T>> for AppError {
    fn from(error: std::sync::PoisonError<T>) -> Self {
        AppError::StateAccess(format!("Mutex poison error: {}", error))
    }
}

/// Result type alias for the application
#[allow(dead_code)]
pub type AppResult<T> = Result<T, AppError>;

/// Convert AppError to String for Tauri command compatibility
impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_error_display() {
        let error = AppError::InvalidInput("Test message".to_string());
        assert_eq!(error.to_string(), "Invalid input: Test message");

        let error = AppError::NotFound("Test ID".to_string());
        assert_eq!(error.to_string(), "Not found: Test ID");

        let error = AppError::ServiceInitialization("Service failed".to_string());
        assert_eq!(
            error.to_string(),
            "Service initialization failed: Service failed"
        );
    }

    #[test]
    fn test_app_error_from_serde_json() {
        let json_error = serde_json::from_str::<serde_json::Value>("invalid json").unwrap_err();
        let app_error = AppError::from(json_error);

        match app_error {
            AppError::Serialization(msg) => assert!(msg.contains("expected")),
            _ => panic!("Expected Serialization error"),
        }
    }

    #[test]
    fn test_app_error_to_string_conversion() {
        let error = AppError::StateAccess("Mutex poisoned".to_string());
        let error_string: String = error.into();
        assert_eq!(error_string, "State access error: Mutex poisoned");
    }

    #[test]
    fn test_app_error_serialization() {
        let error = AppError::NodeOperation("Failed to create node".to_string());
        let serialized = serde_json::to_string(&error).unwrap();
        let deserialized: AppError = serde_json::from_str(&serialized).unwrap();

        match deserialized {
            AppError::NodeOperation(msg) => assert_eq!(msg, "Failed to create node"),
            _ => panic!("Expected NodeOperation error"),
        }
    }

    #[test]
    fn test_all_error_variants() {
        let errors = vec![
            AppError::ServiceInitialization("init failed".to_string()),
            AppError::DataStore("db error".to_string()),
            AppError::NlpEngine("nlp error".to_string()),
            AppError::NodeOperation("node error".to_string()),
            AppError::Serialization("serialize error".to_string()),
            AppError::StateAccess("state error".to_string()),
            AppError::InvalidInput("invalid input".to_string()),
            AppError::NotFound("not found".to_string()),
            AppError::Internal("internal error".to_string()),
        ];

        for error in errors {
            // Test that all variants can be displayed and serialized
            let display_str = error.to_string();
            assert!(!display_str.is_empty());

            let serialized = serde_json::to_string(&error).unwrap();
            assert!(!serialized.is_empty());
        }
    }
}
