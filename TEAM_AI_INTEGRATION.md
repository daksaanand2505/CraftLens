# CraftLens — Teammate AI Integration Guide
**Developer Handshake Document**

> **Note to Teammate**: You have built both the **Voice AI Model** and the **Recommendation AI Model**. The CraftLens frontend UI/UX and backend persistence layer have been fully stabilized and prepared. Clean adapter hooks are already wired into the application lifecycle (`server/services/voiceModelService.cjs` and `server/services/recommendationModelService.cjs`).
>
> To integrate your models seamlessly without modifying frontend UI or breaking data persistence, please provide the exact specifications listed below.

---

## 1. Voice AI Model Integration Checklist

The Voice Model will be invoked right after an artisan records their craft story using the browser microphone.

### Please Provide:
1. **Model Location & Hosting**:
   - Is the model packaged as a local Python script/module, a standalone FastAPI / Flask microservice, a Docker container, or an external API?
   - Local port / default endpoint (e.g. `http://localhost:8000/transcribe` or `http://127.0.0.1:5001/api/voice`).
2. **Execution & Setup Instructions**:
   - Environment requirements (`requirements.txt`, PyTorch version, HuggingFace weights, CUDA requirements, etc.).
   - Exact launch command (e.g. `uvicorn main:app --port 8000` or `python voice_server.py`).
3. **Audio Format Requirements**:
   - Current browser capture: WebM (`audio/webm;codecs=opus`).
   - Does your model accept WebM directly, or does it require WAV / MP3 / PCM (16kHz mono)?
   - Maximum audio duration / payload size.
4. **Input Payload Contract**:
   - HTTP transport mode: `multipart/form-data` with file upload, or JSON with base64-encoded audio?
   - Parameter names (e.g. `audio_file`, `language_hint`).
5. **Output Schema & Fields**:
   - What fields does your model return? Expected target mapping:
     - `originalText` (native transcription, e.g. Tamil / Hindi / English)
     - `detectedLanguage` / `language`
     - `translatedText` (English translation for catalogue generation)
     - `confidence` (float between 0.0 and 1.0)
     - Any extracted craft entities (e.g. materials mentioned, production time).
6. **Supported Languages**:
   - List of supported Indic and global languages (e.g. Tamil, Hindi, Telugu, Bengali, English).

---

## 2. Recommendation AI Model Integration Checklist

The Recommendation Model will be invoked during the product preparation step to optimize pricing and material planning.

### Please Provide:
1. **Model Location & Hosting**:
   - Is this hosted as a FastAPI / Flask service, a Python CLI script, or an ONNX / PyTorch model?
   - Local port / default endpoint (e.g. `http://localhost:8000/recommend` or `http://127.0.0.1:5002/api/pricing`).
2. **Execution & Setup Instructions**:
   - Dependencies, virtual environment, pre-trained weights location.
   - Exact start command.
3. **Input Features Expected**:
   - The CraftLens canonical product payload provides:
     ```json
     {
       "productProfile": {
         "title": "Bamboo Basket",
         "category": "Home Decor",
         "craftType": "Bamboo Craft",
         "materials": ["Bamboo"],
         "dimensions": "30 cm × 25 cm",
         "productionTime": "2 days",
         "description": "..."
       },
       "actualCosts": {
         "materialCost": 360,
         "labourCost": 300,
         "packagingCost": 50,
         "platformCost": 40,
         "overheadCost": 60,
         "totalCost": 810
       },
       "inventoryContext": [
         { "name": "Bamboo", "quantity": 25, "unit": "kg", "costPerUnit": 120 }
       ]
     }
     ```
   - Are any additional feature vectors required (e.g. artisan location, marketplace category index, seasonal flags)?
4. **Output Schema & Pricing Tiers**:
   - Does your model return recommended price points or margin percentages?
   - Expected structure for:
     - `minimumPrice` (cost recovery floor)
     - `recommendedPrice` (market-clearing optimal price)
     - `premiumPrice` (heritage/uniqueness ceiling)
     - `confidence` / prediction interval
     - `reasoning` / feature explanation string
5. **Material Optimization Output**:
   - Structure for recommended material allocation, unit quantities, and reorder flags.

---

## 3. Architecture & Ready Adapter Interfaces

Both models connect into existing, tested adapter services:

```
Artisan Voice Story ─────────► server/services/voiceModelService.cjs ────────► [ Teammate Voice Model ]
                                          │
                                          ▼
                               Canonical Product Profile
                                          │
                                          ▼
Cost Breakdown + Inventory ──► server/services/recommendationModelService.cjs ─► [ Teammate Rec Model ]
                                          │
                                          ▼
                               Deterministic Validation
                                          │
                                          ▼
                                Artisan Approval & Publish
```

- **Voice Model Adapter**: [`server/services/voiceModelService.cjs`](file:///c:/Users/keert/OneDrive/Desktop/craftlens/craftlens/server/services/voiceModelService.cjs)
  - Configurable via `process.env.VOICE_MODEL_ENDPOINT`.
- **Recommendation Model Adapter**: [`server/services/recommendationModelService.cjs`](file:///c:/Users/keert/OneDrive/Desktop/craftlens/craftlens/server/services/recommendationModelService.cjs)
  - Configurable via `process.env.RECOMMENDATION_MODEL_ENDPOINT`.

---

## 4. Ground Rules for Teammate Integration
1. **Zero UI Changes**: Frontend visual components and layouts are locked and complete.
2. **Zero Breaking Data Changes**: The canonical product contract must be respected.
3. **Graceful Fallbacks**: If a model endpoint is unreachable or timing out, the system will fall back to artisan text input and deterministic cost calculations rather than failing.

