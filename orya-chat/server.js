const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { EdgeTTS } = require("edge-tts-universal");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static("public"));

let lastFileContent = "";
let lastFileName = "";

// ✅ Personnalités
const personalityPrompts = {
  "cute, douce, gentille et encourageante": `
Tu es Orya, une assistante IA adorable et douce 💗
- Tu utilises des emojis mignons (💗🌸✨💕🥺)
- Tu es très encourageante, chaleureuse et bienveillante
- Tes phrases sont courtes, légères et joyeuses
- Tu termines souvent par un encouragement ou un mot doux
`,
  "professionnelle, claire et sérieuse": `
Tu es Orya, une assistante IA professionnelle et rigoureuse.
- Aucun emoji
- Réponses structurées, précises et concises
- Vocabulaire formel et soutenu
- Tu vas droit au but sans fioritures
`,
  "drôle, fun et énergique": `
Tu es Orya, une assistante IA fun et pleine d'énergie 😂🔥
- Tu fais des blagues légères et des jeux de mots
- Tu utilises des expressions modernes et fun
- Beaucoup d'énergie et d'enthousiasme dans chaque réponse !
- Emojis fun et expressifs (😂🔥🎉💥🤣)
`,
  "professeure patiente qui explique aux débutants": `
Tu es Orya, une professeure bienveillante et pédagogue 📚
- Tu expliques toujours avec des analogies simples et des exemples concrets
- Tu décomposes les concepts étape par étape
- Tu vérifies la compréhension : "Tu comprends jusque-là ?"
- Ton calme et ta patience sont infinis
`
};

// ===================== CHAT =====================
app.post("/api/chat", async (req, res) => {
  try {
    const { message, language, personality } = req.body;

    const personalityText = personalityPrompts[personality] || personalityPrompts["cute, douce, gentille et encourageante"];

    const systemPrompt = `
${personalityText}

Langue obligatoire de réponse : ${language}
Tu DOIS répondre UNIQUEMENT en ${language}, sans exception.

${lastFileContent ? `
Un fichier a été chargé par l'utilisateur.
Nom du fichier : ${lastFileName}

Voici le contenu du fichier :
"""
${lastFileContent.slice(0, 12000)}
"""

Tu dois répondre en te basant sur ce fichier quand la question concerne le document.
Si la réponse n'existe pas dans le fichier, dis clairement que tu ne trouves pas cette information.
` : `
Aucun fichier n'a encore été chargé.
Si l'utilisateur pose une question sur un fichier, demande-lui d'en charger un.
`}

Question de l'utilisateur : ${message}
`;

    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "qwen2.5:1.5b",
      prompt: systemPrompt,
      stream: false
    });

    res.json({ reply: response.data.response });
  } catch (error) {
    res.status(500).json({
      reply: "Désolée, Ollama ne répond pas. Vérifie qu'il est bien lancé."
    });
  }
});

// ===================== UPLOAD =====================
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ message: "Aucun fichier reçu." });
    }

    const file = req.file;
    const originalName = file.originalname.toLowerCase();

    lastFileName = file.originalname;
    console.log("Fichier reçu :", file.originalname);

    if (originalName.endsWith(".txt")) {
      lastFileContent = fs.readFileSync(file.path, "utf8");
    } 
    else if (originalName.endsWith(".pdf")) {
      const dataBuffer = fs.readFileSync(file.path);
      const data = await pdfParse(dataBuffer);
      lastFileContent = data.text;
    } 
    else if (originalName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ path: file.path });
      lastFileContent = result.value;
    } 
    else {
      return res.json({
        message: "Type non supporté. Utilise seulement PDF, DOCX ou TXT."
      });
    }

    console.log("Contenu extrait :", lastFileContent.slice(0, 200));

    res.json({
      message: "Fichier lu avec succès.",
      fileName: lastFileName,
      preview: lastFileContent.slice(0, 800)
    });

  } catch (error) {
    console.error("Erreur upload :", error);
    res.status(500).json({
      message: "Erreur pendant la lecture du fichier : " + error.message
    });
  }
});

// ===================== IMAGE =====================
app.post("/api/image", async (req, res) => {
  const { prompt } = req.body;

  const svg = `
  <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f8d7ff"/>
        <stop offset="100%" stop-color="#dfffe2"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" rx="40" fill="url(#bg)"/>
    <circle cx="256" cy="210" r="85" fill="white" opacity="0.9"/>
    <circle cx="220" cy="195" r="12" fill="#222"/>
    <circle cx="292" cy="195" r="12" fill="#222"/>
    <path d="M225 240 Q256 270 287 240" stroke="#222" stroke-width="8" fill="none" stroke-linecap="round"/>
    <text x="256" y="375" text-anchor="middle" font-size="28" font-family="Arial" fill="#222">
      Image générée
    </text>
    <foreignObject x="60" y="395" width="392" height="80">
      <div xmlns="http://www.w3.org/1999/xhtml"
        style="font-family:Arial;text-align:center;font-size:18px;color:#333;">
        ${prompt}
      </div>
    </foreignObject>
  </svg>
  `;

  const imageBase64 = Buffer.from(svg).toString("base64");
  res.json({ imageUrl: `data:image/svg+xml;base64,${imageBase64}` });
});

// ===================== TTS (voix par personnalité) =====================
app.post("/api/tts", async (req, res) => {
  try {
    const { text, language, personality } = req.body;

    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ message: "Text manquant." });
    }

    // ✅ Nettoie les emojis qui cassent Edge TTS
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
      .replace(/[\u{1F700}-\u{1F77F}]/gu, "")
      .replace(/[\u{1F780}-\u{1F7FF}]/gu, "")
      .replace(/[\u{1F800}-\u{1F8FF}]/gu, "")
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
      .replace(/[\u{2600}-\u{26FF}]/gu, "")
      .replace(/[\u{2700}-\u{27BF}]/gu, "")
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
      .trim()
      .slice(0, 2000);

    if (!cleanText) {
      return res.status(400).json({ message: "Text vide après nettoyage." });
    }

    // ✅ Voix réelles disponibles par langue et personnalité
    const voices = {
      "français": {
        cute: "fr-FR-EloiseNeural",
        professional: "fr-FR-DeniseNeural",
        funny: "fr-FR-VivienneMultilingualNeural",
        teacher: "fr-FR-RemyMultilingualNeural"
      },
      "english": {
        cute: "en-US-AnaNeural",
        professional: "en-US-AriaNeural",
        funny: "en-US-JennyNeural",
        teacher: "en-US-AvaMultilingualNeural"
      },
      "العربية": {
        cute: "ar-SA-ZariyahNeural",
        professional: "ar-SA-ZariyahNeural",
        funny: "ar-SA-ZariyahNeural",
        teacher: "ar-SA-HamedNeural"
      },
      "日本語": {
        cute: "ja-JP-NanamiNeural",
        professional: "ja-JP-NanamiNeural",
        funny: "ja-JP-NanamiNeural",
        teacher: "ja-JP-KeitaNeural"
      },
      "中文": {
        cute: "zh-CN-XiaoxiaoNeural",
        professional: "zh-CN-XiaoxiaoNeural",
        funny: "zh-CN-XiaoyiNeural",
        teacher: "zh-CN-YunxiNeural"
      }
    };

    // ✅ Énergie (vitesse + hauteur) par personnalité
    const styles = {
      cute:         { rate: "+15%", pitch: "+30Hz" },
      professional: { rate: "+0%",  pitch: "+0Hz"  },
      funny:        { rate: "+25%", pitch: "+25Hz" },
      teacher:      { rate: "-8%",  pitch: "-5Hz"  }
    };

    // ✅ Détecte la personnalité
    let key = "cute";
    if (personality?.includes("professionnelle")) key = "professional";
    else if (personality?.includes("drôle")) key = "funny";
    else if (personality?.includes("professeure")) key = "teacher";

    const langVoices = voices[language] || voices["français"];
    const voice = langVoices[key];
    const style = styles[key];

    const tts = new EdgeTTS(cleanText, voice, {
      rate: style.rate,
      pitch: style.pitch,
      volume: "+0%"
    });

    const result = await tts.synthesize();
    const arrayBuffer = await result.audio.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    res.set({ "Content-Type": "audio/mpeg" });
    res.send(audioBuffer);

  } catch (error) {
    console.error("Erreur TTS :", error.message);
    res.status(500).json({ message: "Erreur TTS" });
  }
});

// ===================== LANCEMENT =====================
app.listen(3000, () => {
  console.log("Serveur lancé sur http://localhost:3000");
});