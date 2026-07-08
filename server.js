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

  try {
    // 1. Extraer texto del enlace vía Jina AI con User-Agent
    const jinaResponse = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!jinaResponse.ok) {
      throw new Error(`No se pudo leer la URL (Status: ${jinaResponse.status})`);
    }

    const jinaData = await jinaResponse.json();
    const articleText = jinaData.data?.content || "";

    if (!articleText.trim()) {
      throw new Error("El enlace no contiene texto extraíble.");
    }

    // 2. Prompt de transformación
    const prompt = `Transforma el siguiente texto en una columna al estilo de Mariano Rajoy (frases obvias, redundantes, solemnes, redactado de forma sencilla para un niño de 5 años). Máximo 4 párrafos e incluye un titular al principio. No menciones el enlace ni la fuente.\n\nTexto:\n${articleText.substring(0, 2500)}`;

    // 3. Llamada a Hugging Face
    const hfResponse = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2.5-Coder-32B-Instruct', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 500, temperature: 0.7 }
      })
    });

    const hfData = await hfResponse.json();

    if (!hfResponse.ok) {
      const errorMsg = hfData.error || (typeof hfData === 'string' ? hfData : JSON.stringify(hfData));
      throw new Error(`Hugging Face Error: ${errorMsg}`);
    }

    let columnResult = "";
    if (Array.isArray(hfData) && hfData[0]?.generated_text) {
      columnResult = hfData[0].generated_text.replace(prompt, '').trim();
    } else if (hfData.generated_text) {
      columnResult = hfData.generated_text.replace(prompt, '').trim();
    } else {
      columnResult = typeof hfData === 'string' ? hfData : JSON.stringify(hfData);
    }

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
    console.error("Error en servidor:", err);
    return res.status(500).json({
      error: err.message || "Error al procesar la solicitud."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor MarIAno activo en puerto ${PORT}`);
});
