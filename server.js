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

  // 2. GENERAR COLUMNA VIA GROQ SEGÚN LAS REGLAS REFORZADAS DE MARIANO
  try {
    const prompt = `Tu tarea es transformar un texto en una columna hilarante escrita con el estilo inconfundible de un señor mayor, sobrio y registrador de la propiedad jubilado al estilo de Mariano Rajoy.
Sigue estas reglas estrictamente:

### Reglas generales:
1. La columna debe tener EXACTAMENTE 3 párrafos cortos, de máximo cuatro líneas cada uno.
2. El tono debe ser de señor mayor solemnísimo, institucional y burocrático, pero redactando OBVIEDADES ABSOLUTAS Y TRIVIALIDADES EXTREMAS explicadas como si fueran axiomas jurídicos de profunda trascendencia.
3. LÓGICA CIRCULAR Y REDUNDANCIA: Exagera las tautologías (ejemplo: "si algo sube, deja de estar abajo", "las cosas antes de ocurrir no han ocurrido", "cuando llovizna, la calle se moja a menos que esté techada").
4. Utiliza expresiones formales y señoriales propias de un registrador de la propiedad jubilado. Elige entre estas (variando entre párrafos):
   - "Sería conveniente recordar..."
   - "Ya se sabe lo que pasa cuando..."
   - "Miremos por donde lo miremos..."
   - "Es un hecho incontrovertible que..."
   - "A nadie se le escapa que..."
   - "Como es natural y por todos sabido..."
   - "Conviene no perder de vista que..."
   - "Si se me apura un poco..."
   - "Cualquier persona de bien comprende que..."
5. REGLA DE NO REPETICIÓN: Está TOTALMENTE PROHIBIDO repetir la misma muletilla o expresión señorial más de una vez en todo el texto. Usa conectores totalmente distintos en cada párrafo.
6. Incluye obligatoriamente entre dos y tres dichos o refranes populares aplicados de forma sobria pero desatinada, literal o redundantemente explicada.
7. PROHIBICIÓN ABSOLUTA DE CLICHÉS FAMOSOS: NO utilices frases reales ni clichés conocidos de Rajoy (NUNCA digas "los españoles son muy españoles", "el alcalde elige a los vecinos", ni "un plato es un plato"). EXCEPCIÓN ÚNICA: La frase "¡viva el vino!" sí está permitida únicamente si encaja como remate. Crea frases totalmente NUEVAS con esa misma lógica absurda.
8. No menciones el artículo original, ni enlaces, ni autor. NO incluyas introducciones, ni saludos, ni ningún titular. Entrega DIRECTAMENTE los 3 párrafos.

### Ejemplos de estilo que debes imitar:

Ejemplo 1:
“Miremos por donde lo miremos, cuando un expediente entra por la puerta, la puerta deja de estar vacía porque en ella se encuentra el expediente. Sería conveniente recordar que las cosas que están puestas en un sitio no están en otro, a menos que se trasladen, en cuyo caso cambian de lugar. Quien mucho abarca poco aprieta, pero el que no abarca nada, se queda con las manos completamente libres.

Es un hecho incontrovertible que el día tiene sus horas y la noche tiene las suyas, lo cual permite que la gente duerma cuando no está despierta. Ya se sabe lo que pasa si se intenta cenar al mismo tiempo que se almuerza: que una de las dos comidas sobra. A buen hambre no hay pan duro, salvo que el pan sea de piedra, en cuyo caso resulta impracticable para la dentadura.

A nadie se le escapa que el futuro tiene la particularidad de que viene después, mientras que el pasado se caracteriza por haber ocurrido previamente. Como es natural y por todos sabido, si se decide no avanzar, uno se queda exactamente donde estaba al principio. Más vale pájaro en mano que ciento volando, salvo que se prefiera el vuelo de las aves desde la distancia.”

Texto a transformar:
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
        temperature: 0.75
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
