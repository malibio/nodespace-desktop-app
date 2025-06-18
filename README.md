# NodeSpace Desktop App

**Tauri application shell and integration for NodeSpace**

This repository implements the Tauri desktop application that serves as the main entry point for NodeSpace. It provides the application shell, coordinates all backend services, and bridges the React frontend with Rust business logic.

## 🎯 Purpose

- **Application shell** - Main Tauri desktop application entry point
- **Service coordination** - Initialize and manage all backend services
- **Tauri commands** - Bridge React frontend with Rust backend logic
- **System integration** - Desktop-specific features and OS integration

## 📦 Key Features

- **Tauri application** - Cross-platform desktop app with web frontend
- **Service orchestration** - Coordinate all NodeSpace backend services
- **Command interface** - 20+ Tauri commands for frontend-backend communication
- **System integration** - File system access, notifications, and OS features
- **Application lifecycle** - Startup, shutdown, and state management

## 🔗 Dependencies

- **`nodespace-core-types`** - Data structures and command interfaces
- **`nodespace-core-logic`** - Business logic orchestration
- **`nodespace-core-ui`** - React frontend components
- **Tauri framework** - Desktop application framework

## 🏗️ Architecture Context

Part of the [NodeSpace system architecture](https://github.com/malibio/nodespace-system-design):

1. `nodespace-core-types` - Shared data structures and interfaces
2. `nodespace-data-store` - Database and vector storage
3. `nodespace-nlp-engine` - AI/ML processing and LLM integration
4. `nodespace-workflow-engine` - Automation and event processing
5. `nodespace-core-logic` - Business logic orchestration
6. `nodespace-core-ui` - React components and UI
7. **`nodespace-desktop-app`** ← **You are here**

## 🚀 Getting Started

```bash
# Install Tauri CLI
cargo install tauri-cli

# Install frontend dependencies
npm install

# Start development mode
cargo tauri dev

# Build for production
cargo tauri build
```

## 🔄 MVP Implementation

The desktop app implements the complete application:

1. **Service initialization** - Start all backend services on app launch
2. **Tauri commands** - Implement all frontend-backend communication
3. **Error handling** - Graceful error propagation to frontend
4. **State management** - Application state and service coordination
5. **Shutdown handling** - Clean service shutdown and state persistence

## 🧪 Testing

```bash
# Run Rust backend tests
cargo test

# Run frontend tests
npm test

# Integration tests
cargo test --test integration

# End-to-end tests
npm run test:e2e
```

## 📋 Development Status

- [ ] Set up Tauri project structure
- [ ] Implement all Tauri commands from core-types
- [ ] Integrate core-logic service
- [ ] Add frontend build integration
- [ ] Implement error handling
- [ ] Add comprehensive testing

---

**Project Management:** All tasks tracked in [NodeSpace Project](https://github.com/users/malibio/projects/4)