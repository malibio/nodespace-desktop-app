# ⚠️ BEFORE STARTING ANY WORK
👉 **STEP 1**: Read development workflow: `../nodespace-system-design/docs/development-workflow.md`
👉 **STEP 2**: Check Linear for assigned tasks
👉 **STEP 3**: Repository-specific patterns below

**This README.md only contains**: Repository-specific Tauri and desktop integration patterns

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

## 🚀 Getting Started

### **New to NodeSpace? Start Here:**
1. **Read [NodeSpace System Design](../nodespace-system-design/README.md)** - Understand the full architecture
2. **Check [Linear workspace](https://linear.app/nodespace)** - Find your current tasks (filter by `nodespace-desktop-app`)
3. **Review [Development Workflow](../nodespace-system-design/docs/development-workflow.md)** - Process and procedures
4. **Study [Key Contracts](../nodespace-system-design/contracts/)** - Interface definitions you'll implement
5. **See [MVP User Flow](../nodespace-system-design/examples/mvp-user-flow.md)** - What you're building

### **Development Setup:**
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

## 🏗️ Architecture Context

Part of the [NodeSpace system architecture](../nodespace-system-design/README.md):

1. `nodespace-core-types` - Shared data structures and interfaces
2. `nodespace-data-store` - Database and vector storage
3. `nodespace-nlp-engine` - AI/ML processing and LLM integration
4. `nodespace-workflow-engine` - Automation and event processing
5. `nodespace-core-logic` - Business logic orchestration
6. `nodespace-core-ui` - React components and UI
7. **`nodespace-desktop-app`** ← **You are here**

## 🔄 MVP Implementation

The desktop app implements the complete application:

1. **Service initialization** - Start all backend services on app launch
2. **Tauri commands** - Implement all frontend-backend communication
3. **Error handling** - Graceful error propagation to frontend
4. **State management** - Application state and service coordination
5. **Shutdown handling** - Clean service shutdown and state persistence

## 🧪 Testing

### Backend Tests (Rust)
```bash
# Run all Rust tests
cargo test

# Run specific test module
cargo test tests::

# Run tests with output
cargo test -- --nocapture
```

### Frontend Tests (TypeScript/React)
```bash
# Run all frontend tests
npm test

# Watch mode for development
npm run test:watch

# Test with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Run only integration tests
npm run test:integration
```

### Full Test Suite
```bash
# Run all tests (backend + frontend)
npm run test:all

# Individual test suites
npm run test:backend  # Rust tests only
npm test              # Frontend tests only
```

### Test Structure
- **Rust Unit Tests**: `src-tauri/src/tests.rs`, `src-tauri/src/error.rs`
- **Frontend Component Tests**: `src/App.test.tsx`, `src/utils/testing.test.ts`
- **Integration Tests**: `src/integration/tauri-commands.test.ts`
- **Test Utilities**: `src/utils/testing.ts`, `src/setupTests.ts`

---

**Project Management:** All development tasks tracked in [Linear workspace](https://linear.app/nodespace)