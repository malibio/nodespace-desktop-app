use std::path::PathBuf;

/// Application configuration for NodeSpace Desktop
#[derive(Debug, Clone)]
pub struct AppConfig {
    pub database_path: String,
    pub models_path: String,
}

impl AppConfig {
    /// Create configuration based on environment (dev/production)
    pub fn new() -> Result<Self, String> {
        if cfg!(debug_assertions) {
            Self::development_config()
        } else {
            Self::production_config()
        }
    }

    /// Development configuration - uses relative paths for workspace
    fn development_config() -> Result<Self, String> {
        // Check for environment variable overrides first
        let database_path = std::env::var("NODESPACE_DB_PATH")
            .unwrap_or_else(|_| "../../data/lance_db/e2e_sample.db".to_string());

        let models_path =
            std::env::var("NODESPACE_MODELS_PATH").unwrap_or_else(|_| "../../models".to_string());

        log::info!("🔧 Development config:");
        log::info!("   Database: {}", database_path);
        log::info!("   Models: {}", models_path);

        Ok(AppConfig {
            database_path,
            models_path,
        })
    }

    /// Production configuration - uses Tauri resource directory
    fn production_config() -> Result<Self, String> {
        // For production, first try environment variables
        if let (Ok(db_path), Ok(models_path)) = (
            std::env::var("NODESPACE_DB_PATH"),
            std::env::var("NODESPACE_MODELS_PATH"),
        ) {
            log::info!("🔧 Production config (env vars):");
            log::info!("   Database: {}", db_path);
            log::info!("   Models: {}", models_path);

            return Ok(AppConfig {
                database_path: db_path,
                models_path,
            });
        }

        // Fallback to bundled resources
        let resource_dir = Self::get_resource_dir()?;

        let database_path = resource_dir
            .join("data")
            .join("lance_db")
            .join("production.db")
            .to_string_lossy()
            .to_string();

        let models_path = resource_dir.join("models").to_string_lossy().to_string();

        log::info!("🔧 Production config (bundled resources):");
        log::info!("   Database: {}", database_path);
        log::info!("   Models: {}", models_path);

        Ok(AppConfig {
            database_path,
            models_path,
        })
    }

    /// Get Tauri resource directory for bundled assets
    fn get_resource_dir() -> Result<PathBuf, String> {
        if cfg!(debug_assertions) {
            // Development fallback
            Ok(PathBuf::from("../../"))
        } else {
            // Production: Use bundled resources
            // In a real production build, you would use:
            // path::resource_dir(&tauri::generate_context!())
            //     .ok_or_else(|| "Failed to get resource directory".to_string())

            // For now, fallback that works in both dev and production
            std::env::current_dir()
                .map(|cwd| cwd.join("resources"))
                .map_err(|e| format!("Failed to get resource directory: {}", e))
        }
    }

    /// Validate that configured paths exist and are accessible
    pub fn validate(&self) -> Result<(), String> {
        // Validate database directory exists (create if needed)
        if let Some(db_dir) = PathBuf::from(&self.database_path).parent() {
            if !db_dir.exists() {
                log::warn!(
                    "Database directory doesn't exist, will be created: {:?}",
                    db_dir
                );
            }
        }

        // Validate models directory exists
        let models_dir = PathBuf::from(&self.models_path);
        if !models_dir.exists() {
            return Err(format!("Models directory not found: {:?}", models_dir));
        }

        // Check for required model files
        let model_file = models_dir.join("gemma-3-1b-it-onnx").join("model.onnx");
        if !model_file.exists() {
            log::warn!("ONNX model file not found: {:?}", model_file);
        }

        Ok(())
    }

    /// Get database path
    pub fn database_path(&self) -> &str {
        &self.database_path
    }

    /// Get models path
    pub fn models_path(&self) -> &str {
        &self.models_path
    }
}

/// Environment-specific configuration helpers
impl AppConfig {
    /// Create configuration for testing
    #[allow(dead_code)]
    pub fn for_testing() -> Self {
        AppConfig {
            database_path: "memory".to_string(),
            models_path: std::env::var("NODESPACE_MODELS_PATH")
                .unwrap_or_else(|_| "../../models".to_string()),
        }
    }

    /// Create configuration with explicit paths (for custom setups)
    #[allow(dead_code)]
    pub fn with_paths(database_path: String, models_path: String) -> Self {
        AppConfig {
            database_path,
            models_path,
        }
    }
}
