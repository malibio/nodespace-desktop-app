# NodeSpace Desktop App

**Cross-platform desktop application for NodeSpace knowledge management**

This repository implements the Tauri-based desktop application that serves as the main entry point for NodeSpace. It provides the application shell, coordinates backend services, and bridges the React frontend with Rust business logic for a seamless AI-powered knowledge management experience.

## Overview

NodeSpace Desktop App is a cross-platform desktop application built with Tauri that brings NodeSpace's AI-powered knowledge management capabilities to the desktop. It orchestrates multiple backend services and provides an intuitive hierarchical note-taking interface with integrated semantic search and AI chat functionality.

## Key Features

- **Cross-platform Desktop App** - Native performance with Tauri framework across Windows, macOS, and Linux
- **AI-Powered Knowledge Management** - Integrated semantic search and RAG query capabilities
- **Hierarchical Note Organization** - Tree-structured nodes with parent-child relationships and sibling ordering
- **Date-Based Organization** - Navigate and organize content by date with persistent storage
- **Real-time Auto-save** - Automatic content persistence with optimistic UI updates
- **Dark Mode Support** - Complete theming system with user preference persistence
- **Service Orchestration** - Coordinates data storage, NLP processing, and business logic services

## Recent Updates

### Production-Ready Codebase
- Complete codebase cleanup with removal of debug artifacts and development comments
- All clippy warnings resolved and code formatting standardized
- Updated test suite to reflect current application functionality
- Removed development-specific references and linear issue tracking artifacts

### AI Integration Enhancement
- Full ONNX Runtime integration with CoreML acceleration for Apple Silicon
- Gemma 3 model support for improved AI responses and semantic understanding
- Enhanced AIChatNode functionality with comprehensive metadata storage
- Optimized embedding generation and vector search performance

## Architecture Context

Part of the NodeSpace system architecture:

1. [nodespace-core-types](https://github.com/malibio/nodespace-core-types) - Shared data structures and interfaces
2. [nodespace-data-store](https://github.com/malibio/nodespace-data-store) - LanceDB vector storage implementation
3. [nodespace-nlp-engine](https://github.com/malibio/nodespace-nlp-engine) - AI/ML processing and LLM integration
4. [nodespace-core-logic](https://github.com/malibio/nodespace-core-logic) - Business logic orchestration
5. [nodespace-core-ui](https://github.com/malibio/nodespace-core-ui) - React components and UI
6. **[nodespace-desktop-app](https://github.com/malibio/nodespace-desktop-app)** ← **You are here**

**Service Dependencies:**
- Imports business logic from nodespace-core-logic
- Uses shared types from nodespace-core-types
- Integrates UI components from nodespace-core-ui
- Built on Tauri 2.x framework

## Installation & Development

### Prerequisites

```bash
# Install Tauri CLI
cargo install tauri-cli

# Install Node.js dependencies
npm install
```

### Development

```bash
# Start development mode with hot reload
cargo tauri dev

# Build for production
cargo tauri build

# Development tools
cargo fmt                    # Format Rust code
cargo clippy -- -D warnings  # Lint with warnings as errors
npm test                     # Run frontend tests
cargo test                   # Run backend tests
```

## Usage

### Basic Operations

```rust
// Tauri command examples
use tauri::command;

// Create knowledge nodes with AI processing
#[tauri::command]
async fn create_knowledge_node(content: String) -> Result<NodeId, String> {
    // Automatically generates embeddings and stores in vector database
}

// Semantic search across all content
#[tauri::command] 
async fn semantic_search(query: String, limit: usize) -> Result<Vec<SearchResult>, String> {
    // Vector-based similarity search with relevance scoring
}

// AI chat with RAG context
#[tauri::command]
async fn process_query(question: String) -> Result<QueryResponse, String> {
    // Retrieval-augmented generation with source attribution
}
```

### Frontend Integration

```typescript
// React component integration
import { invoke } from '@tauri-apps/api/core';

// Auto-saving content changes
const debouncedSave = useMemo(() => 
  debounce(async (nodeId: string, content: string) => {
    await invoke('update_node_content', { nodeId, content });
  }, 500), []
);

// AI chat functionality
const handleAIQuery = async (query: string) => {
  const response = await invoke('process_query', { question: query });
  return response.answer;
};
```

## Application Architecture

### Tauri Commands

The app provides 15+ Tauri commands for frontend-backend communication:

- **Content Management**: `create_knowledge_node`, `update_node`, `delete_node`
- **Search & AI**: `semantic_search`, `process_query`
- **Date Navigation**: `get_nodes_for_date`, `create_node_for_date`
- **Structure Operations**: `update_node_structure`, `upsert_node`
- **File Processing**: `process_dropped_files`, `multimodal_search`

### Service Initialization

```rust
// Background service initialization
let service = NodeSpaceService::create_with_background_init(db_path, models_path).await?;

// Services start immediately, AI models load in parallel
// Graceful degradation during initialization period
```

## Testing

### Frontend Tests
```bash
npm test              # Run all React component tests
npm run test:watch    # Watch mode for development
npm run test:ui       # Interactive test UI
npm run test:coverage # Generate coverage reports
```

### Backend Tests
```bash
cargo test                    # Run all Rust unit tests
cargo test -- --nocapture    # Run with output
cargo test integration       # Integration tests only
```

### Test Coverage
- **Frontend Component Tests**: App functionality, date navigation, theme management
- **Integration Tests**: Tauri command validation and error handling  
- **Rust Unit Tests**: Service initialization, error handling, logging functionality

## Technology Stack

- **Framework**: Tauri 2.x with Rust backend and React frontend
- **Backend Language**: Rust 2021 edition with async/await
- **Frontend**: React 18 with TypeScript and CSS modules
- **AI Integration**: ONNX Runtime with CoreML acceleration
- **Database**: LanceDB for vector storage and semantic search
- **Build Tools**: Vite for frontend bundling, Cargo for Rust compilation
- **Testing**: Vitest for frontend tests, Cargo test for backend

## Configuration

### Environment Setup

```bash
# Database and models directory (automatically created)
export NODESPACE_DB_PATH="/path/to/data/lance_db"
export NODESPACE_MODELS_PATH="/path/to/models"
```

### Performance Tuning

```rust
// Configurable performance settings
let config = PerformanceConfig {
    max_search_results: 100,
    auto_save_delay_ms: 500,
    background_init_timeout_ms: 30000,
};
```

## File Structure

```
src-tauri/
├── src/
│   ├── lib.rs          # Main application logic and Tauri commands
│   ├── logging.rs      # Structured logging configuration
│   ├── error.rs        # Error handling and types
│   └── tests.rs        # Unit tests
├── Cargo.toml          # Rust dependencies and metadata
└── tauri.conf.json     # Tauri application configuration

src/
├── App.tsx             # Main React application component
├── components/         # Reusable UI components
├── hooks/              # Custom React hooks
├── integration/        # Integration test suites
└── utils/              # Utility functions and testing helpers
```

## Contributing

This repository follows production-ready development practices:

1. **Code Quality**: All code must pass `cargo clippy -- -D warnings` and formatting
2. **Testing**: Comprehensive test coverage for both frontend and backend
3. **Documentation**: Clear API documentation and usage examples
4. **Error Handling**: Graceful error management with user-friendly messages

---

*NodeSpace Desktop App provides a powerful, AI-enhanced desktop knowledge management experience through seamless integration of hierarchical organization, semantic search, and conversational AI capabilities.*