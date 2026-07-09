const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Lee la API Key de Groq (o usa HF_TOKEN si se configuró en esa variable)
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

  // 2. GENERAR COLUMNA VIA GROQ CON LAS INSTRUCCIONES OPTIMIZADAS
  try {
    const prompt = `Tu tarea es transformar un texto en una columna escrita con el estilo de Mariano Rajoy.
Sigue estas reglas strictly:

### Reglas generales
1. La columna debe tener exactamente 3 párrafos cortos, de máximo cuatro líneas.
2. El tono debe ser infantil‑solemne: frases muy obvias, redundantes y explicaciones de cosas evidentes, con importancia exaggerated.
3. Habla como si fueras un adulto que explica el mundo a un niño de 5 años, creyendo que está diciendo algo muy profundo.
4. MULETILLA Y CONTRADICCIÓN: Haz que Mariano se líe un poco al hablar. Incluye al menos una vez la coletilla "o quizás no." al final de una frase, y justo a continuación haz que diga exactamente lo contrario de lo que acababa de afirmar.
5. No menciones el artículo original, ni el enlace, ni al autor. Solo genera la columna.
6. Incluye ÚNICAMENTE UN (1) dicho o refrán popular en toda la respuesta (está prohibido incluir dos o más).
7. No hagas introducciones de ningún tipo. Simplemente da el texto como lo diría Rajoy en tres párrafos. Sin redactar ningún titular.
8. REGLA DE NO REPETICIÓN: Evita repetir la misma coletilla o muletilla en el mismo output.

### Ejemplos de estilo que debes imitar:

Ejemplo 1:
“Estamos en cuartos de final. Eso significa que hemos ganado partidos antes, porque si no, no estaríamos aquí. Portugal es un equipo muy bueno, mejor que los malos. Ganaron la Eurocopa, que es un torneo de fútbol pero de Europa, y la Liga de las Naciones dos veces. Dos es más que uno.

No sé lo que va a pasar en cuartos, porque el futuro todavía no ha pasado. Sin embargo, sí sé que España va a ganar. O quizás no. En realidad, perder es una posibilidad muy real porque los rivales también juegan y meter goles es difícil. En Estados Unidos juegan al fútbol americano, que se llama fútbol pero no lo es. Y Bélgica tiene a Courtois, que para goles, pero si no le tiramos no tiene nada que parar.

Nadie nos ha marcado todavía. Cero es un número muy bueno cuando es en contra. Otra cosa sería si fuera a favor. Luego vendrá Francia, pero eso es mañana y hoy es hoy. Enhorabuena a todos, incluidos los que animamos desde casa. No metemos goles, pero contamos. Aunque menos que los jugadores, claro.”

Ejemplo 2:
“Hemos jugado mejor que antes y además hemos ganado, que es lo que hay que hacer para no perder. El seleccionador hizo cambios. Los cambios fueron buenos. Cuando los cambios son buenos, el equipo gana. Esto es lo que la experiencia dice y lo que ha pasado hoy.

España no se ha puesto nerviosa. Los nervios son malos porque cuando te pones nervioso haces las cosas mal, y cuando haces las cosas mal, pierdes. Hoy España ha estado tranquila. Hay gente que nunca está tranquila y siempre cree que tiene razón. Esa gente existe y cada vez hay más. Pero hoy la calma ha ganado a los nervios, y eso es bueno.

España es primera del grupo. Ser primero es mejor que ser segundo porque el primero está antes. Uruguay empató, que es peor que ganar. Con un empate ante ellos pasamos primeros y no nos toca Argentina, que es muy buena. Austria, Jordania o Argelia son menos buenas. Jugar contra equipos menos buenos es mejor que jugar contra equipos muy buenos.”

Ejemplo 3:
“Donald Trump ha pasado de estar muy enfadado a estar menos enfadado, lo cual demuestra que antes estaba enfadado y ahora ya no tanto. Cambiar de opinión significa que la idea que tienes por la tarde no es la misma que tenías por la mañana. A buen hambre no hay pan duro, y las cosas son como son y no como nos gustaría que fueran.

Estados Unidos es un país que está muy lejos, pero que existe y tiene un presidente. Si no compras cosas a un país, ese país no te vende nada, porque comprar y vender son dos cosas distintas que van juntas. Los aviones vuelan porque están en el aire y, si no estuvieran en el aire, se quedarían en el suelo de Rota o de Morón.

Pagar dinero cuesta dinero, y cuando pagas, tienes menos dinero pero la otra persona tiene más. Al final, estar enfadado es peor que no estarlo, porque estar contento es mucho mejor. Mañana será otro día y volverá a salir el sol por donde sale siempre, que es por el este.”

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
        temperature: 0.65
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
