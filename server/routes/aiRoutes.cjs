const express = require("express");

const {
  analyzeProductImage,
  processVoice,
  buildProductProfile,
  generateListing,
  calculatePricing,
  generateMaterialRecommendations,
} = require("../services/aiService.cjs");

const router = express.Router();

router.post("/process-product", async (req, res) => {
  try {
    const {
      image,
      imageName,
      audio,
      audioMimeType,
      transcript,
      artisanVoiceTranscript,
      language,
      pricing,
      artisanInput = {},
    } = req.body;

    const effectiveTranscript = (transcript || artisanVoiceTranscript || "").trim();

    // 1. IMAGE UNDERSTANDING (Conservative / Evidence-based)
    const imageAnalysis = await analyzeProductImage({
      image,
      imageName,
    });

    // 2. VOICE / SPEECH UNDERSTANDING (Teammate Voice Model Adapter)
    const voiceAnalysis = await processVoice({
      audio,
      audioMimeType,
      transcript: effectiveTranscript,
      languageHint: language,
    });

    // 3. CANONICAL PRODUCT PROFILE SYNTHESIS (Artisan input wins)
    const productProfile = await buildProductProfile({
      imageAnalysis,
      voiceAnalysis,
      artisanInput: {
        ...artisanInput,
        description: (artisanInput.description || effectiveTranscript || "").trim(),
        language,
      },
    });

    // 4. LISTING GENERATION
    const listing = generateListing(productProfile, voiceAnalysis);

    // 5. PROFIT-AWARE PRICING (Deterministic formula)
    const pricingInput = {
      ...(pricing || {}),
      artisanSellingPrice:
        pricing?.artisanSellingPrice ??
        productProfile.artisanSellingPrice ??
        voiceAnalysis.extraction?.product?.price_per_unit ??
        null,
    };
    const pricingResult = calculatePricing(pricingInput);

    // 6. MATERIAL & INVENTORY RECOMMENDATION (Deterministic engine grounded in materials.json)
    const materialsPlan = generateMaterialRecommendations({
      productProfile,
      actualCosts: pricing || {},
    });

    // 7. CANONICAL RESPONSE
    res.json({
      success: true,
      message: "Product processed successfully",
      productProfile,
      voiceData: {
        transcript: voiceAnalysis.transcript || voiceAnalysis.originalText || "",
        language: voiceAnalysis.language || language || "English",
        translatedText: voiceAnalysis.translatedText || "",
        normalizedText: voiceAnalysis.normalizedText || "",
        extraction: voiceAnalysis.extraction || voiceAnalysis.extractedEntities || null,
        confidence: voiceAnalysis.confidence,
        source: voiceAnalysis.source,
        model: voiceAnalysis.model || null,
        status: voiceAnalysis.status,
        originalText: voiceAnalysis.originalText || voiceAnalysis.transcript || "",
        extractedEntities: voiceAnalysis.extraction || voiceAnalysis.extractedEntities || null,
      },
      imageAnalysis,
      voiceAnalysis,
      listing,
      pricing: pricingResult,
      recommendations: materialsPlan.recommendations || [],
      materialsPlan,
      materialRecommendation: materialsPlan, // Backward compatibility for existing cards
      evidence: productProfile.evidence || {
        title: { source: "visual" },
        artisanStory: { source: voiceAnalysis.source || "artisan_input" },
        price: { source: "calculated", validatedBy: "pricing_engine" },
        materials: { source: "calculated" },
      },
      aiMetadata: {
        voiceModelStatus: voiceAnalysis.isModelConnected ? "connected" : "fallback",
        voiceModelProvider: voiceAnalysis.metadata?.provider || "teammate_faster_whisper",
        voiceModelName: voiceAnalysis.model || "faster-whisper-small",
        recommendationStatus: materialsPlan.aiMetadata?.recommendationStatus || "deterministic",
        recommendationEngine: materialsPlan.engineType || "deterministic_inventory_rules",
        imageModelStatus: imageAnalysis.provenance?.isModelConnected ? "configured_provider" : "fallback",
        voiceNotice: voiceAnalysis.notice || voiceAnalysis.message || null,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("AI product processing error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to process product",
    });
  }
});

module.exports = router;