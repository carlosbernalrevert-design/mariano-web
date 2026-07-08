const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HF_TOKEN = process.env.HF_TOKEN;

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

  // 2. GENERAR COLUMNA CON LLAMA 3.1 (100% COMPATIBLE Y GRATUITO)
  try {
    const prompt = `Transforma el siguiente texto en una columna escrita con el estilo de Mariano Rajoy (frases obvias, redundantes, solemnes, redactado de forma sencilla para un niño de 5 años). Máximo 4 párrafos e incluye un titular al principio. No menciones el enlace ni la fuente.\n\nTexto:\n${articleText.substring(0, 2000)}`;

    const hfResponse = await fetch('https://router.huggingface.co/hf-inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const hfData = await hfResponse.json();

    if (!hfResponse.ok) {
      const errorMsg = hfData.error || hfData.message || JSON.stringify(hfData);
      throw new Error(errorMsg);
    }

    const columnResult = hfData.choices?.[0]?.message?.content || "No se pudo generar la respuesta.";

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
