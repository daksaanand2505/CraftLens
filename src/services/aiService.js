export async function extractProductDetails(input) {
  await wait(1200);

  const description = input.description?.toLowerCase() || "";
  const isBasket =
    description.includes("basket") ||
    description.includes("bamboo") ||
    input.isSampleProduct;

  if (isBasket) {
    return {
      title: "Traditional Handmade Bamboo Basket",
      category: "Home decor",
      materials: "Bamboo, natural varnish",
      dimensions: "30 cm × 20 cm",
      productionTime: "3 days",
      artisanStory:
        "A traditionally woven bamboo basket made by hand using natural materials and local craftsmanship.",
      confidence: {
        title: "high",
        category: "high",
        materials: "high",
        dimensions: "medium",
        productionTime: "medium",
        artisanStory: "high"
      },
      explanation:
        "CraftLens identified bamboo as the main material from your description and matched the product with the home decor category."
    };
  }

  return {
    title: input.title || "Handmade Artisan Product",
    category: "Handmade crafts",
    materials: "Natural materials",
    dimensions: "Not provided",
    productionTime: "Not provided",
    artisanStory:
      input.description ||
      "A handmade product created using traditional artisan techniques.",
    confidence: {
      title: input.title ? "medium" : "low",
      category: "medium",
      materials: "low",
      dimensions: "low",
      productionTime: "low",
      artisanStory: "medium"
    },
    explanation:
      "CraftLens created an initial profile from the information you provided. Please review the fields before continuing."
  };
}

export async function generatePricing(productData) {
  await wait(1000);

  const materialCost = Number(productData.materialCost) || 360;
  const labourCost = Number(productData.labourCost) || 300;
  const packagingCost = Number(productData.packagingCost) || 50;
  const platformCost = Number(productData.platformCost) || 40;
  const overheadCost = Number(productData.overheadCost) || 60;

  const totalCost =
    materialCost +
    labourCost +
    packagingCost +
    platformCost +
    overheadCost;

  return {
    costs: {
      materialCost,
      labourCost,
      packagingCost,
      platformCost,
      overheadCost,
      totalCost
    },
    minimumPrice: roundToNearestTen(totalCost * 1.15),
    recommendedPrice: roundToNearestTen(totalCost * 1.6),
    premiumPrice: roundToNearestTen(totalCost * 2.05),
    reasoning:
      "The recommendation includes material cost, labour, packaging, platform fees, overhead and a sustainable profit margin."
  };
}

export async function recommendMaterials(productData) {
  await wait(800);

  const materialsText = productData.materials?.toLowerCase() || "";
  const isBamboo = materialsText.includes("bamboo");

  if (isBamboo) {
    return {
      materials: [
        {
          id: "material-001",
          name: "Bamboo strips",
          quantity: "12 bundles",
          estimatedCost: 720,
          stockStatus: "Low stock",
          stockClass: "warning",
          supplier: "Murugan Bamboo Suppliers"
        },
        {
          id: "material-002",
          name: "Natural varnish",
          quantity: "2 bottles",
          estimatedCost: 360,
          stockStatus: "Available",
          stockClass: "success",
          supplier: "GreenCraft Materials"
        }
      ],
      totalEstimatedCost: 1080,
      supplierSuggestion: "Local bamboo supplier available near your location"
    };
  }

  return {
    materials: [
      {
        id: "material-003",
        name: "Primary craft material",
        quantity: "10 units",
        estimatedCost: 500,
        stockStatus: "Check stock",
        stockClass: "warning",
        supplier: "Recommended local supplier"
      },
      {
        id: "material-004",
        name: "Finishing material",
        quantity: "2 units",
        estimatedCost: 250,
        stockStatus: "Available",
        stockClass: "success",
        supplier: "GreenCraft Materials"
      }
    ],
    totalEstimatedCost: 750,
    supplierSuggestion: "Compare local and online supplier prices before purchasing"
  };
}

export async function generateProductProfile(productData) {
  await wait(800);

  return {
    title: productData.title,
    description: productData.artisanStory,
    seoTags: [
      productData.category,
      "handmade product",
      "artisan made"
    ],
    confidence: 0.91
  };
}

function roundToNearestTen(value) {
  return Math.round(value / 10) * 10;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}