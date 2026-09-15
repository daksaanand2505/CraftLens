function Toast({ message, type = "success", onClose }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`toast toast-${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <span>{type === "error" ? "!" : "✓"}</span>
      <p>{message}</p>
      <button onClick={onClose} aria-label="Close notification">
        ×
      </button>
    </div>
  );
}

export default Toast;