# CLAUDE.md

🚨 **STOP - READ WORKFLOW FIRST** 🚨
Before doing ANYTHING else, you MUST read the development workflow:
1. Read: `../nodespace-system-design/docs/development-workflow.md`
2. Check Linear for current tasks
3. Then return here for implementation guidance

❌ **FORBIDDEN:** Any code analysis, planning, or implementation before reading the workflow

## Development Workflow
**ALWAYS start with README.md** - This file contains the authoritative development workflow and setup instructions for this repository.

**Then return here** for repository-specific guidance and architecture details.

## Project Overview

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This project uses Tauri for the desktop application framework with Rust backend and frontend integration.

```bash
# Install Tauri CLI (required for development)
cargo install tauri-cli

# Install frontend dependencies
npm install

# Start development mode with hot reload
cargo tauri dev

# Build for production
cargo tauri build

# Run Rust backend tests
cargo test

# Run frontend tests
npm test

# Integration tests
cargo test --test integration

# End-to-end tests
npm run test:e2e
```

## Architecture Overview

This is the main desktop application entry point for the NodeSpace system. It serves as:

- **Application Shell**: Tauri-based cross-platform desktop application
- **Service Coordinator**: Initializes and manages all NodeSpace backend services
- **Bridge Layer**: Provides 20+ Tauri commands for frontend-backend communication
- **System Integration**: Handles OS-specific features, file system access, and notifications

### NodeSpace System Context

This repository is part of a larger NodeSpace ecosystem:

1. `nodespace-core-types` - Shared data structures and interfaces
2. `nodespace-data-store` - Database and vector storage
3. `nodespace-nlp-engine` - AI/ML processing and LLM integration
4. `nodespace-workflow-engine` - Automation and event processing
5. `nodespace-core-logic` - Business logic orchestration
6. `nodespace-core-ui` - React components and UI
7. `nodespace-desktop-app` - This repository (main application shell)

### Key Implementation Areas

- **Service Initialization**: Start all backend services on app launch
- **Tauri Commands**: Frontend-backend communication interface
- **Error Handling**: Graceful error propagation to frontend
- **State Management**: Application state and service coordination
- **Lifecycle Management**: Startup, shutdown, and state persistence

## 🎯 FINDING YOUR NEXT TASK

**See [development-workflow.md](../nodespace-system-design/docs/development-workflow.md)** for task management workflow.

## Project Management

- Review [NodeSpace System Design](../nodespace-system-design/README.md) for full architecture context
- Check [Development Workflow](../nodespace-system-design/docs/development-workflow.md) for processes
- Study [Key Contracts](../nodespace-system-design/contracts/) for interface definitions