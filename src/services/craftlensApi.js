const API_BASE_URL = "http://localhost:5000/api";

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (networkErr) {
    throw new Error(
      `Cannot connect to CraftLens backend server (${networkErr.message}). Ensure backend is running on port 5000.`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Server returned error (${response.status}): ${rawText.slice(0, 120)}`);
    }
    return rawText;
  }

  if (!response.ok || (data && data.success === false)) {
    const errMsg = (data && data.message) || `Server request failed with status ${response.status}`;
    throw new Error(errMsg);
  }

  return data;
}

// AI PRODUCT PROCESSING
export async function processProduct(payload) {
  return apiRequest(`${API_BASE_URL}/ai/process-product`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// CREATE PRODUCT
export async function createProduct(product) {
  return apiRequest(`${API_BASE_URL}/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(product),
  });
}

// GET CATALOGUE
export async function getProducts() {
  return apiRequest(`${API_BASE_URL}/products`);
}

// GET RAW MATERIALS
export async function getMaterials() {
  return apiRequest(`${API_BASE_URL}/materials`);
}

// GET INVENTORY
export async function getInventory() {
  return apiRequest(`${API_BASE_URL}/inventory`);
}

// GET ORDERS
export async function getOrders() {
  return apiRequest(`${API_BASE_URL}/orders`);
}

// CREATE ORDER
export async function createOrder(order) {
  return apiRequest(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(order),
  });
}
