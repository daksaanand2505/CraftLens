/**
 * ============================================================
 * CraftLens Voice Model Adapter Service
 * ============================================================
 * Interfaces CraftLens with the teammate's Voice Model
 * (faster-whisper speech-to-text / translation + information extraction)
 * 
 * Target flow:
 * Browser MediaRecorder (audio/webm)
 *        ↓
 * CraftLens backend
 *        ↓
 * voiceModelService.processVoice(payload)
 *        ↓
 * Teammate Voice Model (FastAPI / local runner)
 *        ↓
 * Canonical voiceData: { originalText, language, translatedText, normalizedText }
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// Provider-agnostic environment configuration
const VOICE_MODEL_PROVIDER = process.env.VOICE_MODEL_PROVIDER || "teammate_faster_whisper";
const VOICE_MODEL_ENDPOINT = process.env.VOICE_MODEL_ENDPOINT || "http://127.0.0.1:8000/api/voice/process";
const VOICE_MODEL_API_KEY = process.env.VOICE_MODEL_API_KEY || null;
const VOICE_MODEL_NAME = process.env.VOICE_MODEL_NAME || "faster-whisper-small";
const VOICE_MODEL_TIMEOUT_MS = parseInt(process.env.VOICE_MODEL_TIMEOUT_MS, 10) || 60000;

/**
 * Saves base64 audio payload to a temporary file on disk for model consumption.
 * 
 * @param {string} audioData - Base64 string or Data URL
 * @param {string} mimeType - e.g. "audio/webm;codecs=opus"
 * @returns {string|null} Temporary file path
 */
function saveTempAudio(audioData, mimeType = "audio/webm") {
  if (!audioData || typeof audioData !== "string") {
    return null;
  }

  try {
    let base64Content = audioData;
    let extension = ".webm";

    if (audioData.includes(",")) {
      const parts = audioData.split(",");
      const meta = parts[0];
      base64Content = parts[1];

      if (meta.includes("wav")) {
        extension = ".wav";
      } else if (meta.includes("mp3")) {
        extension = ".mp3";
      } else if (meta.includes("ogg")) {
        extension = ".ogg";
      }
    } else if (mimeType && mimeType.includes("wav")) {
      extension = ".wav";
    }

    const buffer = Buffer.from(base64Content, "base64");
    if (buffer.length === 0) {
      return null;
    }

    const tempDir = path.join(os.tmpdir(), "craftlens_audio");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${extension}`);
    fs.writeFileSync(tempFilePath, buffer);

    return tempFilePath;
  } catch (err) {
    console.error("Failed to write temporary audio file:", err.message);
    return null;
  }
}

/**
 * Safely removes a temporary audio file.
 */
function cleanupTempAudio(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Process voice audio payload through the provider-agnostic Voice Model adapter.
 * 
 * @param {Object} input
 * @param {string} [input.audio] - Base64 audio string or Data URL
 * @param {string} [input.audioMimeType] - MIME type from browser MediaRecorder
 * @param {string} [input.languageHint] - Artisan's chosen language
 * @param {string} [input.transcript] - Typed or pre-existing story description
 * @returns {Promise<Object>} Canonical voiceData payload
 */
async function processVoice(input = {}) {
  const language = input.languageHint || input.language || "English";
  const artisanText = (input.transcript || "").trim();
  const hasAudio = Boolean(input.audio);

  let tempAudioPath = null;
  console.log(`[VOICE] Processing voice input (audio: ${hasAudio ? "yes" : "no"}, mime: ${input.audioMimeType || "unknown"}, langHint: ${language})`);

  try {
    if (hasAudio) {
      tempAudioPath = saveTempAudio(input.audio, input.audioMimeType || "audio/webm");
    }

    // 1. Attempt to invoke actual Voice Model endpoint if audio is present
    if (tempAudioPath) {
      try {
        console.log(`[VOICE] Dispatching audio to Voice Model endpoint: ${VOICE_MODEL_ENDPOINT}`);
        const modelResult = await callVoiceModelEndpoint(tempAudioPath, input.audioMimeType, language, artisanText);
        if (modelResult && (modelResult.transcript || modelResult.originalText || modelResult.translatedText)) {
          const rawText = modelResult.transcript || modelResult.originalText || modelResult.translatedText || "";
          const transText = modelResult.translatedText || rawText;

          console.log(`[VOICE] Voice Model success! Transcript: "${rawText.slice(0, 80)}", extracted:`, modelResult.extraction);

          return {
            transcript: rawText,
            language: modelResult.language || modelResult.detectedLanguage || language,
            translatedText: transText,
            normalizedText: (modelResult.normalizedText || transText).toLowerCase().trim(),
            extraction: modelResult.extraction || modelResult.extractedEntities || null,
            confidence: typeof modelResult.confidence === "number" ? modelResult.confidence : 0.95,
            source: "voice_model",
            model: VOICE_MODEL_NAME,
            status: "success",
            isModelConnected: true,
            // Aliases for compatibility
            originalText: rawText,
            extractedEntities: modelResult.extraction || modelResult.extractedEntities || null,
            metadata: {
              provider: VOICE_MODEL_PROVIDER,
              endpoint: VOICE_MODEL_ENDPOINT,
              audioPreserved: true,
              mimeType: input.audioMimeType || null,
            },
          };
        }
      } catch (networkErr) {
        console.warn(`[VOICE] Provider endpoint (${VOICE_MODEL_ENDPOINT}) unavailable: ${networkErr.message}`);
        // Fall through to honest fallback
      }
    }

    // 1b. If no audio, but artisan text is provided, attempt entity extraction via Voice Server
    if (!hasAudio && artisanText) {
      try {
        console.log(`[VOICE] Requesting entity extraction from Voice Server for text: "${artisanText.slice(0, 50)}"`);
        const textResult = await callVoiceModelTextEndpoint(artisanText, language);
        if (textResult && textResult.extraction) {
          return {
            transcript: artisanText,
            language: textResult.language || language,
            translatedText: textResult.translatedText || artisanText,
            normalizedText: (textResult.normalizedText || artisanText).toLowerCase().trim(),
            extraction: textResult.extraction || textResult.extractedEntities || null,
            confidence: 1.0,
            source: "artisan_input",
            model: "entity_extractor",
            status: "success",
            isModelConnected: true,
            originalText: artisanText,
            extractedEntities: textResult.extraction || textResult.extractedEntities || null,
            metadata: {
              provider: VOICE_MODEL_PROVIDER,
              endpoint: VOICE_MODEL_ENDPOINT,
              audioPreserved: false,
            },
          };
        }
      } catch (textErr) {
        console.warn(`[VOICE] Text extraction endpoint unavailable: ${textErr.message}`);
      }
    }

    // 2. Truthful Voice Fallback:
    // If Voice Model API fails or is offline, or no audio is provided:
    // - Preserve original audio
    // - Use typed artisan input when available
    // - Return status: "fallback", notice: "Voice processing unavailable"
    console.log(`[VOICE] Fallback mode active. Typed text: "${artisanText.slice(0, 40)}", audioPreserved: ${hasAudio}`);
    return {
      transcript: artisanText || "",
      language: language || null,
      translatedText: artisanText || null,
      normalizedText: (artisanText || "").toLowerCase().trim(),
      extraction: null,
      confidence: null,
      source: artisanText ? "artisan_input" : "not_available",
      model: null,
      status: "fallback",
      notice: "Voice processing unavailable",
      originalAudioPreserved: hasAudio,
      isModelConnected: false,
      // Backward compatibility
      originalText: artisanText || "",
      extractedEntities: null,
      message: "Voice processing is temporarily unavailable. Your recording is still saved for retry.",
      metadata: {
        audioPreserved: hasAudio,
        mimeType: input.audioMimeType || null,
      },
    };
  } finally {
    cleanupTempAudio(tempAudioPath);
  }
}

/**
 * Invokes the configured Voice Model HTTP service.
 */
async function callVoiceModelEndpoint(filePath, mimeType, languageHint, fallbackText = "") {
  const fileBuffer = fs.readFileSync(filePath);
  const base64Audio = fileBuffer.toString("base64");

  const headers = {
    "Content-Type": "application/json",
  };

  if (VOICE_MODEL_API_KEY) {
    headers["Authorization"] = `Bearer ${VOICE_MODEL_API_KEY}`;
  }

  const response = await fetch(VOICE_MODEL_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      audio: base64Audio,
      mimeType: mimeType || "audio/webm",
      languageHint: languageHint || "English",
      fileName: path.basename(filePath),
      text: fallbackText || "",
    }),
    signal: AbortSignal.timeout(VOICE_MODEL_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Voice Model returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    transcript: data.transcript || data.originalText || data.text || "",
    originalText: data.originalText || data.transcript || data.text || "",
    language: data.language || data.detectedLanguage || languageHint,
    detectedLanguage: data.detectedLanguage || data.language || languageHint,
    translatedText: data.translatedText || data.englishText || data.text || "",
    normalizedText: data.normalizedText || "",
    extraction: data.extraction || data.extractedEntities || data.product || null,
    extractedEntities: data.extraction || data.extractedEntities || data.product || null,
    confidence: data.confidence,
    raw: data,
  };
}

/**
 * Invokes the configured Voice Model HTTP service with raw text for entity extraction.
 */
async function callVoiceModelTextEndpoint(text, languageHint) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (VOICE_MODEL_API_KEY) {
    headers["Authorization"] = `Bearer ${VOICE_MODEL_API_KEY}`;
  }

  const response = await fetch(VOICE_MODEL_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text,
      languageHint: languageHint || "English",
    }),
    signal: AbortSignal.timeout(VOICE_MODEL_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Voice Model returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    transcript: data.transcript || data.originalText || text,
    originalText: data.originalText || text,
    language: data.language || data.detectedLanguage || languageHint,
    translatedText: data.translatedText || text,
    normalizedText: data.normalizedText || text.toLowerCase().trim(),
    extraction: data.extraction || data.extractedEntities || data.product || null,
    confidence: data.confidence,
    raw: data,
  };
}

module.exports = {
  processVoice,
  saveTempAudio,
  cleanupTempAudio,
};
