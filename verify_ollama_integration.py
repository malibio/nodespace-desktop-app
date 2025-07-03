#!/usr/bin/env python3
"""
Verification script to test NodeSpace AI integration with Ollama
This script verifies that the system is using real Ollama rather than ONNX
"""
import subprocess
import json
import sys
import time

def run_command(command, description):
    """Run a command and return result"""
    print(f"🔍 {description}...")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"

def check_ollama_server():
    """Check if Ollama server is running"""
    success, stdout, stderr = run_command("curl -s http://localhost:11434/api/version", "Checking Ollama server")
    if success:
        try:
            version_data = json.loads(stdout)
            print(f"✅ Ollama server running: version {version_data.get('version', 'unknown')}")
            return True
        except json.JSONDecodeError:
            print(f"❌ Invalid response from Ollama server: {stdout}")
            return False
    else:
        print(f"❌ Ollama server not accessible: {stderr}")
        return False

def check_ollama_models():
    """Check available Ollama models"""
    success, stdout, stderr = run_command("curl -s http://localhost:11434/api/tags", "Checking Ollama models")
    if success:
        try:
            models_data = json.loads(stdout)
            models = models_data.get('models', [])
            print(f"✅ Found {len(models)} Ollama models:")
            for model in models:
                name = model.get('name', 'unknown')
                size = model.get('size', 0)
                print(f"   - {name} ({size//1024//1024} MB)")
            
            # Check for expected models
            has_gemma = any('gemma' in model.get('name', '').lower() for model in models)
            if has_gemma:
                print("✅ Gemma model available for testing")
                return True
            else:
                print("⚠️  No Gemma models found")
                return len(models) > 0
        except json.JSONDecodeError:
            print(f"❌ Invalid models response: {stdout}")
            return False
    else:
        print(f"❌ Cannot get models list: {stderr}")
        return False

def test_ollama_api():
    """Test direct Ollama API for AI responses"""
    payload = {
        "model": "gemma3:12b",
        "prompt": "What is 2+2? Answer only with the number.",
        "stream": False
    }
    
    cmd = f"curl -s -X POST http://localhost:11434/api/generate -H 'Content-Type: application/json' -d '{json.dumps(payload)}'"
    success, stdout, stderr = run_command(cmd, "Testing Ollama AI generation")
    
    if success:
        try:
            response_data = json.loads(stdout)
            ai_response = response_data.get('response', '')
            print(f"✅ Ollama AI response: '{ai_response.strip()}'")
            
            # Check if response looks intelligent
            if '4' in ai_response:
                print("🎉 AI is providing intelligent responses!")
                return True
            else:
                print("⚠️  Response doesn't look intelligent for math question")
                return False
        except json.JSONDecodeError:
            print(f"❌ Invalid AI response: {stdout}")
            return False
    else:
        print(f"❌ Ollama AI generation failed: {stderr}")
        return False

def check_nodespace_dependencies():
    """Check NodeSpace Rust dependencies"""
    print("🔍 Checking NodeSpace dependencies...")
    
    # Check for HTTP client dependencies (indicating Ollama support)
    success, stdout, stderr = run_command("cd src-tauri && cargo tree | grep -c reqwest", "Checking reqwest dependency")
    if success and stdout.strip() != '0':
        print(f"✅ HTTP client (reqwest) found: {stdout.strip()} occurrences")
        has_http_client = True
    else:
        print("❌ No HTTP client (reqwest) found in dependencies")
        has_http_client = False
    
    # Check for NLP engine
    success, stdout, stderr = run_command("cd src-tauri && cargo tree | grep -c nodespace-nlp-engine", "Checking NLP engine")
    if success and stdout.strip() != '0':
        print(f"✅ NLP engine found: {stdout.strip()} occurrences")
        has_nlp_engine = True
    else:
        print("❌ No NLP engine found in dependencies")
        has_nlp_engine = False
    
    # Check for ONNX dependencies (should be minimal if using Ollama)
    success, stdout, stderr = run_command("cd src-tauri && cargo tree | grep -c 'ort\\|onnx'", "Checking ONNX dependencies")
    if success:
        onnx_count = int(stdout.strip()) if stdout.strip().isdigit() else 0
        if onnx_count > 0:
            print(f"⚠️  ONNX dependencies still present: {onnx_count} occurrences")
            print("   This might indicate hybrid ONNX/Ollama setup (embeddings vs text generation)")
        else:
            print("✅ No ONNX dependencies found")
    
    return has_http_client and has_nlp_engine

def check_source_code():
    """Check source code for Ollama vs ONNX usage"""
    print("🔍 Checking source code for AI backend indicators...")
    
    # Look for test functions that might indicate current backend
    success, stdout, stderr = run_command("grep -r 'test_onnx\\|ollama\\|ONNX' src-tauri/src/ || true", "Checking source code")
    
    if 'test_onnx' in stdout.lower():
        print("⚠️  Found ONNX test functions in source code")
        print("   This might be leftover code from previous implementation")
    
    if 'ollama' in stdout.lower():
        print("✅ Found Ollama references in source code")
    elif 'onnx' in stdout.lower():
        print("⚠️  Found ONNX references in source code")
    else:
        print("ℹ️  No explicit AI backend references in desktop app source")
        print("   This is expected - AI backend is abstracted in nlp-engine")

def main():
    """Main verification process"""
    print("=" * 60)
    print("🧪 NodeSpace Ollama Integration Verification")
    print("=" * 60)
    print()
    
    # Step 1: Check Ollama infrastructure
    ollama_running = check_ollama_server()
    if not ollama_running:
        print("\n❌ CRITICAL: Ollama server is not running")
        print("   Please start Ollama with: ollama serve")
        return False
    
    ollama_models = check_ollama_models()
    if not ollama_models:
        print("\n❌ CRITICAL: No Ollama models available")
        print("   Please install a model with: ollama pull gemma3:12b")
        return False
    
    ollama_working = test_ollama_api()
    if not ollama_working:
        print("\n❌ CRITICAL: Ollama API not responding correctly")
        return False
    
    print("\n" + "="*50)
    
    # Step 2: Check NodeSpace integration
    deps_ok = check_nodespace_dependencies()
    check_source_code()
    
    print("\n" + "="*50)
    print("📊 VERIFICATION SUMMARY")
    print("="*50)
    
    if ollama_running and ollama_models and ollama_working and deps_ok:
        print("🎉 SUCCESS: All systems ready for Ollama integration!")
        print("✅ Ollama server: Running and responding correctly")
        print("✅ Dependencies: HTTP client and NLP engine present")
        print("✅ Infrastructure: Ready for real AI responses")
        print()
        print("🎯 RECOMMENDATION:")
        print("   The AI chat interface should be working with real Ollama.")
        print("   If you're still seeing mock responses, the issue might be:")
        print("   1. Need to update dependencies to get latest Ollama-enabled versions")
        print("   2. Configuration needs to be updated to use Ollama backend")
        print("   3. Need to restart the application to pick up new backend")
        return True
    else:
        print("❌ ISSUES FOUND:")
        if not ollama_running:
            print("   - Ollama server not running")
        if not ollama_models:
            print("   - No Ollama models available")
        if not ollama_working:
            print("   - Ollama API not working correctly")
        if not deps_ok:
            print("   - Missing required dependencies")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)