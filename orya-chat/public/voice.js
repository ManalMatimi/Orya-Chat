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

  const recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.start();

  setOrbState("listening");
  statusText.textContent = "I am listening...";

  recognition.onresult = async (event) => {
    const userText = event.results[0][0].transcript;

    statusText.textContent = `You said: ${userText}`;
    setOrbState("speaking");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: userText,
        language: "français",
        personality: "cute, douce, gentille et encourageante"
      })
    });

    const data = await res.json();

    speak(data.reply);
  };

  recognition.onerror = () => {
    setOrbState("idle");
    statusText.textContent = "I could not hear you. Try again.";
  };
}

async function speak(text) {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text,
        language: "français"
      })
    });

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

    audio.play();
  } catch (error) {
    statusText.textContent = "Voice error.";
    setOrbState("idle");
  }
}