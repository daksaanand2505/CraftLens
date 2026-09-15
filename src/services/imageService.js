export async function uploadProductImage(imageFile) {
  return {
    imageUrl: URL.createObjectURL(imageFile),
    status: "uploaded"
  };
}

export async function enhanceProductImage(imageFile) {
  return {
    imageUrl: URL.createObjectURL(imageFile),
    status: "enhanced"
  };
}