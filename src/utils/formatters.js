export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function getStatusLabel(status) {
  const labels = {
    published: "Published",
    draft: "Draft",
    review: "Needs review",
    processing: "Processing"
  };

  return labels[status] || status;
}

export function getStatusClass(status) {
  const classes = {
    published: "status-success",
    draft: "status-neutral",
    review: "status-warning",
    processing: "status-info"
  };

  return classes[status] || "status-neutral";
}