const listenBtn = document.getElementById("listenBtn");
const stopBtn = document.getElementById("stopBtn");
const orb = document.getElementById("orb");
const statusText = document.getElementById("statusText");

function setOrbState(state) {
  orb.classList.remove("idle", "listening", "speaking");
  orb.classList.add(state);
}

listenBtn.addEventListener("click", () => {
  startVoiceChat();
});

stopBtn.addEventListener("click", () => {
  speechSynthesis.cancel();
  setOrbState("idle");
  statusText.textContent = "Voice chat stopped";
});

function startVoiceChat() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Ton navigateur ne supporte pas la reconnaissance vocale.");
    return;
  }

  const savedLang = localStorage.getItem("oryaLang") || "français";
  const savedPersonality = localStorage.getItem("oryaPersonality") || "cute, douce, gentille et encourageante";

  const langMap = {
    "français": "fr-FR",
    "english": "en-US",
    "العربية": "ar-SA",
    "日本語": "ja-JP",
    "中文": "zh-CN"
  };

  const recognition = new SpeechRecognition();
  recognition.lang = langMap[savedLang] || "fr-FR";
  recognition.start();

  setOrbState("listening");
  statusText.textContent = "I am listening...";

  recognition.onresult = async (event) => {
    const userText = event.results[0][0].transcript;
    console.log("✅ Texte reconnu :", userText);

    statusText.textContent = `You said: ${userText}`;
    setOrbState("speaking");
    statusText.textContent = "Orya is thinking...";

    try {
      console.log("📤 Envoi à /api/chat...");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          language: savedLang,
          personality: savedPersonality
        })
      });

      console.log("📥 Status réponse :", res.status);

      if (!res.ok) {
        throw new Error(`Erreur serveur : ${res.status}`);
      }

      const data = await res.json();
      console.log("💬 Réponse Orya :", data.reply);

      statusText.textContent = `Orya: ${data.reply.slice(0, 60)}...`;
      await speak(data.reply, savedLang);

    } catch (error) {
      console.error("❌ Erreur fetch /api/chat :", error);
      setOrbState("idle");
      statusText.textContent = `Erreur: ${error.message}`;
    }
  };

  recognition.onerror = (event) => {
    console.error("❌ Erreur reconnaissance :", event.error);
    setOrbState("idle");
    statusText.textContent = `Mic error: ${event.error}`;
  };
}

async function speak(text, lang) {
  try {
    console.log("🔊 Envoi TTS...");

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        language: lang || localStorage.getItem("oryaLang") || "français"
      })
    });

    if (!res.ok) {
      throw new Error(`TTS error: ${res.status}`);
    }

    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    audio.onplay = () => {
      setOrbState("speaking");
      statusText.textContent = "Orya is speaking...";
    };

    audio.onended = () => {
      setOrbState("idle");
      statusText.textContent = "Click the mic to speak again";
    };

    audio.onerror = (e) => {
      console.error("❌ Audio error:", e);
      setOrbState("idle");
      statusText.textContent = "Audio error. Try again.";
    };

    await audio.play();

  } catch (error) {
    console.error("❌ Erreur TTS :", error);
    statusText.textContent = `TTS Error: ${error.message}`;
    setOrbState("idle");
  }
}