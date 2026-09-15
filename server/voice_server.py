#!/usr/bin/env python3
"""
============================================================
CraftLens Voice Model Server
============================================================
Implements the teammate's Voice Model inference pipeline:
1. Receives audio from CraftLens backend (POST /api/voice/process)
2. Speech-to-Text & Translation via faster-whisper (task="translate")
3. Repetitive noise suppression (remove_repeated_phrases)
4. Structured information extraction (artisan, product, business)
5. Returns canonical JSON to voiceModelService.cjs
============================================================
"""

import os
import sys
import json
import re
import base64
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler

# Settings matching teammate repository
PORT = int(os.environ.get("VOICE_PORT", 8000))
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small")

whisper_model = None

def get_whisper():
    global whisper_model
    if whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            print(f"[Voice Server] Loading faster-whisper ({WHISPER_MODEL_SIZE})...")
            whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
            print("[Voice Server] Whisper loaded successfully.")
        except Exception as e:
            print(f"[Voice Server] Note: faster-whisper not loaded ({e}).")
    return whisper_model

def remove_repeated_phrases(text):
    words = text.split()
    if len(words) < 6:
        return text
    cleaned = []
    i = 0
    while i < len(words):
        if (
            i + 3 < len(words)
            and words[i].lower() == words[i + 1].lower() == words[i + 2].lower() == words[i + 3].lower()
        ):
            cleaned.append(words[i])
            rep = words[i].lower()
            while i < len(words) and words[i].lower() == rep:
                i += 1
            continue
        cleaned.append(words[i])
        i += 1
    return " ".join(cleaned).strip()

WORD_TO_NUM = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "twenty four": 24, "twenty-four": 24, "thirty": 30, "forty": 40, "forty eight": 48,
    "forty-eight": 48, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80,
    "ninety": 90, "hundred": 100,
    "one hundred": 100, "two hundred": 200, "three hundred": 300,
    "four hundred": 400, "five hundred": 500, "six hundred": 600,
    "seven hundred": 700, "eight hundred": 800, "nine hundred": 900,
}

def parse_spoken_number(text_val):
    if not text_val:
        return None
    val = text_val.strip().lower()
    if val.isdigit():
        return int(val)
    for word, num in sorted(WORD_TO_NUM.items(), key=lambda x: -len(x[0])):
        if word in val:
            return num
    return None

def extract_dimensions_from_text(text):
    if not text:
        return None
    norm = text.replace("×", "x").replace("X", "x")

    # 1. 3D: e.g. "30 by 30 by 20 centimetres", "30 x 30 x 20 cm", "30 by 30 by 20 cm", "30 x 30 x 20"
    m3d = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:by|x|\*)\s*(\d+(?:\.\d+)?)\s*(?:by|x|\*)\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm|m)?\b", norm, re.I)
    if m3d:
        d1, d2, d3 = m3d.group(1), m3d.group(2), m3d.group(3)
        unit = m3d.group(4)
        u_str = "cm"
        if unit:
            u_lower = unit.lower()
            if "in" in u_lower: u_str = "in"
            elif "mm" in u_lower: u_str = "mm"
            elif u_lower == "m": u_str = "m"
        return f"{d1} × {d2} × {d3} {u_str}"

    # 2. Descriptive: e.g. "30 centimetres wide and 20 centimetres high", "height is 20 cm and width is 30 cm"
    w_match = re.search(r"(?:width|wide)\s*(?:is|of|about|around)?\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?|(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?\s*(?:wide|width)", norm, re.I)
    h_match = re.search(r"(?:height|high|tall)\s*(?:is|of|about|around)?\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?|(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?\s*(?:high|height|tall)", norm, re.I)
    d_match = re.search(r"(?:depth|deep|length|long)\s*(?:is|of|about|around)?\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?|(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?\s*(?:deep|depth|long|length)", norm, re.I)

    w = (w_match.group(1) or w_match.group(3)) if w_match else None
    h = (h_match.group(1) or h_match.group(3)) if h_match else None
    d = (d_match.group(1) or d_match.group(3)) if d_match else None

    if w and h and d:
        return f"{w} × {h} × {d} cm"
    elif w and h:
        return f"{w} × {h} cm"
    elif d and h:
        return f"{d} × {h} cm"
    elif w and d:
        return f"{w} × {d} cm"

    # 3. 2D: e.g. "30 by 20 cm", "30 x 20 centimetres"
    m2d = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:by|x|\*)\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm|m)\b", norm, re.I)
    if m2d:
        d1, d2 = m2d.group(1), m2d.group(2)
        unit = m2d.group(3)
        u_str = "cm"
        if unit:
            u_lower = unit.lower()
            if "in" in u_lower: u_str = "in"
            elif "mm" in u_lower: u_str = "mm"
            elif u_lower == "m": u_str = "m"
        return f"{d1} × {d2} {u_str}"

    return None

def extract_information(text):
    """
    Extracts structured product and business facts matching the teammate's
    exact schema and anti-hallucination rules from voice_test.py.
    Never invents missing fields - returns null for unmentioned values.
    """
    clean_data = {
        "artisan": { "name": None },
        "product": {
            "name": None,
            "type": None,
            "size": None,
            "price_per_unit": None,
            "currency": None,
            "quantity_per_day": None,
            "materials": [],
            "production_time": None,
        },
        "business": {
            "location": None,
            "payment_method": None,
        },
    }

    if not text:
        return clean_data

    lower = text.lower()

    # 1. Product Name & Type detection
    craft_keywords = [
        ("sabai grass storage basket", "basket"),
        ("sabai grass basket", "basket"),
        ("bamboo basket", "basket"),
        ("terracotta tea set", "tea set"),
        ("terracotta pot", "pot"),
        ("clay pot", "pot"),
        ("coconut shell spoon", "spoon"),
        ("coconut shell bowl", "bowl"),
        ("palm leaf basket", "basket"),
        ("stone bead bracelet", "bracelet"),
        ("silk thread wall hanging", "wall hanging"),
        ("wooden serving tray", "tray"),
        ("wooden temple model", "temple model"),
        ("jute wall decor", "wall decor"),
        ("bamboo pen stand", "pen stand"),
        ("storage basket", "basket"),
        ("basket", "basket"),
        ("pot", "pot"),
        ("vase", "vase"),
    ]

    for name_candidate, type_candidate in craft_keywords:
        if name_candidate in lower:
            clean_data["product"]["name"] = name_candidate.capitalize()
            clean_data["product"]["type"] = type_candidate
            break

    # If no exact match, try general craft item regex
    if clean_data["product"]["name"] is None:
        m = re.search(r"\b(handwoven|handmade|handcrafted)\s+([a-zA-Z\s]{3,30})\b", text, re.I)
        if m:
            clean_data["product"]["name"] = m.group(0).strip().capitalize()

    # 2. Specific Craft Materials Extraction (NEVER generic labels)
    known_materials = [
        ("sabai grass", "Sabai Grass"),
        ("cotton", "Cotton"),
        ("bamboo", "Bamboo"),
        ("terracotta", "Terracotta"),
        ("clay", "Clay"),
        ("coconut shell", "Coconut Shell"),
        ("jute", "Jute"),
        ("palm leaf", "Palm Leaf"),
        ("palm leaves", "Palm Leaf"),
        ("silk thread", "Silk Thread"),
        ("silk", "Silk Thread"),
        ("rosewood", "Rosewood"),
        ("teak wood", "Teak Wood"),
        ("wood", "Wood"),
        ("wooden", "Wood"),
        ("brass", "Brass"),
        ("copper", "Copper"),
        ("leather", "Leather"),
        ("wool", "Wool"),
        ("glass bead", "Glass Beads"),
        ("bead", "Beads"),
        ("stone", "Stone"),
        ("paper mache", "Paper Mache"),
        ("papier mache", "Paper Mache"),
        ("cane", "Cane"),
        ("sisal", "Sisal"),
    ]
    materials_found = []
    for pattern, canon in known_materials:
        if re.search(r"\b" + re.escape(pattern) + r"\b", lower):
            if canon not in materials_found:
                materials_found.append(canon)
    clean_data["product"]["materials"] = materials_found

    # 3. Size / Dimensions Extraction (NEVER invented if unmentioned)
    clean_data["product"]["size"] = extract_dimensions_from_text(text)

    # 4. Price and Currency (only if explicitly stated!)
    num_words_price = r"eight hundred|five hundred|six hundred|seven hundred|four hundred|three hundred|two hundred|one hundred|\d+"
    price_match = re.search(rf"({num_words_price})\s*(?:rupees|rs|inr|₹)", text, re.I)
    if not price_match:
        price_match = re.search(rf"(?:costs?|for|price(?:\s+is)?|sell\s+(?:each\s+[a-zA-Z]+\s+)?for)\s*({num_words_price})", text, re.I)
    if price_match:
        val = parse_spoken_number(price_match.group(1))
        if val is not None and val > 0:
            clean_data["product"]["price_per_unit"] = val
            clean_data["product"]["currency"] = "INR"

    # 5. Quantity per day (Production rate / capacity - NOT duration to craft 1 item!)
    num_words_qty = r"one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|\d+"
    qty_day_match = re.search(rf"({num_words_qty})\s+[a-zA-Z\s]{{0,25}}?(?:per|every|a)\s+day", text, re.I)
    if not qty_day_match:
        qty_day_match = re.search(rf"\b(?:make|produce|craft|weave)\s+({num_words_qty})\s*(?:items|pieces|baskets|pots|products|units)?\s*(?:per|every|a)\s+day\b", text, re.I)
    if not qty_day_match:
        qty_day_match = re.search(rf"\b(?:make|produce|craft|weave)\s+({num_words_qty})\s*(?:items|pieces|baskets|pots|products|units)\b", text, re.I)
    if qty_day_match:
        val = parse_spoken_number(qty_day_match.group(1))
        if val is not None and val > 0:
            clean_data["product"]["quantity_per_day"] = val

    # 6. Production duration (Duration to craft 1 item - ONLY if explicitly stated!)
    # E.g. "takes 2 days", "takes two days", "needs 3 days", "takes around 48 hours"
    # Anti-hallucination: Never map quantity_per_day to production_time!
    num_words_dur = r"one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|forty\s*eight|forty-eight|twenty\s*four|twenty-four|\d+"
    prod_time_match = re.search(rf"\b(?:takes|takes about|takes around|crafted in|made in|needs)\s+({num_words_dur})\s*(hours?|days?|weeks?|mins?|minutes?)\b", text, re.I)
    if not prod_time_match:
        prod_time_match = re.search(rf"\b({num_words_dur})\s*(hours?|days?|weeks?|mins?|minutes?)\s*(?:to\s+(?:make|weave|craft|produce|finish|complete))\b", text, re.I)
    if prod_time_match:
        num_val = parse_spoken_number(prod_time_match.group(1))
        unit = prod_time_match.group(2).lower()
        if num_val is not None:
            clean_data["product"]["production_time"] = f"{num_val} {unit}"
        else:
            clean_data["product"]["production_time"] = f"{prod_time_match.group(1).strip()} {unit}"
    else:
        clean_data["product"]["production_time"] = None

    # 7. Location (only if explicitly mentioned!)
    loc_match = re.search(r"\b(?:in|from)\s+(Madurai|Chennai|Tamil Nadu|Thanjavur|Kanchipuram|Salem|Coimbatore|Bengaluru|Jaipur|Kashmir)\b", text, re.I)
    if loc_match:
        clean_data["business"]["location"] = loc_match.group(1).capitalize()

    # 8. Payment method (only if explicitly mentioned!)
    pay_match = re.search(r"\b(UPI|cash|card|bank transfer|online)\b", text, re.I)
    if pay_match:
        clean_data["business"]["payment_method"] = pay_match.group(1).upper() if pay_match.group(1).lower() == "upi" else pay_match.group(1).capitalize()

    return clean_data

def process_audio_payload(audio_bytes, mime_type="audio/webm", language_hint=None, fallback_text=""):
    print(f"[VOICE] Processing audio payload ({len(audio_bytes)} bytes, mime: {mime_type}, hint: {language_hint}, fallbackTextLen: {len(fallback_text)})", flush=True)
    ext = ".webm" if "webm" in mime_type else ".wav"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
        tf.write(audio_bytes)
        temp_path = tf.name

    try:
        model = get_whisper()
        english_text = ""
        detected_lang = language_hint or "en"
        conf = 0.95

        if model is not None:
            try:
                segments, info = model.transcribe(
                    temp_path,
                    task="translate",
                    language=None if not language_hint or language_hint == "English" else language_hint,
                    beam_size=5,
                    vad_filter=True,
                    condition_on_previous_text=False,
                    no_speech_threshold=0.6,
                    repetition_penalty=1.1
                )
                parts = [s.text.strip() for s in segments if s.text.strip()]
                english_text = remove_repeated_phrases(" ".join(parts).strip())
                detected_lang = info.language
                conf = round(float(info.language_probability), 3)
                print(f"[VOICE] Transcription success: '{english_text}' (detected lang: {info.language}, prob: {info.language_probability:.2f})", flush=True)
            except Exception as transcribe_err:
                print(f"[VOICE] Transcription warning: {transcribe_err}. Falling back to text if available.", flush=True)

        # If audio transcription produced text, use it; otherwise fallback to provided text description
        effective_text = english_text.strip() if english_text.strip() else fallback_text.strip()
        extraction = extract_information(effective_text)

        print(f"[VOICE] Extracted entities: materials={extraction['product']['materials']}, qty_per_day={extraction['product']['quantity_per_day']}, prod_time={extraction['product']['production_time']}, size={extraction['product']['size']}, price={extraction['product']['price_per_unit']}", flush=True)

        return {
            "success": True,
            "transcript": effective_text,
            "originalText": english_text if english_text.strip() else effective_text,
            "detectedLanguage": detected_lang,
            "language": detected_lang,
            "translatedText": effective_text,
            "normalizedText": effective_text.lower().strip(),
            "extraction": extraction,
            "extractedEntities": extraction,
            "confidence": conf,
            "source": "voice_model" if english_text.strip() else "artisan_input",
            "model": f"faster-whisper-{WHISPER_MODEL_SIZE}",
            "status": "success"
        }
    except Exception as e:
        print(f"[VOICE] Unexpected processing error: {e}", flush=True)
        effective_text = fallback_text.strip()
        extraction = extract_information(effective_text)
        return {
            "success": True,
            "transcript": effective_text,
            "originalText": effective_text,
            "detectedLanguage": language_hint or "en",
            "language": language_hint or "en",
            "translatedText": effective_text,
            "normalizedText": effective_text.lower().strip(),
            "extraction": extraction,
            "extractedEntities": extraction,
            "confidence": 0.8,
            "source": "artisan_input",
            "model": f"faster-whisper-{WHISPER_MODEL_SIZE}",
            "status": "fallback",
            "notice": "Audio processed with text fallback."
        }
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

class VoiceRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/health" or self.path == "/":
            model = get_whisper()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "online",
                "service": "CraftLens Teammate Voice Model Server",
                "whisper_ready": model is not None
            }).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/voice/process" or self.path == "/process-voice":
            print(f"[VOICE] POST {self.path} - Incoming voice request received", flush=True)
            content_len = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_len)
            
            try:
                data = json.loads(post_data.decode("utf-8"))
                audio_b64 = data.get("audio", "")
                text_input = (data.get("text", "") or data.get("transcript", "")).strip()
                lang_hint = data.get("languageHint", None)

                if not audio_b64 and text_input:
                    print(f"[VOICE] Direct text extraction request: '{text_input[:60]}...'", flush=True)
                    extraction = extract_information(text_input)
                    result = {
                        "success": True,
                        "transcript": text_input,
                        "originalText": text_input,
                        "detectedLanguage": lang_hint or "en",
                        "language": lang_hint or "en",
                        "translatedText": text_input,
                        "normalizedText": text_input.lower().strip(),
                        "extraction": extraction,
                        "extractedEntities": extraction,
                        "confidence": 1.0,
                        "source": "artisan_input",
                        "model": "entity_extractor",
                        "status": "success"
                    }
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(result).encode("utf-8"))
                    return

                if "," in audio_b64:
                    audio_b64 = audio_b64.split(",")[1]
                
                audio_bytes = base64.b64decode(audio_b64)
                mime_type = data.get("mimeType", "audio/webm")

                result = process_audio_payload(audio_bytes, mime_type, lang_hint, text_input)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
                return
            except Exception as e:
                print(f"[VOICE] Error in do_POST: {e}", flush=True)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                fallback_extraction = extract_information("")
                self.wfile.write(json.dumps({
                    "success": True,
                    "status": "fallback",
                    "transcript": "",
                    "originalText": "",
                    "translatedText": "",
                    "extraction": fallback_extraction,
                    "extractedEntities": fallback_extraction,
                    "error": str(e)
                }).encode("utf-8"))
                return

        self.send_response(404)
        self.end_headers()

def run_server():
    print("=" * 60, flush=True)
    print("CRAFTLENS TEAMMATE VOICE MODEL SERVER", flush=True)
    print("=" * 60, flush=True)
    print(f"Listening on http://127.0.0.1:{PORT}", flush=True)
    print(f"Endpoint: http://127.0.0.1:{PORT}/api/voice/process", flush=True)
    print("[VOICE] Pre-warming faster-whisper model...", flush=True)
    get_whisper()
    print("=" * 60, flush=True)
    server = HTTPServer(("127.0.0.1", PORT), VoiceRequestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nVoice server stopped.", flush=True)

if __name__ == "__main__":
    run_server()

