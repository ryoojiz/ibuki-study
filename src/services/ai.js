import { citationsService } from './citations'

export const aiService = {
  config: {
    apiKey: 'sk-u72MZX2E3geYa8cDHzJ0SLyn54X61zCXi0OfR0VFb84lgUEz',
    baseUrl: 'https://router.juan.web.id/v1',
    chatModel: 'gemma-4-31b-it',
    visionModel: 'gemma-4-31b-it',
    useDemoMode: false,
    language: 'English'
  },

  init() {
    const saved = localStorage.getItem('ibuki_ai_config');
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse AI configuration:', e);
      }
    }
  },

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('ibuki_ai_config', JSON.stringify(this.config));
  },

  isConfigured() {
    return this.config.useDemoMode || (this.config.apiKey && this.config.apiKey.trim() !== '');
  },

  async testConnection() {
    if (this.config.useDemoMode) {
      return { success: true, message: 'Demo Mode active (no connection needed).' };
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.chatModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
          stream: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return { success: true, message: 'Connection successful!' };
    } catch (error) {
      console.error('API connection test failed:', error);
      return { success: false, message: error.message };
    }
  },

  async analyzeSources(sources) {
    if (this.config.useDemoMode) {
      return this.generateDemoAnalysis(sources);
    }

    const contents = [];
    const systemPrompt = `You are "Ibuki AI", an advanced study assistant. Your job is to process student notes and whiteboard photos.
Analyze the provided sources (which can include handwritten notes, printed text, typed text, and pictures of whiteboards).
Perform the following actions:
1. OCR Transcription: Transcribe the contents of any images/whiteboards. Transcribe ALL formulas, text, diagrams, and bullet points.
2. Synthesis: Merge information from all sources.
3. Classification: Classify the notebook into exactly ONE "Subject" (e.g. Mathematics, Biology, Chemistry, Computer Science, Literature, History, Art) and ONE specific "Material" topic (e.g. "Linear Algebra", "Cell Division", "Acid-Base Reactions", "Data Structures"). Keep subject names simple, capital-case, and topic names descriptive.
4. Summary: Write a premium study guide in Markdown. Include headers, bullet points, key terms, definitions, and equations if applicable. Make it readable, detailed, and highly organized.
5. Inferred Title: Create a concise, relevant title for this notebook.

CITATION REQUIREMENT: The sources are numbered [1], [2], [3] ... in the exact order they are provided below. Whenever you refer to information from a source, you MUST cite it inline using this exact format: [[N|short verbatim quote]] where N is the source number and the quote is a short (max ~15 words) verbatim excerpt from that source. If the source is a PDF and you can determine the page, use [[N|short verbatim quote|Page Y]] (e.g., [[3|boiling point of water|Page 4]]). Never invent source numbers.

LANGUAGE REQUIREMENT: You MUST generate all text content ("title", "subject", "material", "transcription", "summary") in the following language: ${this.config.language}. Do not use any other language.

You must respond ONLY with a valid JSON object matching this schema:
{
  "title": "Concise inferred title for the notebook",
  "subject": "Single word or short phrase subject, e.g. Mathematics",
  "material": "Specific topic name, e.g. Differential Equations",
  "transcription": "Complete transcription/OCR of any whiteboard images or notes with citations",
  "summary": "Full comprehensive summary and study guide formatted in Markdown. Use headers, bullet points, bold text for key concepts, and include inline [[N|short verbatim quote]] citations throughout."
}
Do not write any markdown code wrapper or extra text outside the JSON object. Return the JSON object directly.`;

    contents.push({
      type: 'text',
      text: "Please analyze the following study notes and whiteboard photos. Here are the sources:\n\n"
    });

    let textCounter = 1;
    for (const src of sources) {
      if (src.type === 'text') {
        contents.push({
          type: 'text',
          text: `[Source Text #${textCounter++} - ${src.name || 'Typed Notes'}]:\n${src.content}\n\n`
        });
      } else if (src.type === 'image') {
        contents.push({
          type: 'text',
          text: `[Source #${textCounter++} - ${src.name || 'Image Notes'} (Notes/Whiteboard Snapshot)]:`
        });
        contents.push({
          type: 'image_url',
          image_url: {
            url: src.content
          }
        });
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.visionModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contents }
          ],
          response_format: { type: 'json_object' },
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Request failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const rawText = data.choices[0].message.content.trim();
      return this.parseJSONResponse(rawText);

    } catch (error) {
      console.error('Error during LLM analysis:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 120 seconds. The LLM API may be taking too long to process your request. Please try again with fewer or smaller sources.');
      }
      if (error.message.includes('524') || error.message.includes('520')) {
        throw new Error('The LLM API proxy timed out while processing your request. This usually means the request is too large or complex. Please try again with fewer or smaller sources.');
      }
      throw error;
    }
  },

  async chat(messages, contextTitle, contextType, contextText, onStream, sourceRegistry = []) {
    if (this.config.useDemoMode) {
      const reply = await this.generateDemoChatResponse(messages, contextTitle, contextType, sourceRegistry);
      if (onStream) onStream(reply);
      return reply;
    }

    const registryBlock = citationsService.buildRegistryPrompt(sourceRegistry);

    const systemPrompt = `You are "Ibuki AI", a premium, friendly study companion. You are assisting the student with questions about a specific ${contextType}: "${contextTitle}".
Here is the factual background context from their uploaded notebooks:
---------------------
${contextText}
---------------------
Answer the student's questions accurately, comprehensively, and specifically based on this context. 
If they ask questions outside this scope, politely answer but always tie it back to the subject/materials at hand.
Use markdown for structure, math formulas ($...$ or $$...$$), and format key concepts in bold.

CITATION REQUIREMENT: Whenever you state information that comes from the provided context, you MUST immediately follow the claim with an inline citation in exactly this format: [[N|short verbatim quote]] where N is the source number from the SOURCE REGISTRY below and the quote is a short (max ~15 words) verbatim excerpt copied from that source's content in the context. If the source is a PDF and you know the page, use [[N|short verbatim quote|Page X]]. Example: the derivative equals 2x [[2|f'(x) = 2x]]. Never invent source numbers; only cite numbers listed in the SOURCE REGISTRY. Statements not derived from the context need no citation.

SOURCE REGISTRY (citation numbers):
${registryBlock}

LANGUAGE REQUIREMENT: You MUST reply in the following language: ${this.config.language}.`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }))
    ];

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.chatModel,
          messages: apiMessages,
          temperature: 0.7,
          stream: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`API Chat failed with status ${response.status}${errorText ? `: ${errorText.slice(0, 300)}` : ''}`);
      }

      // Some OpenAI-compatible proxies ignore "stream: true" and return a
      // regular JSON body. Detect that and handle it gracefully instead of
      // parsing nothing (which used to produce blank chat bubbles).
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const data = await response.json();
        const choice = data?.choices?.[0];
        const full = choice?.message?.content ?? '';
        if (!full || !full.trim()) {
          throw new Error('The AI returned an empty response.');
        }
        if (onStream) onStream(full);
        return full.trim();
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      const processLine = (rawLine) => {
        const line = rawLine.trim();
        if (!line || line === 'data: [DONE]') return;

        // Accept both "data: {...}" and "data:{...}" (some proxies omit the space)
        if (!line.startsWith('data:')) return;
        const jsonStr = line.slice(5).trim();

        try {
          const data = JSON.parse(jsonStr);
          const choice = data?.choices?.[0];
          // Streaming chunks use delta.content; some providers send message.content
          const content = choice?.delta?.content ?? choice?.message?.content ?? '';
          if (content) {
            fullText += content;
            if (onStream) onStream(fullText);
          }
        } catch (e) {
          // Ignore keep-alive comments / partial fragments we cannot parse
          console.warn('Skipping unparseable stream chunk:', jsonStr.slice(0, 120));
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on real newlines (handles both \n and \r\n line endings)
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() || '';

        for (const line of parts) {
          processLine(line);
        }
      }

      // Flush any remaining buffered line (stream ended without trailing newline)
      if (buffer.trim()) {
        processLine(buffer);
      }

      if (!fullText.trim()) {
        throw new Error('The AI stream completed but produced no content. Check that the selected model supports chat completions.');
      }

      return fullText.trim();
    } catch (error) {
      console.error('Error during LLM chat:', error);
      throw error;
    }
  },

  parseJSONResponse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('Direct JSON parse failed. Attempting regex extract...', e);
    }

    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('Regex JSON block parse failed:', e);
      }
    }

    return {
      title: 'Auto-Analyzed Notes',
      subject: 'General Study',
      material: 'Unassigned',
      transcription: 'OCR transcription unavailable due to output format issue.',
      summary: `### Analysis Completed\n\nWe successfully processed your notes but could not parse the structured JSON response.\n\n**Raw output:**\n\n${text}`
    };
  },

  generateDemoAnalysis(sources) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Append a demo citation only when that source number exists
        const dc = (n, q) => (sources && sources.length >= n) ? (' [[' + n + '|' + q + ']]') : ''
        let hasMath = false;
        let hasBio = false;
        let sourceNames = sources.map(s => s.name || '').join(' ').toLowerCase();
        let sourceTexts = sources.filter(s => s.type === 'text').map(s => s.content).join(' ').toLowerCase();
        const fullContentText = sourceNames + ' ' + sourceTexts;

        if (fullContentText.includes('math') || fullContentText.includes('calculus') || fullContentText.includes('limit') || fullContentText.includes('derivat') || fullContentText.includes('matrix') || fullContentText.includes('equation') || fullContentText.includes('turunan') || fullContentText.includes('kalkulus')) {
          hasMath = true;
        } else if (fullContentText.includes('cell') || fullContentText.includes('mitosis') || fullContentText.includes('bio') || fullContentText.includes('organ') || fullContentText.includes('dna') || fullContentText.includes('sel')) {
          hasBio = true;
        }

        const lang = this.config.language || 'English';

        if (hasMath) {
          if (lang === 'Indonesian') {
            resolve({
              title: 'Kalkulus: Limit dan Kekontinuan',
              subject: 'Matematika',
              material: 'Kalkulus I',
              transcription: '[Transkripsi Catatan Papan Tulis]\nHukum limit, Definisi turunan: f\'(x) = lim_{h -> 0} (f(x+h) - f(x))/h.\nContoh: f(x) = x^2, f\'(x) = 2x.\nAturan L\'Hopital: lim f(x)/g(x) = lim f\'(x)/g\'(x) jika bentuknya 0/0 atau tak hingga/tak hingga.',
              summary: `### Kalkulus: Limit dan Kekontinuan

Materi ini membahas konsep-konsep dasar limit, kekontinuan fungsi, dan definisi formal dari turunan.

#### Konsep Utama

1. **Definisi Limit**
   - Nilai mendekati suatu fungsi ketika input mendekati titik tertentu.
   - Notasi: $\\lim_{x \\to c} f(x) = L$

2. **Syarat Kekontinuan**
   Suatu fungsi $f(x)$ dikatakan kontinu di titik $x = c$ jika dan hanya jika:
   - $f(c)$ terdefinisi.
   - $\\lim_{x \\to c} f(x)$ ada.
   - $\\lim_{x \\to c} f(x) = f(c)$.

3. **Teorema Limit Dasar**
   - **Aturan L'Hopital:** Digunakan untuk menyelesaikan bentuk tak tentu ($0/0$ atau $\\infty/\\infty$). Lakukan turunan pada pembilang dan penyebut.

#### Rumus Latihan
$$\\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h} = f'(x)$$`
            });
          } else if (lang === 'Japanese') {
            resolve({
              title: '微積分：極限と連続性',
              subject: '数学',
              material: '微積分 I',
              transcription: '[黒板の転記]\n極限法則、導関数の定義: f\'(x) = lim_{h -> 0} (f(x+h) - f(x))/h.\n例: f(x) = x^2, f\'(x) = 2x.\nロピタルの定理: 不定形 (0/0 または inf/inf) の場合、極限は分子と分母の導関数の極限に等しい。',
              summary: `### 微積分：極限と連続性

このレッスンでは、極限、連続関数、および導関数の正式な定義の基本概念について説明します。

#### 主要概念

1. **極限の定義**
   - 変数が一定の値に近づくときの関数の値。
   - 記法: $\\lim_{x \\to c} f(x) = L$

2. **連続性の条件**
   関数 $f(x)$ が $x = c$ で連続であるための必要十分条件：
   - $f(c)$ が定義されていること。
   - $\\lim_{x \\to c} f(x)$ が存在すること。
   - $\\lim_{x \\to c} f(x) = f(c)$ であること。

3. **主要な定理**
   - **ロピタルの定理:** $0/0$ または $\\infty/\\infty$ の不定形を評価する際に使用します。

#### 練習公式
$$\\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h} = f'(x)$$`
            });
          } else if (lang === 'Spanish') {
            resolve({
              title: 'Cálculo: Límites y Continuidad',
              subject: 'Matemáticas',
              material: 'Cálculo I',
              transcription: '[Transcripción de pizarra]\nLeyes de límites, Definición de derivada: f\'(x) = lim_{h -> 0} (f(x+h) - f(x))/h.\nEjemplo: f(x) = x^2, f\'(x) = 2x.\nRegla de L\'Hopital: lim f(x)/g(x) = lim f\'(x)/g\'(x) si la forma es 0/0 o inf/inf.',
              summary: `### Cálculo: Límites y Continuidad

Esta lección cubre los conceptos fundamentales de límites, funciones continuas y la definición formal de derivadas.

#### Conceptos Clave

1. **Definición de Límite**
   - El valor al que se acerca una función a medida que la entrada se acerca a algún valor.
   - Notación: $\\lim_{x \\to c} f(x) = L$

2. **Condiciones de Continuidad**
   Una función $f(x)$ es continua en $x = c$ si y solo si:
   - $f(c)$ está definida.
   - $\\lim_{x \\to c} f(x)$ existe.
   - $\\lim_{x \\to c} f(x) = f(c)$.

3. **Teoremas Fundamentales**
   - **Regla de L'Hopital:** Utilizada para evaluar formas indeterminadas ($0/0$ o $\\infty/\\infty$).

#### Fórmula de Práctica
$$\\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h} = f'(x)$$`
            });
          } else if (lang === 'French') {
            resolve({
              title: 'Calcul : Limites et Continuité',
              subject: 'Mathématiques',
              material: 'Calcul I',
              transcription: '[Transcription du tableau]\nLois des limites, Définition de la dérivée : f\'(x) = lim_{h -> 0} (f(x+h) - f(x))/h.\nExemple : f(x) = x^2, f\'(x) = 2x.\nRègle de L\'Hôpital : lim f(x)/g(x) = lim f\'(x)/g\'(x) si la forme est 0/0 ou inf/inf.',
              summary: `### Calcul : Limites et Continuité

Cette leçon couvre les concepts fondamentaux des limites, des fonctions continues et de la définition formelle des dérivées.

#### Concepts Clés

1. **Définition d'une Limite**
   - La valeur vers laquelle une fonction tend lorsque la variable approche une certaine valeur.
   - Notation : $\\lim_{x \\to c} f(x) = L$

2. **Conditions de Continuité**
   Une fonction $f(x)$ est continue en $x = c$ si et seulement si :
   - $f(c)$ est définie.
   - $\\lim_{x \\to c} f(x)$ existe.
   - $\\lim_{x \\to c} f(x) = f(c)$.

3. **Règle de L'Hôpital**
   - Utilisée pour évaluer les formes indéterminées ($0/0$ ou $\\infty/\\infty$).

#### Formule d'Entraînement
$$\\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h} = f'(x)$$`
            });
          } else {
            resolve({
              title: 'Calculus: Limits and Continuity',
              subject: 'Mathematics',
              material: 'Calculus I',
              transcription: '[OCR Whiteboard Snapshot transcription]\nLimit laws, Definition of derivative: f\'(x) = lim_{h -> 0} (f(x+h) - f(x))/h.\nExample: f(x) = x^2, f\'(x) = 2x.\nL\'Hopital\'s rule: lim f(x)/g(x) = lim f\'(x)/g\'(x) if form is 0/0 or inf/inf.',
              summary: `### Calculus: Limits and Continuity

This lesson covers the fundamental concepts of limits, continuous functions, and the formal definition of derivatives.

#### Core Concepts

1. **Definition of a Limit**${dc(1, 'the value a function approaches')}
   - The value that a function approaches as the input approaches some value.
   - Notation: $\\lim_{x \\to c} f(x) = L$

2. **Continuity Conditions**${dc(2, 'continuous at a point')}
   A function $f(x)$ is continuous at $x = c$ if and only if:
   - $f(c)$ is defined.
   - $\\lim_{x \\to c} f(x)$ exists.
   - $\\lim_{x \\to c} f(x) = f(c)$.

3. **Fundamental Limit Theorems**
   - **Limit of a Constant:** $\\lim_{x \\to c} k = k$
   - **Sum Rule:** $\\lim [f(x) + g(x)] = \\lim f(x) + \\lim g(x)$
   - **L'Hopital's Rule:** Used for evaluating indeterminate forms ($0/0$ or $\\infty/\\infty$). Take the derivative of the numerator and denominator.

#### Practice Formula
$$\\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h} = f'(x)$$`
            });
          }
        } else if (hasBio) {
          if (lang === 'Indonesian') {
            resolve({
              title: 'Mitosis dan Siklus Sel',
              subject: 'Biologi',
              material: 'Biologi Sel',
              transcription: '[Transkripsi Catatan Tulis Tangan]\nTahapan pembelahan sel:\n1. Profase - kromosom memadat, benang spindel terbentuk.\n2. Metafase - sejajar di tengah.\n3. Anafase - ditarik ke kutub berlawanan.\n4. Telofase - dua inti terbentuk.\nSitokinesis membelah sitoplasma.',
              summary: `### Mitosis dan Siklus Sel

Gambaran umum mengenai cara sel eukariotik mereplikasi dan membelah DNA untuk menciptakan sel anak yang identik.

#### Tahapan Mitosis

*   **Profase**: Kromatin memadat menjadi kromosom. Selubung inti mulai hancur, spindel terbentuk.
*   **Metafase**: Kromosom sejajar di garis tengah (lempeng metafase).
*   **Anafase**: Kromatid saudara ditarik ke kutub sel yang berlawanan oleh benang spindel.
*   **Telofase**: Kromosom tiba di kutub dan mulai memudar menjadi kromatin. Membran inti baru terbentuk.
*   **Sitokinesis**: Pembelahan sitoplasma menghasilkan dua sel anak diploid yang identik secara genetik.`
            });
          } else if (lang === 'Japanese') {
            resolve({
              title: '有糸分裂と細胞周期',
              subject: '生物学',
              material: '細胞生物学',
              transcription: '[手書きメモの転記]\n細胞分裂のステージ：\n1. 前期 - 染色体が凝縮し、紡錘体繊維が形成される。\n2. 中期 - 中央に並ぶ。\n3. 後期 - 両極に引っ張られる。\n4. 終期 - 2つの核が形成される。\n細胞質分裂で細胞質が分裂する。',
              summary: `### 有糸分裂と細胞周期

真核細胞がどのようにDNAを複製し、均等に分配して遺伝的に同一の娘細胞を作り出すかの全体像。

#### 有糸分裂の段階

*   **前期 (Prophase)**: クロマチンが染色体に凝縮し、核膜が消失し始めます。紡錘体が形成されます。
*   **中期 (Metaphase)**: 染色体が赤道面（細胞の中央）に並びます。
*   **後期 (Anaphase)**: 姉妹染色分体が分離し、紡錘体繊維によって細胞の両極へ引っ張られます。
*   **終期 (Telophase)**: 染色体が両極に到達し、脱凝縮します。新しい核膜が形成されます。
*   **細胞質分裂**: 細胞質が分割され、最終的に2つの遺伝的に同一の2倍体細胞になります。`
            });
          } else {
            resolve({
              title: 'Mitosis and the Cell Cycle',
              subject: 'Biology',
              material: 'Cell Biology',
              transcription: '[OCR Handwritten Notes transcription]\nCell division stages:\n1. Prophase - chromosomes condense, spindle fibers form.\n2. Metaphase - line up in middle.\n3. Anaphase - pulled apart to poles.\n4. Telophase - two nuclei form.\nCytokinesis splits cytoplasm.',
              summary: `### Mitosis and the Cell Cycle

A comprehensive overview of how eukaryotic cells replicate and divide their DNA to create identical daughter cells.

#### Stages of Mitosis

*   **Prophase**: Chromatin condenses into visible chromosomes. Spindle fibers form.
*   **Metaphase**: Chromosomes align along the metaphase plate (center).
*   **Anaphase**: Sister chromatids are pulled apart to opposite poles.
*   **Telophase**: Chromosomes arrive at poles and decondense. Two new nuclei form.
*   **Cytokinesis**: The division of the cytoplasm, resulting in two separate diploid cells.`
            });
          }
        } else {
          if (lang === 'Indonesian') {
            resolve({
              title: 'Pengantar Arsitektur Web',
              subject: 'Ilmu Komputer',
              material: 'Pengembangan Web',
              transcription: '[Transkripsi Papan Tulis]\nModel Client-Server.\nHTTP Request (GET, POST, PUT, DELETE) -> HTTP Response (200 OK, 404 Not Found).\nDatabase (IndexedDB untuk lokal, PostgreSQL untuk Server).',
              summary: `### Pengantar Arsitektur Web

Buku catatan ini merinci dasar-dasar interaksi client-server, protokol HTTP, dan penyimpanan data.

#### Poin Utama

1.  **Model Client-Server**
     *   **Client**: Browser pengguna yang meminta sumber daya.
     *   **Server**: Komputer jarak jauh yang memproses permintaan dan mengembalikan data.
2.  **Status Code HTTP Umum**
     *   \`200 OK\`: Permintaan berhasil.
     *   \`404 Not Found\`: Sumber daya tidak ditemukan.
3.  **Penyimpanan Sisi Client**
     *   **IndexedDB**: Database transaksional kaya di dalam browser yang mampu menyimpan data terstruktur dan file biner.`
            });
          } else if (lang === 'Japanese') {
            resolve({
              title: 'Webアーキテクチャ入門',
              subject: '情報科学',
              material: 'Web開発',
              transcription: '[黒板の転記]\nクライアント・サーバーモデル。\nHTTPリクエスト (GET, POST) -> HTTPレスポンス (200 OK, 404 Not Found)。\nデータベース (ローカルはIndexedDB、サーバーはPostgreSQL)。',
              summary: `### Webアーキテクチャ入門

このノートでは、クライアントとサーバーの相互作用、HTTPプロトコル、およびデータ永続化層の基礎について説明します。

#### 主な学習ポイント

1.  **クライアント・サーバーモデル**
     *   **クライアント**: リソースを要求するブラウザ。
     *   **サーバー**: 要求を処理して応答を返すコンピュータ。
2.  **一般的なHTTPステータスコード**
     *   \`200 OK\`: リクエスト成功。
     *   \`404 Not Found\`: リソースが見つかりません。
3.  **クライアント側ストレージ**
     *   **IndexedDB**: ブラウザ内の高機能なトランザクション型データベース。バイナリデータ等も保存可能。`
            });
          } else {
            resolve({
              title: 'Introduction to Web Architecture',
              subject: 'Computer Science',
              material: 'Web Development',
              transcription: '[OCR Whiteboard transcription]\nClient-Server Model.\nHTTP Request (GET, POST, PUT, DELETE) -> HTTP Response (200 OK, 404 Not Found, 500 Server Error).\nDatabase (IndexedDB on local, PostgreSQL on Server).\nWebSockets for realtime chat.',
              summary: `### Introduction to Web Architecture

This notebook details the fundamentals of client-server interaction, HTTP protocol conventions, and data persistence layers.

#### Key Takeaways

1.  **Client-Server Model**
     *   **Client**: The user agent (browser) that requests resources.
     *   **Server**: The remote machine that processes requests and returns responses.
2.  **Common HTTP Status Codes**
     *   \`200 OK\`: Request completed successfully.
     *   \`404 Not Found\`: Request resource does not exist.
3.  **Client-Side Persistence**
     *   **IndexedDB**: Rich, transactional database in the browser capable of storing complex structured data and binary files.`
            });
          }
        }
      }, 1500);
    });
  },

  generateDemoChatResponse(messages, contextTitle, contextType, sourceRegistry = []) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Append a demo citation only when that source number exists
        const dc = (n, q) => (sourceRegistry && sourceRegistry.length >= n) ? (' [[' + n + '|' + q + ']]') : ''
        const lastUserMessage = [...messages].reverse().find(msg => msg.sender === 'user')?.text.toLowerCase() || '';
        const lang = this.config.language || 'English';

        let reply = '';
        if (lang === 'Indonesian') {
          if (lastUserMessage.includes('halo') || lastUserMessage.includes('hai') || lastUserMessage.includes('hi') || lastUserMessage.includes('pagi') || lastUserMessage.includes('siang')) {
            reply = `Halo! Saya Asisten Belajar Ibuki. Saya siap membantu menjawab pertanyaan Anda terkait ${contextType} **"${contextTitle}"**. Apa yang ingin Anda tanyakan atau perjelas?`;
          } else if (lastUserMessage.includes('ringkas') || lastUserMessage.includes('rangkum') || lastUserMessage.includes('ringkasan') || lastUserMessage.includes('rangkuman')) {
            reply = `Tentu! Rangkuman singkat mengenai **${contextTitle}**:
- Topik ini mencakup prinsip inti dan formula penting dalam catatan Anda.
- Fokus utamanya adalah memahami alur kerja dan istilah tebal yang ada di panduan belajar.
- Beritahu saya jika Anda ingin berlatih menjawab kuis pemahaman!`;
          } else if (lastUserMessage.includes('kuis') || lastUserMessage.includes('tes') || lastUserMessage.includes('quiz') || lastUserMessage.includes('uji')) {
            reply = `Hebat! Mari uji pemahaman Anda mengenai **${contextTitle}**. 

Berikut pertanyaan pertama:
*Dapatkah Anda menjelaskan dengan kata-kata sendiri apa maksud utama dari tahapan atau konsep yang tertulis di catatan Anda?*

Ketik jawaban Anda di bawah, dan saya akan mengecek ketepatannya!`;
          } else {
            reply = `Pertanyaan yang menarik tentang **${contextTitle}**! Berdasarkan sumber data yang diunggah:

1. **Poin Penting**: Catatan Anda menunjukkan bagian ini sangat penting dan perlu dilatih berulang kali.${dc(1, 'konsep kunci dari catatan Anda')}
2. **Konteks Hubungan**: Dalam lingkup studi ${contextType}, ini terhubung erat dengan prinsip kerjanya.
3. **Tips Belajar**: Cobalah menulis sketsa gambar atau rumus ini tanpa melihat teks bantuan untuk memperkuat ingatan Anda jangka panjang.

Ada bagian dari rangkuman yang ingin Anda bahas detail langkah-demi-langkah?`;
          }
        } else if (lang === 'Japanese') {
          if (lastUserMessage.includes('こんにちは') || lastUserMessage.includes('はい') || lastUserMessage.includes('初めまして')) {
            reply = `こんにちは！学習アシスタントの「いぶき」です。${contextType} **「${contextTitle}」** について、ノートの内容に基づきどのような質問にもお答えします。何について詳しく説明しましょうか？`;
          } else if (lastUserMessage.includes('要約') || lastUserMessage.includes('まとめて') || lastUserMessage.includes('まとめ')) {
            reply = `はい、**「${contextTitle}」** の簡単なまとめは以下の通りです：
- アップロードされた資料に記載されている主要な概念と公式をカバーしています。
- 黒板画像で強調されていた主要ステップや条件が重点項目です。
- クイズで学習の理解度をチェックしたいときはいつでも声をかけてください！`;
          } else if (lastUserMessage.includes('クイズ') || lastUserMessage.includes('テスト') || lastUserMessage.includes('問題')) {
            reply = `素晴らしいですね！それでは、**「${contextTitle}」** に関する簡単な理解度クイズを出題します。

【第1問】
*要約に書かれている主要な段階や定義の違いについて、自分の言葉で説明してみてください。*

答えを入力してください。採点します！`;
          } else {
            reply = `**「${contextTitle}」** に関する良い質問ですね！アップロードされたノートによると：

1. **重要な詳細**: ノートの記述から、このポイントが試験対策などで最も重要な部分であることが分かります。${dc(1, 'ノートの重要な概念')}
2. **概念のつながり**: この ${contextType} の学習において、これは他のすべての基本ルールと連動しています。
3. **学習のアドバイス**: 黒板のスナップショット画像でも強く強調されていたため、ノートを見ずに書き出せるようになることをお勧めします。

公式のステップ解説など、さらに細分化して説明が必要な部分はありますか？`;
          }
        } else {
          if (lastUserMessage.includes('hello') || lastUserMessage.includes('hi') || lastUserMessage.includes('hey')) {
            reply = `Hello! I'm your Ibuki Study Companion. I can help answer questions based on your notes for the ${contextType} **"${contextTitle}"**. What would you like me to clarify or explain further?`;
          } else if (lastUserMessage.includes('summary') || lastUserMessage.includes('summarize')) {
            reply = `Sure! To summarize **${contextTitle}** briefly:
- It covers the core foundational concepts mentioned in your uploaded documents.
- The major focus is on setting up logical principles and defining core equations or stages.
- Let me know if you'd like me to quiz you on any specific bullet points from the summary tab!`;
          } else if (lastUserMessage.includes('quiz') || lastUserMessage.includes('test')) {
            reply = `Great! Let's do a quick quiz on **${contextTitle}**. 

Here is your first question:
*Can you explain, in your own words, the difference between the primary components or stages listed in your summary?*

Reply with your answer and I'll grade it for you!`;
          } else {
            reply = `That is a great question regarding **${contextTitle}**! Based on the uploaded sources:

1. **Focus on the Core Details**: The concepts present in your notes indicate this is a key topic.${dc(1, 'key concept from your notes')}
2. **Context-driven explanation**: In the context of ${contextType} study, this directly connects to the core definitions.
3. **Study tip**: Try practicing writing down this concept from memory, as visual captures of the whiteboard suggest it was emphasized during the lecture.

Is there any specific formula or stage from your notes you want me to break down step-by-step?`;
          }
        }
        resolve(reply);
      }, 800);
    });
  }
}