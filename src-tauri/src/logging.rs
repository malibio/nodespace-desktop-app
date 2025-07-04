use log::info;

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
        // Reduce LanceDB verbosity - only show warnings and errors
        // This significantly reduces console spam from LanceDB operations
        .level_for("lance", log::LevelFilter::Warn)
        .level_for("lancedb", log::LevelFilter::Warn)
        .level_for("lance_core", log::LevelFilter::Warn)
        .level_for("lance_datafusion", log::LevelFilter::Warn)
        .level_for("lance_io", log::LevelFilter::Warn)
        .level_for("lance_encoding", log::LevelFilter::Warn)
        .level_for("lance_index", log::LevelFilter::Warn)
        .level_for("lance_table", log::LevelFilter::Warn)
        .level_for("lance_file", log::LevelFilter::Warn)
        .level_for("lance_linalg", log::LevelFilter::Warn)
        .level_for("lance::dataset", log::LevelFilter::Error)
        .level_for("lance::dataset::scanner", log::LevelFilter::Error)
        // Suppress sqlparser debug noise
        .level_for("sqlparser", log::LevelFilter::Warn)
        .level_for("sqlparser::parser", log::LevelFilter::Warn)
        .level_for("sqlparser::dialect", log::LevelFilter::Warn)
        // Also reduce DataFusion verbosity (used by LanceDB)
        .level_for("datafusion", log::LevelFilter::Warn)
        .level_for("datafusion_common", log::LevelFilter::Warn)
        .level_for("datafusion_execution", log::LevelFilter::Warn)
        .level_for("datafusion_optimizer", log::LevelFilter::Warn)
        .level_for("datafusion_physical_plan", log::LevelFilter::Warn)
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

