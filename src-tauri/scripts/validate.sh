#!/bin/bash

# NodeSpace Desktop App Validation Script
# Implements immediate prevention strategies for compilation errors

set -e  # Exit on any error

echo "🔍 NodeSpace Desktop App Validation Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Rust Backend Validation
echo -e "\n📦 Validating Rust Backend..."
cd src-tauri

print_status "Running cargo check --all-targets..."
cargo check --all-targets

print_status "Running cargo clippy with strict warnings..."
cargo clippy --all-targets -- -D warnings

print_status "Checking Rust formatting..."
cargo fmt --all -- --check

print_status "Running Rust tests..."
cargo test

cd ..

# 2. Frontend Validation
echo -e "\n🌐 Validating Frontend..."

print_status "Installing npm dependencies if needed..."
npm ci --quiet

print_status "Running TypeScript type checking..."
npm run type-check

print_status "Running frontend tests..."
npm test -- --run

print_status "Checking for security vulnerabilities..."
npm audit --audit-level=moderate

# 3. Integration Validation
echo -e "\n🔗 Integration Validation..."

print_status "Testing Tauri build compilation..."
cd src-tauri
cargo tauri build --debug
cd ..

# 4. Cross-Repository Dependency Validation
echo -e "\n🏗️  Cross-Repository Validation..."

print_status "Checking core-logic dependency..."
if [ -d "../nodespace-core-logic" ]; then
    cd ../nodespace-core-logic
    cargo check --all-targets
    cd - > /dev/null
else
    print_warning "core-logic repository not found at expected location"
fi

print_status "Checking core-types dependency..."
if [ -d "../nodespace-core-types" ]; then
    cd ../nodespace-core-types
    cargo check --all-targets
    cd - > /dev/null
else
    print_warning "core-types repository not found at expected location"
fi

echo -e "\n🎉 ${GREEN}All validations passed successfully!${NC}"
echo "✨ Desktop app is ready for development and deployment"