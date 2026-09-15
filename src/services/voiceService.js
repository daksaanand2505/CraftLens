/**
 * Voice recording service stub
 * Authentic voice recording is captured directly via browser MediaRecorder in CreateProduct.jsx
 * and processed via the backend voiceModelService.
 */
export async function startVoiceRecording() {
  console.log("Voice recording initialized");
}

export async function stopVoiceRecording() {
  return {
    audioUrl: null,
    transcript: ""
  };
}

export async function transcribeAudio(audioFile) {
  return {
    transcript: ""
  };
}