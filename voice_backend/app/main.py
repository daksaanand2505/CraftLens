import base64
import json
import os
import tempfile
from pathlib import Path

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


# ============================================================
# CRAFTLENS VOICE API
# ============================================================

app = FastAPI(
    title="CraftLens Voice Model API",
    version="1.0.0"
)


# ============================================================
# PATHS
# ============================================================

ROOT = Path(__file__).resolve().parents[2]

MODEL_NAME = "Qwen/Qwen2.5-1.5B-Instruct"

ADAPTER_PATH = (
    ROOT
    / "training"
    / "output"
    / "craftlens-lora"
)

WHISPER_MODEL_NAME = "small"


# ============================================================
# REQUEST SCHEMA
# ============================================================

class VoiceRequest(BaseModel):
    audio: str | None = None
    mimeType: str | None = "audio/webm"
    languageHint: str | None = "English"
    fileName: str | None = "voice.webm"
    text: str | None = ""


# ============================================================
# MODEL VARIABLES
# ============================================================

whisper_model = None
tokenizer = None
model = None


# ============================================================
# MODEL LOADING
# ============================================================

def load_models():

    global whisper_model
    global tokenizer
    global model

    # --------------------------------------------------------
    # HARD GPU SAFETY CHECK
    # --------------------------------------------------------
    #
    # This laptop has no NVIDIA CUDA GPU.
    # Therefore the AI models MUST NOT be loaded here.
    #
    # On a GPU machine, this function will continue normally.
    # --------------------------------------------------------

    if not torch.cuda.is_available():

        raise RuntimeError(
            "AI model loading is disabled because CUDA/NVIDIA GPU "
            "was not detected. Run the CraftLens voice model on "
            "a GPU-enabled machine."
        )

    # --------------------------------------------------------
    # Prevent duplicate model loading
    # --------------------------------------------------------

    if (
        whisper_model is not None
        and tokenizer is not None
        and model is not None
    ):
        return

    print("=" * 60)
    print("CRAFTLENS VOICE MODEL")
    print("=" * 60)

    print("\nCUDA detected.")
    print("GPU:", torch.cuda.get_device_name(0))

    # --------------------------------------------------------
    # Lazy AI imports
    # --------------------------------------------------------

    from faster_whisper import WhisperModel
    from transformers import (
        AutoTokenizer,
        AutoModelForCausalLM
    )
    from peft import PeftModel

    # --------------------------------------------------------
    # Whisper
    # --------------------------------------------------------

    print("\nLoading Faster-Whisper...")

    whisper_model = WhisperModel(
        WHISPER_MODEL_NAME,
        device="cpu",
        compute_type="int8"
    )

    print("Faster-Whisper loaded.")

    # --------------------------------------------------------
    # Check LoRA adapter
    # --------------------------------------------------------

    adapter_file = ADAPTER_PATH / "adapter_model.safetensors"

    if not adapter_file.exists():

        raise RuntimeError(
            f"CraftLens LoRA adapter not found:\n{ADAPTER_PATH}"
        )

    print("\nLoading CraftLens tokenizer...")

    tokenizer = AutoTokenizer.from_pretrained(
        str(ADAPTER_PATH),
        use_fast=True
    )

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    print("Tokenizer loaded.")

    # --------------------------------------------------------
    # Qwen base model
    # --------------------------------------------------------

    print("\nLoading Qwen base model...")

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        torch_dtype=torch.float16,
        device_map="auto"
    )

    print("Base model loaded.")

    # --------------------------------------------------------
    # LoRA
    # --------------------------------------------------------

    print("\nLoading CraftLens LoRA adapter...")

    model = PeftModel.from_pretrained(
        model,
        str(ADAPTER_PATH)
    )

    model.eval()

    print("CraftLens LoRA loaded successfully.")


# ============================================================
# SPEECH TO TEXT
# ============================================================

def speech_to_text(audio_file):

    segments, info = whisper_model.transcribe(
        audio_file,

        task="translate",

        language=None,

        beam_size=5,

        vad_filter=True,

        condition_on_previous_text=False,

        no_speech_threshold=0.6,

        log_prob_threshold=-1.0,

        compression_ratio_threshold=2.4,

        repetition_penalty=1.1
    )

    text_parts = []

    for segment in segments:

        segment_text = segment.text.strip()

        if segment_text:
            text_parts.append(segment_text)

    text = " ".join(text_parts).strip()

    text = remove_repeated_phrases(text)

    return (
        text,
        info.language,
        info.language_probability
    )


# ============================================================
# REMOVE WHISPER REPETITIONS
# ============================================================

def remove_repeated_phrases(text):

    words = text.split()

    if len(words) < 6:
        return text

    cleaned = []

    i = 0

    while i < len(words):

        # ----------------------------------------------------
        # Repeated single word
        # ----------------------------------------------------

        if (
            i + 3 < len(words)
            and words[i].lower()
            == words[i + 1].lower()
            == words[i + 2].lower()
            == words[i + 3].lower()
        ):

            cleaned.append(words[i])

            repeated_word = words[i].lower()

            while (
                i < len(words)
                and words[i].lower() == repeated_word
            ):
                i += 1

            continue

        # ----------------------------------------------------
        # Repeated two-word phrase
        # ----------------------------------------------------

        if i + 5 < len(words):

            pair1 = (
                words[i].lower(),
                words[i + 1].lower()
            )

            pair2 = (
                words[i + 2].lower(),
                words[i + 3].lower()
            )

            pair3 = (
                words[i + 4].lower(),
                words[i + 5].lower()
            )

            if pair1 == pair2 == pair3:

                cleaned.extend(
                    [
                        words[i],
                        words[i + 1]
                    ]
                )

                i += 6

                while (
                    i + 1 < len(words)
                    and (
                        words[i].lower(),
                        words[i + 1].lower()
                    ) == pair1
                ):
                    i += 2

                continue

        cleaned.append(words[i])

        i += 1

    return " ".join(cleaned).strip()


# ============================================================
# STRICT CRAFTLENS EXTRACTION
# ============================================================

SYSTEM_PROMPT = """
You are CraftLens, a STRICT information extraction system.

The user's input is an English transcription of an artisan's
spoken conversation.

Your ONLY task is to extract facts explicitly stated in the input.

ABSOLUTE ANTI-HALLUCINATION RULES:

1. NEVER invent information.
2. NEVER guess missing information.
3. If a value is NOT explicitly stated, ALWAYS return null.
4. NEVER infer information from context.
5. NEVER infer location from language, accent, currency, product,
   artisan, or assumed place.
6. NEVER infer payment method.
7. NEVER infer currency from location.
8. NEVER infer artisan name.
9. NEVER infer product size.
10. NEVER infer quantity per day.
11. NEVER infer payment status.
12. NEVER infer purchase date.
13. NEVER infer business location.
14. NEVER convert missing values into approximate values.
15. Preserve only information supported by the input.

FIELD DEFINITIONS:

artisan.name
Person's name ONLY if explicitly mentioned.

product.name
Product name ONLY if explicitly mentioned or clearly identified
as the product being described.

product.type
Product type/category explicitly stated or directly described.

product.size
Size ONLY if explicitly stated.

product.price_per_unit
Price of ONE product ONLY if explicitly stated.

product.currency
Currency ONLY when explicitly stated.
"rupees", "Rs", "₹" -> "INR".

product.quantity_per_day
Number of products the artisan explicitly says they can produce
per day.

business.location
Location ONLY when a place is explicitly mentioned.

business.payment_method
Payment method ONLY when explicitly mentioned.

FINAL OUTPUT RULES:

- Return ONLY valid JSON.
- No markdown.
- No explanation.
- No comments.
- No additional fields.
- Use EXACTLY the schema below.
- Use null for every unsupported/missing value.
- JSON values must be in English.

EXACT SCHEMA:

{
  "artisan": {
    "name": null
  },
  "product": {
    "name": null,
    "type": null,
    "size": null,
    "price_per_unit": null,
    "currency": null,
    "quantity_per_day": null
  },
  "business": {
    "location": null,
    "payment_method": null
  }
}
"""


# ============================================================
# EXTRACT INFORMATION
# ============================================================

def extract_information(user_text):

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": user_text
        }
    ]

    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer(
        prompt,
        return_tensors="pt"
    )

    device = next(model.parameters()).device

    inputs = {
        key: value.to(device)
        for key, value in inputs.items()
    }

    with torch.no_grad():

        outputs = model.generate(
            **inputs,

            max_new_tokens=300,

            do_sample=False,

            repetition_penalty=1.05,

            pad_token_id=tokenizer.pad_token_id,

            eos_token_id=tokenizer.eos_token_id
        )

    generated_tokens = outputs[0][
        inputs["input_ids"].shape[1]:
    ]

    response = tokenizer.decode(
        generated_tokens,
        skip_special_tokens=True
    ).strip()

    return clean_catalogue_json(response)


# ============================================================
# CLEAN / VALIDATE JSON
# ============================================================

def clean_catalogue_json(response):

    response = response.replace("```json", "")
    response = response.replace("```", "")
    response = response.strip()

    start = response.find("{")
    end = response.rfind("}")

    if start == -1 or end == -1:

        raise ValueError(
            "Model did not return valid JSON."
        )

    json_text = response[start:end + 1]

    data = json.loads(json_text)

    artisan = data.get("artisan", {})
    product = data.get("product", {})
    business = data.get("business", {})

    clean_data = {

        "artisan": {
            "name": artisan.get("name")
        },

        "product": {

            "name": product.get("name"),

            "type": product.get("type"),

            "size": product.get("size"),

            "price_per_unit": product.get(
                "price_per_unit"
            ),

            "currency": product.get("currency"),

            "quantity_per_day": product.get(
                "quantity_per_day"
            )
        },

        "business": {

            "location": business.get("location"),

            "payment_method": business.get(
                "payment_method"
            )
        }
    }

    def clean_value(value):

        if isinstance(value, str):

            value = value.strip()

            if value == "":
                return None

        return value

    for section in clean_data:

        for field in clean_data[section]:

            clean_data[section][field] = clean_value(
                clean_data[section][field]
            )

    return clean_data


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def root():

    return {
        "message": "CraftLens Voice Model API is running"
    }


@app.get("/api/health")
def health():

    cuda_available = torch.cuda.is_available()

    adapter_exists = (
        ADAPTER_PATH / "adapter_model.safetensors"
    ).exists()

    return {
        "status": "ok",
        "service": "craftlens-voice-model",
        "cuda_available": cuda_available,
        "adapter_exists": adapter_exists,
        "model_ready": (
            whisper_model is not None
            and tokenizer is not None
            and model is not None
        ),
        "gpu_required_for_ai": True
    }


# ============================================================
# VOICE PROCESS ENDPOINT
# ============================================================

@app.post("/api/voice/process")
def process_voice(request: VoiceRequest):

    try:

        # ----------------------------------------------------
        # IMPORTANT:
        # This performs the GPU safety check BEFORE loading
        # ANY AI model.
        # ----------------------------------------------------

        load_models()

        transcript = request.text or ""

        detected_language = (
            request.languageHint or "English"
        )

        confidence = None

        # ----------------------------------------------------
        # AUDIO PROCESSING
        # ----------------------------------------------------

        if request.audio:

            audio_data = request.audio

            # Handle Data URLs
            if "," in audio_data:

                audio_data = audio_data.split(
                    ",",
                    1
                )[1]

            try:

                audio_bytes = base64.b64decode(
                    audio_data
                )

            except Exception as e:

                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid base64 audio: {e}"
                )

            suffix = ".webm"

            mime = request.mimeType or ""

            if "wav" in mime:
                suffix = ".wav"

            elif (
                "mp3" in mime
                or "mpeg" in mime
            ):
                suffix = ".mp3"

            elif "ogg" in mime:
                suffix = ".ogg"

            temp_path = None

            try:

                with tempfile.NamedTemporaryFile(
                    suffix=suffix,
                    delete=False
                ) as temp_file:

                    temp_file.write(audio_bytes)

                    temp_path = temp_file.name

                (
                    transcript,
                    detected_language,
                    confidence
                ) = speech_to_text(temp_path)

            finally:

                if (
                    temp_path
                    and os.path.exists(temp_path)
                ):

                    os.remove(temp_path)

        # ----------------------------------------------------
        # NO SPEECH
        # ----------------------------------------------------

        if not transcript.strip():

            return {
                "transcript": "",
                "originalText": "",
                "language": detected_language,
                "detectedLanguage": detected_language,
                "translatedText": "",
                "normalizedText": "",
                "extraction": None,
                "extractedEntities": None,
                "confidence": confidence,
                "status": "no_speech"
            }

        # ----------------------------------------------------
        # QWEN EXTRACTION
        # ----------------------------------------------------

        extraction = extract_information(
            transcript
        )

        return {

            "transcript": transcript,

            "originalText": transcript,

            "language": detected_language,

            "detectedLanguage": detected_language,

            "translatedText": transcript,

            "normalizedText": transcript.lower().strip(),

            "extraction": extraction,

            "extractedEntities": extraction,

            "confidence": confidence,

            "status": "success"
        }

    except HTTPException:
        raise

    except RuntimeError as e:

        # ----------------------------------------------------
        # GPU SAFETY / MODEL AVAILABILITY
        # ----------------------------------------------------

        if "GPU" in str(e) or "CUDA" in str(e):

            raise HTTPException(
                status_code=503,
                detail=str(e)
            )

        print("\nVOICE API ERROR:")
        print(type(e).__name__, ":", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    except Exception as e:

        print("\nVOICE API ERROR:")
        print(type(e).__name__, ":", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )