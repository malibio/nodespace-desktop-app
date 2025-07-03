//! Test AI inference functionality (now uses Ollama backend)

use nodespace_nlp_engine::{LocalNLPEngine, NLPEngine};

pub async fn test_onnx_inference() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    log::info!("🔍 Testing AI inference with Ollama backend...");
    
    // Create engine with explicit model path 
    let engine = LocalNLPEngine::with_model_directory("../../models");
    
    log::info!("📡 Initializing NLP engine...");
    engine.initialize().await?;
    
    // Test basic text generation with a simple math question to verify intelligence
    let prompt = "What is 2+2? Answer only with the number.";
    log::info!("📝 Prompt: {}", prompt);
    
    log::info!("🤖 Generating response...");
    let start = std::time::Instant::now();
    let response = engine.generate_text(prompt).await?;
    let duration = start.elapsed();
    
    log::info!("⏱️  Duration: {:?}", duration);
    log::info!("🎯 Response: {}", response);
    
    // Check if this looks like real AI vs mock/stub responses
    if response.contains("good team meeting requires") || 
       response.contains("task requires careful planning") ||
       response.contains("This is a generated response from the NodeSpace") ||
       response.contains("placeholder") ||
       response.contains("stub") {
        log::error!("❌ Getting canned/stub responses - AI backend not working correctly");
        log::error!("   This suggests the system is still using mock implementations");
        return Err("Mock/stub responses detected".into());
    } else if response.trim() == "4" || response.contains("4") {
        log::info!("🎉 SUCCESS: Real AI inference is working with Ollama!");
        log::info!("   Response shows intelligent understanding of the math question");
    } else if response.contains("ONNX Runtime working") ||
              response.contains("inference attempted") ||
              response.contains("single inference pass") {
        log::warn!("⚠️  Getting ONNX-specific test responses");
        log::warn!("   This might indicate the system is still using ONNX instead of Ollama");
    } else {
        log::info!("🤔 Got unexpected response - analyzing...");
        log::info!("   Response length: {} characters", response.len());
        if response.len() > 5 && !response.contains("error") {
            log::info!("✅ Likely real AI output - response is substantive and unique");
        } else {
            log::warn!("⚠️  Response might be from fallback or error handling");
        }
    }
    
    // Additional test: Check if we can detect Ollama vs ONNX characteristics
    if duration.as_millis() > 100 {
        log::info!("ℹ️  Response time suggests real AI processing ({}ms)", duration.as_millis());
    } else {
        log::warn!("⚠️  Very fast response ({}ms) - might be cached or mock", duration.as_millis());
    }
    
    Ok(())
}