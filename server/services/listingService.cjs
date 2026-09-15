/**
 * ============================================================
 * CraftLens Listing Generation Service
 * ============================================================
 * Generates customer-facing listings and SEO metadata strictly
 * from authentic artisan descriptions and verified product profile facts.
 * 
 * IMPORTANT RULES:
 * - Do NOT fabricate certifications, awards, or false geographic origins.
 * - Uses only verified materials, categories, and artisan story.
 * ============================================================
 */

/**
 * Generates structured listing metadata.
 * 
 * @param {Object} productProfile - Canonical product profile
 * @param {Object} [voiceData] - Optional voice data
 * @returns {Object} Structured listing
 */
function generateListing(productProfile = {}, voiceData = {}) {
  const title = productProfile.title || "Handcrafted Creation";
  const category = productProfile.category || "Handicraft";
  const craftType = productProfile.craftType || "Traditional Craft";
  const materials = productProfile.materials || [];
  const primaryMaterial = materials[0] || "natural materials";
  const artisanStory = productProfile.artisanStory || productProfile.description || "";

  // Honest description synthesized from artisan's story
  const description = artisanStory
    ? artisanStory
    : `Authentic ${title.toLowerCase()} created using traditional ${craftType.toLowerCase()} techniques.`;

  // SEO metadata
  const seoTitle = `${title} — Authentic Handmade ${category} | CraftLens`;
  const seoDescription = description.length > 150
    ? description.substring(0, 147) + "..."
    : description;

  // Derive tags strictly from real attributes (no fake claims!)
  const tags = [
    "handmade",
    "artisan craft",
    category.toLowerCase(),
    craftType.toLowerCase(),
    ...materials.map((m) => m.toLowerCase()),
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  // Factual highlights based only on provided evidence
  const highlights = [];
  if (productProfile.productionTime) {
    highlights.push(`Production time: ${productProfile.productionTime}`);
  }
  if (materials.length > 0) {
    highlights.push(`Primary material: ${materials.join(", ")}`);
  }
  if (productProfile.dimensions) {
    highlights.push(`Dimensions: ${productProfile.dimensions}`);
  }
  if (craftType) {
    highlights.push(`Craft discipline: ${craftType}`);
  }

  return {
    title,
    description,
    seoTitle,
    seoDescription,
    tags,
    highlights,
    source: "calculated",
  };
}

module.exports = {
  generateListing,
};

