const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const fileInput = document.getElementById("fileInput");
const languageBtn = document.getElementById("languageBtn");

// ✅ Récupère les valeurs sauvegardées ou valeurs par défaut
let selectedLanguage = localStorage.getItem("oryaLang") || "français";
let selectedPersonality = localStorage.getItem("oryaPersonality") || "cute, douce, gentille et encourageante";

function addMessage(text, type, extraClass = "") {
  const div = document.createElement("div");
  div.className = `message ${type} ${extraClass}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

/* Langue : mini popup créée en JS */
languageBtn.addEventListener("click", () => {
  const existingPopup = document.getElementById("langPopup");

  if (existingPopup) {
    existingPopup.remove();
    return;
  }

  const popup = document.createElement("div");
  popup.id = "langPopup";

  popup.innerHTML = `
    <button type="button" data-lang="français">🇫🇷 Français</button>
    <button type="button" data-lang="english">🇺🇸 English</button>
    <button type="button" data-lang="العربية">🇸🇦 العربية</button>
    <button type="button" data-lang="日本語">🇯🇵 日本語</button>
    <button type="button" data-lang="中文">🇨🇳 中文</button>
  `;

  document.body.appendChild(popup);

  popup.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedLanguage = btn.dataset.lang;
      languageBtn.textContent = btn.textContent;
      // ✅ Sauvegarde la langue
      localStorage.setItem("oryaLang", selectedLanguage);
      popup.remove();
    });
  });

  // ✅ Ferme le popup si on clique ailleurs
  setTimeout(() => {
    document.addEventListener("click", function closeLangPopup(e) {
      if (!popup.contains(e.target) && e.target !== languageBtn) {
        popup.remove();
        document.removeEventListener("click", closeLangPopup);
      }
    });
  }, 100);
});

/* Personnalités */
document.querySelectorAll(".personality-option").forEach((card) => {
  card.addEventListener("click", () => {
    selectPersonality(card);
  });

  const arrowBtn = card.querySelector("button");
  if (arrowBtn) {
    arrowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectPersonality(card);
    });
  }
});

// ✅ Active la personnalité sauvegardée au chargement
window.addEventListener("DOMContentLoaded", () => {
  const savedPersonality = localStorage.getItem("oryaPersonality");
  if (savedPersonality) {
    const cards = document.querySelectorAll(".personality-option");
    cards.forEach((card) => {
      if (card.dataset.personality === savedPersonality) {
        card.classList.add("active");
      }
    });
  }

  // ✅ Met à jour le bouton langue au chargement
  const savedLang = localStorage.getItem("oryaLang");
  const langEmojis = {
    "français": "🇫🇷 Français",
    "english": "🇺🇸 English",
    "العربية": "🇸🇦 العربية",
    "日本語": "🇯🇵 日本語",
    "中文": "🇨🇳 中文"
  };
  if (savedLang && langEmojis[savedLang]) {
    languageBtn.textContent = langEmojis[savedLang];
  }
});

function selectPersonality(card) {
  document.querySelectorAll(".personality-option").forEach((c) => {
    c.classList.remove("active");
  });

  card.classList.add("active");
  selectedPersonality = card.dataset.personality;

  // ✅ Sauvegarde la personnalité
  localStorage.setItem("oryaPersonality", selectedPersonality);

  const title = card.querySelector("h4").textContent;
  addMessage(`✨ Personnalité activée : ${title}`, "bot");
}

/* Chat */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  addMessage("Orya réfléchit...", "bot", "loading");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        language: selectedLanguage,
        personality: selectedPersonality
      })
    });

    const data = await res.json();

    document.querySelector(".loading")?.remove();
    addMessage(data.reply, "bot");
    speak(data.reply);
  } catch (error) {
    document.querySelector(".loading")?.remove();
    addMessage("Erreur : impossible de contacter le serveur.", "bot");
  }
});

/* Voix Edge TTS */
async function speak(text) {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text,
        language: selectedLanguage,
        personality: selectedPersonality 
      })
    });

    if (!res.ok) {
      speakFallback(text);
      return;
    }

    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();

  } catch (error) {
    speakFallback(text);
  }
}

function speakFallback(text) {
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.12;
  utterance.pitch = 1.7;
  utterance.volume = 1;

  speechSynthesis.speak(utterance);
}

/* Fichier */
function chooseFile() {
  fileInput.click();
}
window.chooseFile = chooseFile;

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  addMessage(`📄 Fichier chargé : ${file.name}`, "user");
  addMessage("Je lis ton fichier...", "bot", "loading");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    document.querySelector(".loading")?.remove();

    if (data.preview) {
      addMessage(
        `J'ai bien lu ton fichier "${data.fileName}" 💗 Tu peux maintenant me poser des questions dessus.`,
        "bot"
      );
    } else {
      addMessage(data.message, "bot");
    }
  } catch (error) {
    document.querySelector(".loading")?.remove();
    addMessage("Erreur pendant l'envoi du fichier.", "bot");
  }
});

/* Audio mic */
function startVoice() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Ton navigateur ne supporte pas la reconnaissance vocale.");
    return;
  }

  const recognition = new SpeechRecognition();

  const langMap = {
    "français": "fr-FR",
    "english": "en-US",
    "العربية": "ar-SA",
    "日本語": "ja-JP",
    "中文": "zh-CN"
  };

  recognition.lang = langMap[selectedLanguage] || "fr-FR";
  recognition.start();

  recognition.onresult = (event) => {
    input.value = event.results[0][0].transcript;
    // ✅ Soumet automatiquement après reconnaissance vocale
    form.dispatchEvent(new Event("submit"));
  };

  recognition.onerror = () => {
    addMessage("Je n'ai pas pu t'entendre. Réessaie 🎙", "bot");
  };
}
window.startVoice = startVoice;