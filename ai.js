console.log("ai.js carregado ✅");

function progressLogger(prefix) {
  return (m) => {
    m.addEventListener('downloadprogress', (e) => {
      const pct = Math.round((e.loaded ?? 0) * 100);
      console.log(`${prefix} download: ${pct}%`);
    });
  };
}

// ---------- Summarizer API ----------
async function runSummarizer(text, outputLang = "en") {
  if (!('Summarizer' in self)) {
    throw new Error("Summarizer API não disponível.");
  }
  const options = {
    type: 'key-points',
    format: 'markdown',
    length: 'medium',
    outputLanguage: outputLang,
    monitor: progressLogger("Summarizer"),
  };
  const availability = await Summarizer.availability(options);
  if (availability === 'unavailable') {
    throw new Error("Summarizer indisponível no dispositivo.");
  }
  if (!navigator.userActivation.isActive) {
    throw new Error("É preciso um clique do usuário para ativar a IA.");
  }
  const summarizer = await Summarizer.create(options);
  return await summarizer.summarize(text);
}

// ---------- Prompt API (LanguageModel) ----------
async function runPrompt(systemInstruction, userText = "", outputLang = "en") {
  if (!('LanguageModel' in self)) {
    throw new Error("Prompt API (LanguageModel) não disponível.");
  }
  const modelOpts = {
    expectedInputs:  [{ type: "text", languages: ["en","es","ja"] }],
    expectedOutputs: [{ type: "text", languages: [outputLang] }],
    monitor: progressLogger("LanguageModel"),
  };
  const availability = await LanguageModel.availability(modelOpts);
  if (availability === 'unavailable') {
    throw new Error("LanguageModel indisponível no dispositivo.");
  }
  if (!navigator.userActivation.isActive) {
    throw new Error("Clique para ativar a IA.");
  }

  // Se o texto for muito grande, cortar em pedaços
  const CHUNK_LIMIT = 1500; // ~chars, simplificado
  const session = await LanguageModel.create({
    ...modelOpts,
    initialPrompts: [{ role: 'system', content: systemInstruction }]
  });

  if (userText.length <= CHUNK_LIMIT) {
    return await session.prompt(userText);
  } else {
    const parts = [];
    for (let i = 0; i < userText.length; i += CHUNK_LIMIT) {
      const sub = userText.slice(i, i + CHUNK_LIMIT);
      const partial = await session.prompt(sub);
      parts.push(partial);
    }
    // reduzir os resultados em uma nova chamada
    const reduceSys = [
      "You are a legal assistant. Synthesize the following partial outputs into one coherent answer.",
      "Preserve citations in format (LAW, ARTICLE)."
    ].join("\n");
    const reduceSession = await LanguageModel.create({
      ...modelOpts,
      initialPrompts: [{ role: "system", content: reduceSys }]
    });
    return await reduceSession.prompt(parts.join("\n\n"));
  }
}
