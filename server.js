const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Lee la API Key de Groq (o usa HF_TOKEN si pegaste ahí la clave de Groq)
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

  // 2. GENERAR COLUMNA VIA GROQ (LLAMA 3.3 70B - GRATIS Y ULTRARRÁPIDO)
  try {
    const prompt = `Transforma el siguiente texto en una columna escrita con el estilo de Mariano Rajoy (frases obvias, redundantes, solemnes, redactado de forma sencilla para un niño de 5 años). Máximo 4 párrafos e incluye un titular al principio. No menciones el enlace ni la fuente.\n\nTexto:\n${articleText.substring(0, 3000)}`;

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
        max_tokens: 600,
        temperature: 0.7
      })
    });

    const groqData = await groqResponse.json();

    if (!groqResponse.ok) {
      const errorMsg = groqData.error?.message || JSON.stringify(groqData);
      throw new Error(errorMsg);
    }

    const columnResult = groqData.choices?.[0]?.message?.content || "No se pudo generar la columna.";

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
      error: `Error al generar la columna: ${err.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor MarIAno activo en puerto ${PORT}`);
});
