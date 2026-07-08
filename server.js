const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HF_TOKEN = process.env.HF_TOKEN;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const POLITICS_KEYWORDS = [
  "elecciones", "gobierno", "ministro", "presidente", "partido", 
  "congreso", "parlamento", "campaña", "voto", "coalición", 
  "diputado", "senado", "oposición", "amnistia", "mocion"
];

app.post('/transformar', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Por favor, introduce una URL válida." });
  }

  try {
    const jinaResponse = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!jinaResponse.ok) {
      throw new Error(`Error al leer el enlace (${jinaResponse.status})`);
    }

    const jinaData = await jinaResponse.json();
    const articleText = jinaData.data?.content || "";

    if (!articleText.trim()) {
      throw new Error("No se pudo extraer texto del enlace introducido.");
    }

    const lowerText = articleText.toLowerCase();
    if (POLITICS_KEYWORDS.some(word => lowerText.includes(word))) {
      return res.json({
        type: 'politics',
        header: 'MarIAno entiende de todo, menos de política.',
        content: '“Mire usted, yo de fútbol hablo encantado, y si me apuran, también de ciclismo. Pero de otras cosas no, que para eso ya hay gente muy preparada.”'
      });
    }

    const prompt = `
Tu tarea es transformar el siguiente texto en una columna escrita con el estilo de Mariano Rajoy.
REGLAS STRICTAS:
1. La columna debe tener exactamente 4 párrafos.
2. El tono debe ser infantil‑solemne: frases muy obvias, redundantes y explicaciones de cosas evidentes, con importancia exagerada.
3. Habla como si fueras un adulto que explica el mundo a un niño de 5 años, creyendo que está diciendo algo muy profundo.
4. Genera también un titular para la columna en el mismo estilo al principio.
5. No menciones el artículo original, ni el enlace, ni al autor. Solo genera la columna.

TEXTO A TRANSFORMACIÓN:
${articleText.substring(0, 3000)}
`;

    const hfResponse = await fetch('https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3-8B-Instruct',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.7
      })
    });

    const hfData = await hfResponse.json();

    if (!hfResponse.ok) {
      throw new Error(hfData.error || "Error al conectar con el servicio de Hugging Face.");
    }

    const columnResult = hfData.choices[0].message.content;

    const headers = [
      "Aquí tienes tu texto para que lo entienda todo el mundo, si es que todo el mundo lo puede entender, ¡viva el vino!",
      "Lo que está claro es que está claro, y el que no lo entienda es porque no lo ve, ¡viva el vino!",
      "A veces las cosas son sencillas porque no son complicadas, ¡viva el vino!",
      "Una columna evidente para un día que no deja de ser hoy, ¡viva el vino!"
    ];
    const randomHeader = headers[Math.floor(Math.random() * headers.length)];

    return res.json({
      type: 'column',
      header: randomHeader,
      content: columnResult
    });

  } catch (err) {
    return res.status(500).json({
      error: "Es el vecino el que elige esta app y es esta app la que quiere que sean los vecinos la app. Por favor, inténtalo de nuevo en un momento."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor MarIAno activo en puerto ${PORT}`);
});
