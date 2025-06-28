# NodeSpace Desktop Configuration

This document explains how to configure the NodeSpace desktop application for different environments.

## Configuration System

The app uses environment-aware configuration that automatically adapts based on build mode:

- **Development** (`debug_assertions`): Uses relative paths in the workspace
- **Production** (`release`): Uses bundled resources or environment variables

## Environment Variables

You can override default paths using environment variables:

```bash
# Database path (required)
NODESPACE_DB_PATH=../../data/lance_db/e2e_sample.db

# Models directory (required)  
NODESPACE_MODELS_PATH=../../models

# Environment mode (optional)
NODE_ENV=development

# Logging level (optional)
RUST_LOG=info,app_lib=debug
```

## Development Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your paths:
   ```bash
   NODESPACE_DB_PATH=../../data/lance_db/e2e_sample.db
   NODESPACE_MODELS_PATH=../../models
   ```

3. Run the development server:
   ```bash
   cargo tauri dev
   ```

## Production Deployment

### App Store Builds

For App Store distribution:

1. **Bundle Resources**: Models and production database are bundled in the app
   - Configured in `tauri.conf.json` under `bundle.resources`
   - Resources are accessible via `$RESOURCE` directory

2. **Environment Variables**: Set production paths via environment:
   ```bash
   export NODESPACE_DB_PATH=/Applications/NodeSpace.app/Contents/Resources/data/production.db
   export NODESPACE_MODELS_PATH=/Applications/NodeSpace.app/Contents/Resources/models
   ```

3. **Build for release**:
   ```bash
   cargo tauri build --target universal-apple-darwin
   ```

### Enterprise Deployment

For enterprise or custom deployments:

1. **External Configuration**: Use environment variables to point to shared resources:
   ```bash
   export NODESPACE_DB_PATH=/shared/nodespace/database/production.db
   export NODESPACE_MODELS_PATH=/shared/nodespace/models
   ```

2. **Docker/Container Deployment**:
   ```dockerfile
   ENV NODESPACE_DB_PATH=/app/data/production.db
   ENV NODESPACE_MODELS_PATH=/app/models
   ```

## File Structure

### Development
```
nodespace/
├── models/                          # AI models
│   └── gemma-3-1b-it-onnx/
│       └── model.onnx
├── data/
│   └── lance_db/
│       ├── e2e_sample.db/           # Test data
│       └── production.db/           # Production data
└── nodespace-desktop-app/
    ├── .env                         # Local config
    └── src-tauri/
        └── src/
            └── config.rs            # Configuration module
```

### Production (App Store)
```
NodeSpace.app/
└── Contents/
    └── Resources/
        ├── models/                  # Bundled models
        └── data/
            └── production.db/       # Bundled database
```

## Configuration Priority

The app loads configuration in this order (highest priority first):

1. **Environment Variables** (`NODESPACE_DB_PATH`, `NODESPACE_MODELS_PATH`)
2. **Bundled Resources** (production builds only)
3. **Default Paths** (development relative paths)

## Troubleshooting

### Model Loading Issues
- Check `NODESPACE_MODELS_PATH` points to directory containing `gemma-3-1b-it-onnx/`
- Verify `model.onnx` file exists and is readable
- Look for "Models directory exists: true" in logs

### Database Issues
- Check `NODESPACE_DB_PATH` points to valid LanceDB directory
- Verify database directory is writable
- Look for "Database exists: true" in logs

### Path Resolution
- Check logs for "📍" entries showing resolved paths
- Use absolute paths if relative paths aren't working
- Ensure working directory is correct

## Security Considerations

- **Bundled Resources**: Safe for App Store distribution
- **Environment Variables**: Secure for enterprise deployment  
- **File Permissions**: App needs read access to models, read/write to database
- **Code Signing**: Bundled resources are signed with the app