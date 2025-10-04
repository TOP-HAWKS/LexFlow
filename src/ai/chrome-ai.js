// Built-in AI wrappers (NOTE: APIs may change across Canary versions)

export async function summarizeOnDevice(text){
  if(!('ai' in self) || !('summarizer' in self.ai)) {
    throw new Error('Built-in Summarizer API not available in this Chrome build.');
  }
  const summarizer = await self.ai.summarizer.create();
  const result = await summarizer.summarize(text);
  return result;
}

export async function promptOnDevice(systemPrompt, userText){
  if(!('ai' in self) || !('assistant' in self.ai)) {
    throw new Error('Built-in Prompt API not available in this Chrome build.');
  }
  const assistant = await self.ai.assistant.create({ systemPrompt });
  const res = await assistant.prompt(userText);
  return res;
}