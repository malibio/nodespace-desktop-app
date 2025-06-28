use log::{error, info, warn};

/// Initialize logging for the application
pub fn init_logging() -> Result<(), Box<dyn std::error::Error>> {
    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    // Create logs directory if it doesn't exist
    let logs_dir = std::env::current_dir()?.join("logs");
    std::fs::create_dir_all(&logs_dir)?;

    // Configure fern for structured logging
    fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "{}[{}][{}] {}",
                chrono::Utc::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                record.target(),
                record.level(),
                message
            ))
        })
        .level(log_level)
        // Filter out noisy LanceDB internal logs
        .level_for("lance_file::v2::reader", log::LevelFilter::Warn)
        .level_for("lance_file::v2::writer", log::LevelFilter::Warn)
        .level_for("lance_file", log::LevelFilter::Warn)
        .level_for("lancedb", log::LevelFilter::Info)
        .chain(std::io::stdout())
        .chain(
            fern::Dispatch::new()
                .level(log::LevelFilter::Warn)
                .chain(fern::log_file(logs_dir.join("nodespace.log"))?),
        )
        .apply()?;

    info!("Logging initialized successfully");
    Ok(())
}

/// Log application startup
pub fn log_startup() {
    info!("NodeSpace Desktop Application starting...");
    info!("Version: {}", env!("CARGO_PKG_VERSION"));
    info!(
        "Build mode: {}",
        if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        }
    );
}

/// Log service initialization
pub fn log_service_init(service_name: &str) {
    info!("Initializing service: {}", service_name);
}

/// Log service initialization success
pub fn log_service_ready(service_name: &str) {
    info!("Service ready: {}", service_name);
}

/// Log service initialization failure
#[allow(dead_code)]
pub fn log_service_error(service_name: &str, error: &str) {
    error!(
        "Service initialization failed [{}]: {}",
        service_name, error
    );
}

/// Log Tauri command execution
pub fn log_command(command_name: &str, params: &str) {
    info!(
        "Executing command: {} with params: {}",
        command_name, params
    );
}

/// Log application shutdown
pub fn log_shutdown() {
    info!("NodeSpace Desktop Application shutting down...");
}

/// Log errors with context
#[allow(dead_code)]
pub fn log_error_with_context(context: &str, error: &str) {
    error!("Error in {}: {}", context, error);
}

/// Log warnings with context
#[allow(dead_code)]
pub fn log_warning_with_context(context: &str, warning: &str) {
    warn!("Warning in {}: {}", context, warning);
}
