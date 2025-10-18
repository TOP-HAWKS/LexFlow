# 🤖 Guia Completo - API do Gemini Nano no Chrome

## 📋 Visão Geral

O Gemini Nano é o modelo de IA local integrado ao Chrome que permite executar tarefas de IA diretamente no navegador, sem enviar dados para servidores externos. Isso garante privacidade total e velocidade de resposta.

---

## ⚙️ **Configuração Necessária**

### **1. Chrome Canary (Obrigatório)**
```bash
# Download do Chrome Canary
https://www.google.com/chrome/canary/
```

### **2. Flags Experimentais (chrome://flags)**
Habilite estas flags no Chrome Canary:

```
chrome://flags/#prompt-api-for-gemini-nano
chrome://flags/#summarization-api-for-gemini-nano  
chrome://flags/#built-in-ai-api
```

**Status:** Enabled
**Reinicie o Chrome** após habilitar

### **3. Verificação de Disponibilidade**
```javascript
// Verificar se as APIs estão disponíveis
console.log('AI disponível:', 'ai' in self);
console.log('Prompt API:', 'ai' in self && 'assistant' in self.ai);
console.log('Summarizer API:', 'ai' in self && 'summarizer' in self.ai);
```

---

## 🔧 **APIs Disponíveis**

### **1. Prompt API (Conversação/Análise)**

#### **Função Básica:**
```javascript
export async function promptOnDevice(systemPrompt, userText) {
  // Verificar disponibilidade
  if (!('ai' in self) || !('assistant' in self.ai)) {
    throw new Error('Built-in Prompt API not available in this Chrome build.');
  }
  
  // Criar assistente com prompt de sistema
  const assistant = await self.ai.assistant.create({ 
    systemPrompt: systemPrompt 
  });
  
  // Enviar prompt do usuário
  const result = await assistant.prompt(userText);
  
  return result;
}
```

#### **Exemplo de Uso:**
```javascript
const systemPrompt = `Você é um assistente jurídico especializado em direito brasileiro. 
Analise textos legais com precisão e linguagem técnica apropriada.`;

const userPrompt = `Analise este artigo do Código Civil:
Art. 186. Aquele que, por ação ou omissão voluntária, negligência ou imprudência, 
violar direito e causar dano a outrem, ainda que exclusivamente moral, comete ato ilícito.

Forneça uma análise jurídica detalhada.`;

try {
  const resultado = await promptOnDevice(systemPrompt, userPrompt);
  console.log('Análise da IA:', resultado);
} catch (error) {
  console.error('Erro na IA:', error);
}
```

### **2. Summarizer API (Resumos)**

#### **Função Básica:**
```javascript
export async function summarizeOnDevice(text) {
  // Verificar disponibilidade
  if (!('ai' in self) || !('summarizer' in self.ai)) {
    throw new Error('Built-in Summarizer API not available in this Chrome build.');
  }
  
  // Criar resumidor
  const summarizer = await self.ai.summarizer.create();
  
  // Gerar resumo
  const result = await summarizer.summarize(text);
  
  return result;
}
```

#### **Exemplo de Uso:**
```javascript
const textoLegal = `Art. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza, 
garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade 
do direito à vida, à liberdade, à igualdade, à segurança e à propriedade...`;

try {
  const resumo = await summarizeOnDevice(textoLegal);
  console.log('Resumo:', resumo);
} catch (error) {
  console.error('Erro no resumo:', error);
}
```

---

## 🚀 **Implementação Avançada**

### **1. Função com Detecção de Disponibilidade**
```javascript
class ChromeAI {
  constructor() {
    this.available = this.checkAvailability();
  }

  checkAvailability() {
    return {
      ai: 'ai' in self,
      prompt: 'ai' in self && 'assistant' in self.ai,
      summarizer: 'ai' in self && 'summarizer' in self.ai
    };
  }

  async createAssistant(systemPrompt, options = {}) {
    if (!this.available.prompt) {
      throw new Error('Prompt API não disponível. Verifique as configurações do Chrome.');
    }

    const config = {
      systemPrompt: systemPrompt,
      ...options
    };

    return await self.ai.assistant.create(config);
  }

  async createSummarizer(options = {}) {
    if (!this.available.summarizer) {
      throw new Error('Summarizer API não disponível. Verifique as configurações do Chrome.');
    }

    const config = {
      type: 'tl;dr', // ou 'key-points', 'teaser', 'headline'
      format: 'markdown', // ou 'plain-text'
      length: 'medium', // ou 'short', 'long'
      ...options
    };

    return await self.ai.summarizer.create(config);
  }
}
```

### **2. Wrapper com Tratamento de Erro**
```javascript
class LexFlowAI {
  constructor() {
    this.chromeAI = new ChromeAI();
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async analyzeText(systemPrompt, userText, options = {}) {
    try {
      const assistant = await this.chromeAI.createAssistant(systemPrompt);
      const result = await assistant.prompt(userText);
      
      // Reset retry count on success
      this.retryCount = 0;
      
      return {
        success: true,
        result: result,
        source: 'chrome-ai'
      };
    } catch (error) {
      return this.handleAIError(error, 'analyze');
    }
  }

  async summarizeText(text, options = {}) {
    try {
      const summarizer = await this.chromeAI.createSummarizer(options);
      const result = await summarizer.summarize(text);
      
      this.retryCount = 0;
      
      return {
        success: true,
        result: result,
        source: 'chrome-ai'
      };
    } catch (error) {
      return this.handleAIError(error, 'summarize');
    }
  }

  handleAIError(error, operation) {
    console.error(`Erro na operação ${operation}:`, error);

    if (error.message.includes('not available')) {
      return {
        success: false,
        error: 'ai_not_available',
        message: 'Chrome AI não está disponível. Verifique as configurações.',
        fallback: 'manual_mode'
      };
    }

    if (error.message.includes('quota') || error.message.includes('limit')) {
      return {
        success: false,
        error: 'rate_limited',
        message: 'Limite de uso atingido. Tente novamente em alguns minutos.',
        fallback: 'retry_later'
      };
    }

    // Erro genérico
    return {
      success: false,
      error: 'unknown',
      message: 'Erro inesperado na IA. Tente novamente.',
      fallback: 'retry'
    };
  }
}
```

---

## 📝 **Exemplos Práticos para LexFlow**

### **1. Análise Jurídica Completa**
```javascript
async function analisarArtigos(artigos) {
  const lexflowAI = new LexFlowAI();
  
  const systemPrompt = `Você é um assistente jurídico especializado em direito brasileiro.
  Analise os artigos fornecidos e forneça:
  1. Resumo executivo
  2. Principais direitos e obrigações
  3. Implicações práticas
  4. Recomendações para aplicação`;

  const userPrompt = `Analise os seguintes artigos:
  ${artigos.map(art => `${art.number}: ${art.content}`).join('\n\n')}`;

  const resultado = await lexflowAI.analyzeText(systemPrompt, userPrompt);
  
  if (resultado.success) {
    return formatarResultado(resultado.result);
  } else {
    throw new Error(resultado.message);
  }
}
```

### **2. Geração de Cláusulas Contratuais**
```javascript
async function gerarClausulas(artigos, tipoContrato, parametros) {
  const lexflowAI = new LexFlowAI();
  
  const systemPrompt = `Você é um especialista em redação de contratos.
  Com base na legislação fornecida, gere cláusulas contratuais práticas e juridicamente válidas.`;

  const userPrompt = `
  Tipo de contrato: ${tipoContrato}
  Parâmetros: ${JSON.stringify(parametros)}
  
  Legislação base:
  ${artigos.map(art => `${art.number}: ${art.content}`).join('\n\n')}
  
  Gere cláusulas específicas em conformidade com a legislação.`;

  return await lexflowAI.analyzeText(systemPrompt, userPrompt);
}
```

### **3. Comparação de Normas**
```javascript
async function compararNormas(norma1, norma2) {
  const lexflowAI = new LexFlowAI();
  
  const systemPrompt = `Você é um especialista em análise comparativa de normas jurídicas.
  Compare as normas fornecidas identificando:
  1. Semelhanças e diferenças
  2. Hierarquia normativa
  3. Possíveis conflitos
  4. Recomendações de aplicação`;

  const userPrompt = `
  NORMA 1:
  ${norma1.map(art => `${art.number}: ${art.content}`).join('\n')}
  
  NORMA 2:
  ${norma2.map(art => `${art.number}: ${art.content}`).join('\n')}`;

  return await lexflowAI.analyzeText(systemPrompt, userPrompt);
}
```

---

## 🔍 **Debugging e Monitoramento**

### **1. Verificação de Status**
```javascript
function verificarStatusAI() {
  const status = {
    aiDisponivel: 'ai' in self,
    promptAPI: 'ai' in self && 'assistant' in self.ai,
    summarizerAPI: 'ai' in self && 'summarizer' in self.ai,
    userAgent: navigator.userAgent,
    chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]
  };
  
  console.table(status);
  return status;
}
```

### **2. Teste de Funcionalidade**
```javascript
async function testarAI() {
  try {
    // Teste Prompt API
    const assistant = await self.ai.assistant.create({
      systemPrompt: 'Você é um assistente útil.'
    });
    const promptResult = await assistant.prompt('Diga olá');
    console.log('✅ Prompt API funcionando:', promptResult);

    // Teste Summarizer API
    const summarizer = await self.ai.summarizer.create();
    const summaryResult = await summarizer.summarize('Este é um texto longo que precisa ser resumido para testar a funcionalidade.');
    console.log('✅ Summarizer API funcionando:', summaryResult);

    return { success: true, prompt: true, summarizer: true };
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return { success: false, error: error.message };
  }
}
```

---

## ⚠️ **Limitações e Considerações**

### **1. Disponibilidade**
- Apenas Chrome Canary com flags habilitadas
- APIs experimentais (podem mudar)
- Modelo pode não estar disponível imediatamente

### **2. Performance**
- Primeira execução pode ser lenta (download do modelo)
- Limite de tokens por requisição
- Possível rate limiting

### **3. Qualidade**
- Modelo menor que GPT-4/Claude
- Melhor para tarefas específicas e focadas
- Pode precisar de prompts mais detalhados

### **4. Fallbacks Recomendados**
```javascript
async function executarComFallback(operacao) {
  try {
    // Tentar Chrome AI primeiro
    return await operacao();
  } catch (error) {
    if (error.message.includes('not available')) {
      // Fallback para modo manual
      return { 
        success: false, 
        fallback: 'manual',
        message: 'Configure o Chrome AI ou use modo manual' 
      };
    }
    throw error;
  }
}
```

---

## 🎯 **Melhores Práticas**

### **1. Prompts Eficazes**
- Seja específico sobre o contexto jurídico
- Forneça exemplos quando possível
- Use linguagem técnica apropriada
- Defina formato de saída desejado

### **2. Tratamento de Erro**
- Sempre verificar disponibilidade
- Implementar fallbacks
- Informar usuário sobre limitações
- Logs detalhados para debugging

### **3. Performance**
- Cache resultados quando apropriado
- Limite tamanho do texto de entrada
- Use timeouts para evitar travamentos
- Monitore uso de memória

---

Este guia fornece tudo que você precisa para implementar e usar a API do Gemini Nano no LexFlow. A integração local garante privacidade total dos dados jurídicos enquanto oferece análises inteligentes para os advogados.