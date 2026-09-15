/**
 * ============================================================
 * CraftLens Central AI Coordination Service
 * ============================================================
 * Coordinates the modular pipeline:
 * 1. Visual Analysis (imageIntelligenceService)
 * 2. Voice Understanding (voiceModelService -> Teammate Model)
 * 3. Canonical Product Profile Synthesis (Priority: Artisan > Voice > Visual > Rules)
 * 4. Listing Generation (listingService)
 * 5. Profit-Aware Pricing (pricingService)
 * 6. Material Recommendation (recommendationModelService)
 * ============================================================
 */

const { analyzeProductImage } = require("./imageIntelligenceService.cjs");
const { processVoice } = require("./voiceModelService.cjs");
const { generateListing } = require("./listingService.cjs");
const { calculatePricing } = require("./pricingService.cjs");
const { generateMaterialRecommendations } = require("./recommendationModelService.cjs");

const WORD_TO_NUM = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  "twenty four": 24, "twenty-four": 24, thirty: 30, forty: 40, "forty eight": 48,
  "forty-eight": 48, fifty: 50, sixty: 60, seventy: 70, eighty: 80,
  ninety: 90, hundred: 100,
  "one hundred": 100, "two hundred": 200, "three hundred": 300,
  "four hundred": 400, "five hundred": 500, "six hundred": 600,
  "seven hundred": 700, "eight hundred": 800, "nine hundred": 900,
};

function parseSpokenNumber(textVal) {
  if (!textVal) return null;
  const val = String(textVal).trim().toLowerCase();
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  for (const [word, num] of Object.entries(WORD_TO_NUM).sort((a, b) => b[0].length - a[0].length)) {
    if (val.includes(word)) return num;
  }
  return null;
}

function extractDimensionsFromText(text) {
  if (!text) return null;
  const norm = text.replace(/×/g, "x").replace(/X/g, "x");

  // 1. 3D: e.g. "30 by 30 by 20 centimetres", "30 x 30 x 20 cm", "30 by 30 by 20 cm", "30 x 30 x 20"
  const m3d = norm.match(/\b(\d+(?:\.\d+)?)\s*(?:by|x|\*)\s*(\d+(?:\.\d+)?)\s*(?:by|x|\*)\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm|m)?\b/i);
  if (m3d) {
    const [, d1, d2, d3, unit] = m3d;
    let uStr = "cm";
    if (unit) {
      const uLower = unit.toLowerCase();
      if (uLower.includes("in")) uStr = "in";
      else if (uLower.includes("mm")) uStr = "mm";
      else if (uLower === "m") uStr = "m";
    }
    return `${d1} × ${d2} × ${d3} ${uStr}`;
  }

  // 2. Descriptive: e.g. "30 centimetres wide and 20 centimetres high", "height is 20 cm and width is 30 cm"
  const wMatch = norm.match(/(?:width|wide)\s*(?:is|of|about|around)?\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?|(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?\s*(?:wide|width)/i);
  const hMatch = norm.match(/(?:height|high|tall)\s*(?:is|of|about|around)?\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?|(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?\s*(?:high|height|tall)/i);
  const dMatch = norm.match(/(?:depth|deep|length|long)\s*(?:is|of|about|around)?\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?|(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm)?\s*(?:deep|depth|long|length)/i);

  const w = wMatch ? (wMatch[1] || wMatch[3]) : null;
  const h = hMatch ? (hMatch[1] || hMatch[3]) : null;
  const d = dMatch ? (dMatch[1] || dMatch[3]) : null;

  if (w && h && d) return `${w} × ${h} × ${d} cm`;
  if (w && h) return `${w} × ${h} cm`;
  if (d && h) return `${d} × ${h} cm`;
  if (w && d) return `${w} × ${d} cm`;

  // 3. 2D: e.g. "30 by 20 cm", "30 x 20 centimetres"
  const m2d = norm.match(/\b(\d+(?:\.\d+)?)\s*(?:by|x|\*)\s*(\d+(?:\.\d+)?)\s*(cm|centimetres|centimeters|inches|in|mm|m)\b/i);
  if (m2d) {
    const [, d1, d2, unit] = m2d;
    let uStr = "cm";
    if (unit) {
      const uLower = unit.toLowerCase();
      if (uLower.includes("in")) uStr = "in";
      else if (uLower.includes("mm")) uStr = "mm";
      else if (uLower === "m") uStr = "m";
    }
    return `${d1} × ${d2} ${uStr}`;
  }

  return null;
}

/**
 * Builds the canonical product profile by merging all evidence streams.
 * Priority:
 * 1. Artisan Input (authoritative, always wins)
 * 2. Voice Model Output (spoken transcript / translation / extracted entities)
 * 3. Visual Evidence (photo attributes)
 * 4. Calculated Defaults
 * 
 * @param {Object} context
 */
async function buildProductProfile({ imageAnalysis = {}, voiceAnalysis = {}, artisanInput = {} }) {
  const evidence = {};

  // 1. Title
  let title = "Handcrafted Product";
  const voiceTitle =
    voiceAnalysis.extractedEntities?.product?.name ||
    voiceAnalysis.extraction?.product?.name ||
    null;

  if (artisanInput.title && artisanInput.title.trim()) {
    title = artisanInput.title.trim();
    evidence.title = { source: "artisan_input" };
  } else if (voiceTitle) {
    title = voiceTitle;
    evidence.title = { source: "voice_model_output" };
  } else if (imageAnalysis.titleSuggestion) {
    title = imageAnalysis.titleSuggestion;
    evidence.title = { source: "visual" };
  } else {
    evidence.title = { source: "calculated" };
  }

  // 2. Category
  let category = "Handicraft";
  if (artisanInput.category && artisanInput.category.trim()) {
    category = artisanInput.category.trim();
    evidence.category = { source: "artisan_input" };
  } else if (imageAnalysis.category) {
    category = imageAnalysis.category;
    evidence.category = { source: "visual" };
  } else {
    evidence.category = { source: "calculated" };
  }

  // 3. Craft Type
  let craftType = "Traditional Craft";
  const voiceCraftType =
    voiceAnalysis.extractedEntities?.product?.type ||
    voiceAnalysis.extraction?.product?.type ||
    null;

  if (artisanInput.craftType && artisanInput.craftType.trim()) {
    craftType = artisanInput.craftType.trim();
    evidence.craftType = { source: "artisan_input" };
  } else if (voiceCraftType) {
    const typeLower = voiceCraftType.toLowerCase();
    if (typeLower.includes("basket")) craftType = "Handmade Basketry";
    else if (typeLower.includes("pot") || typeLower.includes("tea set")) craftType = "Terracotta Pottery";
    else if (typeLower.includes("tray") || typeLower.includes("wood")) craftType = "Woodcraft";
    else craftType = voiceCraftType.charAt(0).toUpperCase() + voiceCraftType.slice(1);
    evidence.craftType = { source: "voice_model_output" };
  } else if (imageAnalysis.craftType) {
    craftType = imageAnalysis.craftType;
    evidence.craftType = { source: "visual" };
  } else {
    craftType = "Traditional Craft";
    evidence.craftType = { source: "calculated" };
  }

  // 4. Materials (Specific craft materials, prioritizing Artisan -> Voice -> Visual)
  let materials = [];
  const voiceMaterials =
    voiceAnalysis.extraction?.product?.materials ||
    voiceAnalysis.extractedEntities?.product?.materials ||
    null;

  if (Array.isArray(artisanInput.materials) && artisanInput.materials.length > 0) {
    materials = artisanInput.materials;
    evidence.materials = { source: "artisan_input" };
  } else if (Array.isArray(voiceMaterials) && voiceMaterials.length > 0) {
    materials = voiceMaterials;
    evidence.materials = { source: "voice_model_output" };
  } else if (artisanInput.description) {
    const textLower = artisanInput.description.toLowerCase();
    const knownMats = [
      ["sabai grass", "Sabai Grass"],
      ["cotton", "Cotton"],
      ["bamboo", "Bamboo"],
      ["terracotta", "Terracotta"],
      ["clay", "Clay"],
      ["coconut shell", "Coconut Shell"],
      ["jute", "Jute"],
      ["palm leaf", "Palm Leaf"],
      ["palm leaves", "Palm Leaf"],
      ["silk thread", "Silk Thread"],
      ["silk", "Silk Thread"],
      ["rosewood", "Rosewood"],
      ["teak wood", "Teak Wood"],
      ["wood", "Wood"],
      ["wooden", "Wood"],
      ["brass", "Brass"],
      ["copper", "Copper"],
      ["leather", "Leather"],
      ["wool", "Wool"],
      ["glass bead", "Glass Beads"],
      ["bead", "Beads"],
      ["stone", "Stone"],
      ["paper mache", "Paper Mache"],
      ["cane", "Cane"],
      ["sisal", "Sisal"],
    ];
    for (const [pat, can] of knownMats) {
      if (new RegExp(`\\b${pat}\\b`, "i").test(textLower)) {
        if (!materials.includes(can)) materials.push(can);
      }
    }
    if (materials.length > 0) {
      evidence.materials = { source: "artisan_input" };
    }
  } else if (Array.isArray(imageAnalysis.materials) && imageAnalysis.materials.length > 0) {
    materials = imageAnalysis.materials;
    evidence.materials = { source: "visual" };
  } else {
    materials = [];
    evidence.materials = { source: "not_available" };
  }

  // 5. Dimensions (NEVER invent dimensions unless provided!)
  let dimensions = null;
  const voiceSize =
    voiceAnalysis.extractedEntities?.product?.size ||
    voiceAnalysis.extraction?.product?.size ||
    null;

  if (artisanInput.dimensions && artisanInput.dimensions.trim()) {
    dimensions = artisanInput.dimensions.trim();
    evidence.dimensions = { source: "artisan_input" };
  } else if (voiceSize) {
    dimensions = voiceSize;
    evidence.dimensions = { source: "voice_model_output" };
  } else if (artisanInput.description) {
    const parsedDim = extractDimensionsFromText(artisanInput.description);
    if (parsedDim) {
      dimensions = parsedDim;
      evidence.dimensions = { source: "artisan_input" };
    } else if (imageAnalysis.dimensions) {
      dimensions = imageAnalysis.dimensions;
      evidence.dimensions = { source: "visual" };
    } else {
      dimensions = null;
      evidence.dimensions = { source: "not_available" };
    }
  } else if (imageAnalysis.dimensions) {
    dimensions = imageAnalysis.dimensions;
    evidence.dimensions = { source: "visual" };
  } else {
    dimensions = null;
    evidence.dimensions = { source: "not_available" };
  }

  // 6. Production Time (Duration to craft 1 item - ONLY if explicitly stated!)
  // Note: quantity_per_day (rate) is NOT production duration!
  let productionTime = null;
  const voiceProdTime =
    voiceAnalysis.extraction?.product?.production_time ||
    voiceAnalysis.extractedEntities?.product?.production_time ||
    null;

  if (artisanInput.productionTime && artisanInput.productionTime.trim()) {
    productionTime = artisanInput.productionTime.trim();
    evidence.productionTime = { source: "artisan_input" };
  } else if (voiceProdTime && String(voiceProdTime).trim()) {
    productionTime = String(voiceProdTime).trim();
    evidence.productionTime = { source: "voice_model_output" };
  } else if (artisanInput.description) {
    const numWordsDur = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|forty\\s*eight|forty-eight|twenty\\s*four|twenty-four|\\d+";
    const prodMatch =
      artisanInput.description.match(new RegExp(`\\b(?:takes|takes about|takes around|crafted in|made in|needs)\\s+(${numWordsDur})\\s*(hours?|days?|weeks?|mins?|minutes?)\\b`, "i")) ||
      artisanInput.description.match(new RegExp(`\\b(${numWordsDur})\\s*(hours?|days?|weeks?|mins?|minutes?)\\s*(?:to\\s+(?:make|weave|craft|produce|finish|complete))\\b`, "i"));
    if (prodMatch) {
      const parsedNum = parseSpokenNumber(prodMatch[1]);
      const unit = prodMatch[2].toLowerCase();
      productionTime = parsedNum !== null ? `${parsedNum} ${unit}` : `${prodMatch[1].trim()} ${unit}`;
      evidence.productionTime = { source: "artisan_input" };
    } else {
      productionTime = null;
      evidence.productionTime = { source: "not_available" };
    }
  } else {
    productionTime = null;
    evidence.productionTime = { source: "not_available" };
  }

  // 6b. Capacity Per Day (Production rate extracted from voice or artisan)
  const voiceCapacity =
    voiceAnalysis.extraction?.product?.quantity_per_day ||
    voiceAnalysis.extractedEntities?.product?.quantity_per_day ||
    null;
  let capacityPerDay = artisanInput.capacityPerDay || voiceCapacity || null;
  if (!capacityPerDay && artisanInput.description) {
    const numWordsQty = "one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|\\d+";
    const qtyMatch =
      artisanInput.description.match(new RegExp(`(${numWordsQty})\\s+[a-zA-Z\\s]{0,25}?(?:per|every|a)\\s+day`, "i")) ||
      artisanInput.description.match(new RegExp(`\\b(?:make|produce|craft|weave)\\s+(${numWordsQty})\\s*(?:items|pieces|baskets|pots|products|units)?\\s*(?:per|every|a)\\s+day\\b`, "i")) ||
      artisanInput.description.match(new RegExp(`\\b(?:make|produce|craft|weave)\\s+(${numWordsQty})\\s*(?:items|pieces|baskets|pots|products|units)\\b`, "i"));
    if (qtyMatch) {
      const parsedQty = parseSpokenNumber(qtyMatch[1]);
      if (parsedQty && parsedQty > 0) {
        capacityPerDay = parsedQty;
      }
    }
  }
  if (capacityPerDay) {
    evidence.capacityPerDay = {
      source: artisanInput.capacityPerDay || !voiceCapacity ? "artisan_input" : "voice_model_output",
      value: capacityPerDay,
    };
  }

  // 6c. Artisan Selling Price (Extracted from voice or artisan input - NEVER overwritten by system calculation!)
  let artisanSellingPrice = null;
  const voicePrice =
    voiceAnalysis.extraction?.product?.price_per_unit ||
    voiceAnalysis.extractedEntities?.product?.price_per_unit ||
    null;

  if (artisanInput.artisanSellingPrice !== undefined && artisanInput.artisanSellingPrice !== null && !isNaN(Number(artisanInput.artisanSellingPrice))) {
    artisanSellingPrice = Number(artisanInput.artisanSellingPrice);
    evidence.artisanSellingPrice = { source: "artisan_input", value: artisanSellingPrice };
  } else if (voicePrice !== null && voicePrice !== undefined && !isNaN(Number(voicePrice))) {
    artisanSellingPrice = Number(voicePrice);
    evidence.artisanSellingPrice = { source: "voice_model_output", value: artisanSellingPrice };
  } else if (artisanInput.description) {
    const numWordsPrice = "eight hundred|five hundred|six hundred|seven hundred|four hundred|three hundred|two hundred|one hundred|\\d+";
    const priceMatch =
      artisanInput.description.match(new RegExp(`(${numWordsPrice})\\s*(?:rupees|rs|inr|₹)`, "i")) ||
      artisanInput.description.match(new RegExp(`(?:costs?|for|price(?:\\s+is)?|sell\\s+(?:each\\s+[a-zA-Z]+\\s+)?for)\\s*(${numWordsPrice})`, "i"));
    if (priceMatch) {
      const parsedPrice = parseSpokenNumber(priceMatch[1]);
      if (parsedPrice && parsedPrice > 0) {
        artisanSellingPrice = parsedPrice;
        evidence.artisanSellingPrice = { source: "artisan_input", value: artisanSellingPrice };
      }
    }
  }
  if (!artisanSellingPrice) {
    evidence.artisanSellingPrice = { source: "not_available" };
  }

  // 7. Artisan Story & Description
  let artisanStory = "";
  if (artisanInput.description && artisanInput.description.trim()) {
    artisanStory = artisanInput.description.trim();
    evidence.artisanStory = { source: "artisan_input" };
  } else if (voiceAnalysis.translatedText && voiceAnalysis.translatedText.trim()) {
    artisanStory = voiceAnalysis.translatedText.trim();
    evidence.artisanStory = { source: voiceAnalysis.source || "voice_model_output" };
  } else if (voiceAnalysis.originalText && voiceAnalysis.originalText.trim()) {
    artisanStory = voiceAnalysis.originalText.trim();
    evidence.artisanStory = { source: voiceAnalysis.source || "voice_model_output" };
  } else {
    artisanStory = `Handcrafted ${title} made using traditional ${craftType.toLowerCase()} techniques.`;
    evidence.artisanStory = { source: "calculated" };
  }

  const language = artisanInput.language || voiceAnalysis.language || "English";

  return {
    title,
    category,
    craftType,
    materials,
    dimensions,
    productionTime,
    capacityPerDay,
    artisanSellingPrice,
    currency: "INR",
    artisanStory,
    description: artisanStory,
    language,
    evidence,
    confidence: {
      title: evidence.title.source === "artisan_input" ? "high" : "medium",
      category: "high",
      materials: materials.length > 0 ? "high" : "low",
      dimensions: dimensions ? "medium" : "low",
      productionTime: productionTime ? "high" : "low",
      artisanSellingPrice: artisanSellingPrice ? "high" : "low",
      artisanStory: "high",
    },
    explanation: "Product profile synthesized by combining artisan input, voice understanding, and visual evidence.",
    sourceEvidence: {
      image: imageAnalysis.titleSuggestion ? "Product photo visual evidence" : "No photo provided",
      voice: voiceAnalysis.originalText ? "Artisan voice description" : "Direct artisan input",
    },
  };
}

module.exports = {
  analyzeProductImage,
  processVoice,
  buildProductProfile,
  generateListing,
  calculatePricing,
  generateMaterialRecommendations,
};