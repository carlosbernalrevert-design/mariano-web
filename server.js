const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Lee la API Key de Groq (o usa HF_TOKEN si pegaste ahí la clave)
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.HF_TOKEN;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/transformar', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Por favor, introduce una URL válida." });
  }

  let articleText = "";

  // 1. EXTRAER TEXTO DE LA NOTICIA VIA JINA AI
  try {
    const cleanUrl = url.trim().replace(/^https?:\/\//, '');
    const jinaUrl = `https://r.jina.ai/https://${cleanUrl}`;

    const jinaResponse = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!jinaResponse.ok) {
      throw new Error(`Estado ${jinaResponse.status}`);
    }

    articleText = await jinaResponse.text();

    if (!articleText || articleText.length < 50) {
      throw new Error("No se pudo extraer texto.");
    }
  } catch (err) {
    console.error("Error leyendo URL:", err);
    return res.status(500).json({
      error: `No se pudo acceder a la noticia (${err.message}). Comprueba el enlace.`
    });
  }

  // 2. GENERAR COLUMNA VIA GROQ (Estilo Rajoy exagerado, 3 párrafos, 2 refranes, sin titular)
  try {
    const prompt = `Imita a Mariano Rajoy de forma caricaturesca, exagerada, solemnísima e ingenua (explicado como para un niño de 5 años pero con tono institucional). Usa abundantes tautologías, trabalenguas absurdos y frases redundantes del tipo "cuanto peor mejor para todos", "un vaso es un vaso", "los españoles son muy españoles y mucho españoles".

Reglas obligatorias e inexcusables:
1. Redacta EXACTAMENTE 3 párrafos.
2. NO incluyas ningún titular, título ni encabezado. Empieza directamente el texto.
3. Debes incluir OBLIGATORIAMENTE DOS refranes o dichos populares tradicionales españoles adaptados o encajados en el texto.
4. No menciones el enlace ni la fuente.

Texto de la noticia a comentar:
${articleText.substring(0, 3000)}`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 650,
        temperature: 0.8
      })
    });

    const groqData = await groqResponse.json();

    if (!groqResponse.ok) {
      const errorMsg = groqData.error?.message || JSON.stringify(groqData);
      throw new Error(errorMsg);
    }

    const columnResult = groqData.choices?.[0]?.message?.content || "No se pudo generar el texto.";

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
    console.error("Error en IA:", err);
    return res.status(500).json({
      error: `Error al generar el texto: ${err.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor MarIAno activo en puerto ${PORT}`);
});
