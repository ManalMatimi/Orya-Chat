const { EdgeTTS } = require("edge-tts-universal");
const fs = require("fs");
async function test(voice, rate, pitch, name) {
  const tts = new EdgeTTS("Bonjour, je suis Orya, ton assistante.", voice, {rate, pitch, volume:"+0%"});
  const r = await tts.synthesize();
  const buf = Buffer.from(await r.audio.arrayBuffer());
  fs.writeFileSync(name + ".mp3", buf);
  console.log(name + ".mp3 cree");
}
(async () => {
  await test("fr-FR-EloiseNeural", "+15%", "+30Hz", "cute");
  await test("fr-FR-DeniseNeural", "+0%", "+0Hz", "pro");
  await test("fr-FR-YvetteNeural", "+25%", "+20Hz", "funny");
  console.log("Termine");
})();
