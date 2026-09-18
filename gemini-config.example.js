/* Gemini chat configuration — EXAMPLE. Copy this file to `gemini-config.js`
   and paste your Google AI Studio API key. gemini-config.js is gitignored,
   so your key stays out of the repository.
   Get a key: https://aistudio.google.com/apikey */
window.GEMINI_API_KEY = "PASTE_YOUR_GEMINI_API_KEY_HERE";
window.GEMINI_MODEL = "gemini-3.6-flash";
window.geminiChat = async function (history) {
  const systemPrompt = `You are the Care Navigation Assistant, a friendly support chatbot for Care Navigation, a demo platform that coordinates non-emergency healthcare logistics (hospital visit companions, medicine pickup, paperwork & admission help, transport coordination, pharmacy errands, wayfinding, family updates). Answer user questions helpfully and briefly (2-4 sentences). Stay on topic: services, booking steps, pricing (assistance fee ~5-10% of coordinated cost), hospitals, support contact. You cannot diagnose, treat, or handle emergencies - if asked about emergencies, tell users to call their local emergency services immediately (e.g., 112 or 108 for ambulance in India, 911 in the US). Never invent bookings or real hospital availability.`;
  const contents = history.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] }));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${window.GEMINI_MODEL}:generateContent?key=${window.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents })
  });
  if (!res.ok) throw new Error("Gemini API error " + res.status);
  const data = await res.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  const text = parts && parts.map(p => p.text).filter(Boolean).join("");
  if (!text) throw new Error("Empty Gemini response");
  return text;
};
