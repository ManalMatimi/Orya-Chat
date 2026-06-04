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

app.post("/api/chat", async (req, res) => {
  try {
    const { message, language, personality } = req.body;

    const systemPrompt = `
Tu es Orya, une assistante IA intelligente, douce et claire.

Langue obligatoire de réponse : ${language}
Personnalité : ${personality}

${lastFileContent ? `
Un fichier a été chargé par l'utilisateur.
Nom du fichier : ${lastFileName}

Voici le contenu du fichier :
"""
${lastFileContent.slice(0, 12000)}
"""

Tu dois répondre en te basant sur ce fichier quand la question concerne le document.
Si la réponse n'existe pas dans le fichier, dis clairement :
"Je ne trouve pas cette information dans le fichier."
` : `
Aucun fichier n'a encore été chargé.
Si l'utilisateur pose une question sur un fichier, demande-lui de charger un fichier.
`}

Question de l'utilisateur :
${message}
`;

    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "qwen2.5:1.5b",
      prompt: systemPrompt,
      stream: false
    });

    res.json({ reply: response.data.response });
  } catch (error) {
    res.status(500).json({
      reply: "Désolée, Ollama ne répond pas. Vérifie qu’il est bien lancé."
    });
  }
});

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

    <text x="256" y="375" text-anchor="middle"
      font-size="28" font-family="Arial" fill="#222">
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

  res.json({
    imageUrl: `data:image/svg+xml;base64,${imageBase64}`
  });
});

app.listen(3000, () => {
  console.log("Serveur lancé sur http://localhost:3000");
});
app.post("/api/tts", async (req, res) => {
  try {
    const { text, language } = req.body;

    const voices = {
      "français": "fr-FR-DeniseNeural",
      "english": "en-US-AvaMultilingualNeural",
      "العربية": "ar-SA-ZariyahNeural",
      "日本語": "ja-JP-NanamiNeural",
      "中文": "zh-CN-XiaoxiaoNeural"
    };

    const voice = voices[language] || "fr-FR-DeniseNeural";

    const tts = new EdgeTTS();

    const audioBuffer = await tts.synthesize(text, voice, {
      rate: "+12%",
      pitch: "+25Hz",
      volume: "+0%"
    });

    res.set({
      "Content-Type": "audio/mpeg"
    });

    res.send(audioBuffer);
  } catch (error) {
    console.error("Erreur TTS :", error);
    res.status(500).json({ message: "Erreur TTS" });
  }
});