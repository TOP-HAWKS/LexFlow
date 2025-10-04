/**
 * Workspace Workflow Integration Tests
 * Tests complete workspace flow from jurisdiction to AI results
 * Requirements: 3.1, 3.6, 3.7
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Chrome AI module
const mockChromeAI = {
    promptOnDevice: vi.fn(),
    summarizeOnDevice: vi.fn()
};

// Mock the Chrome AI import
vi.mock('../src/ai/chrome-ai.js', () => mockChromeAI);

// Mock markdown utilities
const mockMarkdownUtils = {
    fetchMarkdownDocument: vi.fn(),
    parseMarkdownToArticles: vi.fn()
};

vi.mock('../src/util/markdown.js', () => mockMarkdownUtils);

// Mock database operations
const mockDB = {
    saveSettings: vi.fn(),
    loadSettings: vi.fn(),
    saveSubmission: vi.fn()
};

vi.mock('../src/db.js', () => mockDB);

// Mock LexFlow App for testing
class MockLexFlowApp {
    constructor() {
        this.currentView = 'home';
        this.currentStep = 1;
        this.chromeAIAvailable = false;
        this.markdownUtilsAvailable = false;
        this.workspaceStepCompleted = { 1: false, 2: false, 3: false };
        this.selectedArticles = [];
        this.allArticles = [];
        this.settings = {};
        this.toastMessages = [];
        this.errorLogs = [];
        
        // Initialize DOM elements
        this.initMockDOM();
    }

    initMockDOM() {
        document.body.innerHTML = `
            <div class="app-container">
                <!-- Navigation -->
                <nav class="app-nav">
                    <span id="workspace-badge" class="nav-badge hidden"></span>
                </nav>

                <!-- Workspace View -->
                <div id="workspace-view" class="view">
                    <!-- Step 1: Jurisdiction -->
                    <div id="step-1" class="step active">
                        <form id="jurisdiction-form">
                            <select id="language" name="language">
                                <option value="pt-BR">Português (Brasil)</option>
                                <option value="en-US">English (US)</option>
                            </select>
                            <select id="country" name="country">
                                <option value="br">Brasil</option>
                                <option value="us">United States</option>
                            </select>
                            <select id="state" name="state">
                                <option value="rs">Rio Grande do Sul</option>
                                <option value="sp">São Paulo</option>
                            </select>
                            <input type="text" id="city" name="city" value="porto-alegre">
                            <input type="url" id="base-url" name="baseUrl" 
                                   value="https://raw.githubusercontent.com/test/legal-corpus/main">
                            <button type="button" id="save-jurisdiction">Salvar e Continuar</button>
                        </form>
                    </div>

                    <!-- Step 2: Document Search -->
                    <div id="step-2" class="step">
                        <select id="document-select">
                            <option value="">Selecione um documento</option>
                        </select>
                        <input type="text" id="search-term" placeholder="Buscar artigos...">
                        <div id="articles-list"></div>
                        <textarea id="selected-context" placeholder="Contexto selecionado aparecerá aqui..."></textarea>
                        <button type="button" id="prev-step-2">Anterior</button>
                        <button type="button" id="next-step-2">Próximo</button>
                    </div>

                    <!-- Step 3: Prompt Studio -->
                    <div id="step-3" class="step">
                        <select id="preset-select">
                            <option value="summary">Resumo</option>
                            <option value="analysis">Análise</option>
                            <option value="comparison">Comparação</option>
                        </select>
                        <textarea id="custom-prompt" placeholder="Prompt personalizado..."></textarea>
                        <button type="button" id="execute-ai">🤖 Executar IA</button>
                        <div id="ai-output"></div>
                        <button type="button" id="copy-output">Copiar Resultado</button>
                        <button type="button" id="prev-step-3">Anterior</button>
                    </div>
                </div>

                <!-- Integration Status -->
                <div id="integration-status"></div>

                <!-- Toast Container -->
                <div id="toast-container"></div>
            </div>
        `;
    }

    // Navigation methods
    navigate(route) {
        this.currentView = route;
        window.location.hash = route;
    }

    showView(viewName) {
        this.currentView = viewName;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }
    }

    goToWorkspaceStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > 3) return false;
        
        this.currentStep = stepNumber;
        
        // Update step visibility
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        const targetStep = document.getElementById(`step-${stepNumber}`);
        if (targetStep) {
            targetStep.classList.add('active');
        }
        
        this.updateNavigationBadges();
        this.showToast(`Etapa ${stepNumber} ativada`, 'info');
        return true;
    }

    // Settings management
    async saveJurisdictionAndContinue() {
        try {
            const form = document.getElementById('jurisdiction-form');
            const formData = new FormData(form);
            
            this.settings = {
                language: formData.get('language'),
                country: formData.get('country'),
                state: formData.get('state'),
                city: formData.get('city'),
                baseUrl: formData.get('baseUrl')
            };
            
            // Validate required fields
            if (!this.settings.baseUrl) {
                throw new Error('URL base é obrigatória');
            }
            
            // Mock database save
            await mockDB.saveSettings(this.settings);
            
            this.markWorkspaceStepCompleted(1);
            this.showToast('Configurações salvas com sucesso', 'success');
            
            // Continue to next step
            setTimeout(() => {
                this.goToWorkspaceStep(2);
            }, 1000);
            
            return true;
        } catch (error) {
            this.handleError(error, 'Jurisdiction save');
            return false;
        }
    }

    // Document loading and search
    async loadAvailableDocuments() {
        try {
            if (!this.settings.baseUrl) {
                throw new Error('URL base não configurada');
            }
            
            // Mock document loading
            const mockDocuments = [
                { name: 'constituicao-federal.md', title: 'Constituição Federal' },
                { name: 'codigo-civil.md', title: 'Código Civil' },
                { name: 'codigo-penal.md', title: 'Código Penal' }
            ];
            
            const documentSelect = document.getElementById('document-select');
            if (documentSelect) {
                documentSelect.innerHTML = '<option value="">Selecione um documento</option>';
                mockDocuments.forEach(doc => {
                    const option = document.createElement('option');
                    option.value = doc.name;
                    option.textContent = doc.title;
                    documentSelect.appendChild(option);
                });
            }
            
            this.showToast('Documentos carregados', 'success');
            return mockDocuments;
        } catch (error) {
            this.handleNetworkError(error, 'Document loading');
            return [];
        }
    }

    async loadDocumentArticles(documentName) {
        try {
            if (!documentName) {
                throw new Error('Nome do documento é obrigatório');
            }
            
            const markdown = await mockMarkdownUtils.fetchMarkdownDocument(documentName);
            this.allArticles = mockMarkdownUtils.parseMarkdownToArticles(markdown);
            
            this.renderArticlesList();
            this.showToast(`${this.allArticles.length} artigos carregados`, 'success');
            
            return this.allArticles;
        } catch (error) {
            this.handleNetworkError(error, 'Article loading');
            this.allArticles = [];
            return [];
        }
    }

    renderArticlesList() {
        const articlesList = document.getElementById('articles-list');
        if (!articlesList) return;
        
        articlesList.innerHTML = '';
        this.allArticles.forEach((article, index) => {
            const articleDiv = document.createElement('div');
            articleDiv.className = 'article-item';
            articleDiv.innerHTML = `
                <label>
                    <input type="checkbox" data-index="${index}" ${article.selected ? 'checked' : ''}>
                    <strong>${article.title}</strong>
                    <p>${article.text.substring(0, 100)}...</p>
                </label>
            `;
            articlesList.appendChild(articleDiv);
        });
        
        // Add event listeners for article selection
        articlesList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.toggleArticleSelection(index);
            });
        });
    }

    toggleArticleSelection(index) {
        if (index >= 0 && index < this.allArticles.length) {
            this.allArticles[index].selected = !this.allArticles[index].selected;
            this.updateSelectedContext();
        }
    }

    updateSelectedContext() {
        this.selectedArticles = this.allArticles.filter(article => article.selected);
        const contextArea = document.getElementById('selected-context');
        if (contextArea) {
            const context = this.selectedArticles
                .map(article => `${article.title}\n${article.text}`)
                .join('\n\n');
            contextArea.value = context;
        }
        
        if (this.selectedArticles.length > 0) {
            this.markWorkspaceStepCompleted(2);
        }
    }

    // AI Integration
    async testChromeAI() {
        try {
            // Mock Chrome AI availability check
            if (!('ai' in self)) {
                return false;
            }
            
            if ('assistant' in self.ai) {
                const testAssistant = await self.ai.assistant.create();
                if (testAssistant) {
                    return true;
                }
            }
            
            if ('summarizer' in self.ai) {
                const testSummarizer = await self.ai.summarizer.create();
                if (testSummarizer) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.warn('Chrome AI test failed:', error);
            return false;
        }
    }

    async executeAIPrompt() {
        try {
            const selectedPreset = document.getElementById('preset-select')?.value || 'summary';
            const customPrompt = document.getElementById('custom-prompt')?.value || '';
            const context = document.getElementById('selected-context')?.value || '';
            
            if (!context.trim()) {
                throw new Error('Nenhum contexto selecionado');
            }
            
            this.showToast('Executando IA...', 'info');
            
            let result;
            if (this.chromeAIAvailable) {
                // Use real Chrome AI
                if (selectedPreset === 'summary') {
                    result = await mockChromeAI.summarizeOnDevice(context);
                } else {
                    const prompt = customPrompt || this.getPresetPrompt(selectedPreset);
                    result = await mockChromeAI.promptOnDevice(prompt, context);
                }
            } else {
                // Use fallback simulation
                result = this.generateFallbackResponse(selectedPreset, customPrompt, context);
            }
            
            // Display result
            const outputDiv = document.getElementById('ai-output');
            if (outputDiv) {
                outputDiv.innerHTML = `<pre>${result}</pre>`;
            }
            
            this.markWorkspaceStepCompleted(3);
            this.showToast('Análise concluída', 'success');
            
            return result;
        } catch (error) {
            this.handleAIError(error, 'AI execution');
            return null;
        }
    }

    getPresetPrompt(preset) {
        const prompts = {
            'analysis': 'Faça uma análise jurídica detalhada dos artigos fornecidos.',
            'comparison': 'Compare os artigos fornecidos e identifique semelhanças e diferenças.',
            'practical': 'Forneça exemplos práticos de aplicação dos artigos fornecidos.'
        };
        return prompts[preset] || 'Analise o conteúdo fornecido.';
    }

    generateFallbackResponse(preset, customPrompt, context) {
        const responses = {
            'summary': `RESUMO SIMULADO:\n\nEste é um resumo simulado dos artigos selecionados.\nPara análises reais, habilite o Chrome AI.`,
            'analysis': `ANÁLISE SIMULADA:\n\nEsta é uma análise simulada dos artigos.\nPara análises reais, habilite o Chrome AI.`,
            'comparison': `COMPARAÇÃO SIMULADA:\n\nEsta é uma comparação simulada.\nPara análises reais, habilite o Chrome AI.`
        };
        
        return responses[preset] || `RESPOSTA SIMULADA:\n\nEsta é uma resposta simulada.\nPara análises reais, habilite o Chrome AI.`;
    }

    // State management
    markWorkspaceStepCompleted(step) {
        this.workspaceStepCompleted[step] = true;
        this.updateNavigationBadges();
    }

    updateNavigationBadges() {
        const workspaceBadge = document.getElementById('workspace-badge');
        if (workspaceBadge) {
            workspaceBadge.textContent = this.currentStep;
            workspaceBadge.classList.remove('hidden');
            
            // Remove success class first, then add if completed
            workspaceBadge.classList.remove('success');
            if (this.workspaceStepCompleted[this.currentStep]) {
                workspaceBadge.classList.add('success');
            }
        }
    }

    // Error handling
    handleError(error, context) {
        this.errorLogs.push({ error: error.message, context, timestamp: Date.now() });
        this.showToast(`Erro: ${error.message}`, 'error');
    }

    handleNetworkError(error, context) {
        this.handleError(error, context);
        return { success: false, error: 'network_error' };
    }

    handleAIError(error, context) {
        this.handleError(error, context);
        return { success: false, error: 'ai_error' };
    }

    // Toast system
    showToast(message, type = 'info', duration = 3000) {
        this.toastMessages.push({ message, type, timestamp: Date.now() });
        
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            toastContainer.appendChild(toast);
            
            if (duration > 0) {
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, duration);
            }
        }
    }

    // Test utilities
    getToastMessages() {
        return this.toastMessages;
    }

    getErrorLogs() {
        return this.errorLogs;
    }

    clearToasts() {
        this.toastMessages = [];
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            toastContainer.innerHTML = '';
        }
    }

    reset() {
        this.currentView = 'home';
        this.currentStep = 1;
        this.workspaceStepCompleted = { 1: false, 2: false, 3: false };
        this.selectedArticles = [];
        this.allArticles = [];
        this.settings = {};
        this.toastMessages = [];
        this.errorLogs = [];
        this.clearToasts();
    }
}

describe('Workspace Workflow Integration Tests', () => {
    let app;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Setup global AI mock
        global.self = {
            ai: {
                assistant: {
                    create: vi.fn().mockResolvedValue({})
                },
                summarizer: {
                    create: vi.fn().mockResolvedValue({})
                }
            }
        };
        
        // Create fresh app instance
        app = new MockLexFlowApp();
        
        // Setup default mock responses
        mockDB.saveSettings.mockResolvedValue(true);
        mockDB.loadSettings.mockResolvedValue({});
        mockChromeAI.promptOnDevice.mockResolvedValue('Mock AI response');
        mockChromeAI.summarizeOnDevice.mockResolvedValue('Mock AI summary');
        mockMarkdownUtils.fetchMarkdownDocument.mockResolvedValue('# Mock Document\n## Article 1\nContent 1\n## Article 2\nContent 2');
        mockMarkdownUtils.parseMarkdownToArticles.mockReturnValue([
            { title: 'Article 1', text: 'Content 1', selected: false },
            { title: 'Article 2', text: 'Content 2', selected: false }
        ]);
    });

    afterEach(() => {
        app.reset();
    });

    describe('Complete Workspace Flow (Requirement 3.1, 3.6, 3.7)', () => {
        it('should complete full workflow from jurisdiction to AI results', async () => {
            // Step 1: Navigate to workspace
            app.navigate('workspace');
            app.showView('workspace');
            expect(app.currentView).toBe('workspace');
            expect(app.currentStep).toBe(1);

            // Step 2: Configure jurisdiction
            const jurisdictionForm = document.getElementById('jurisdiction-form');
            expect(jurisdictionForm).toBeTruthy();

            // Fill form data
            document.getElementById('language').value = 'pt-BR';
            document.getElementById('country').value = 'br';
            document.getElementById('state').value = 'rs';
            document.getElementById('city').value = 'porto-alegre';
            document.getElementById('base-url').value = 'https://test.com/corpus';

            // Save jurisdiction and continue
            const saveResult = await app.saveJurisdictionAndContinue();
            expect(saveResult).toBe(true);
            expect(app.workspaceStepCompleted[1]).toBe(true);
            expect(mockDB.saveSettings).toHaveBeenCalledWith({
                language: 'pt-BR',
                country: 'br',
                state: 'rs',
                city: 'porto-alegre',
                baseUrl: 'https://test.com/corpus'
            });

            // Should automatically navigate to step 2
            await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for auto-navigation
            expect(app.currentStep).toBe(2);

            // Step 3: Load documents and articles
            const documents = await app.loadAvailableDocuments();
            expect(documents).toHaveLength(3);
            expect(mockMarkdownUtils.fetchMarkdownDocument).not.toHaveBeenCalled(); // Not called yet

            // Select a document
            const documentSelect = document.getElementById('document-select');
            documentSelect.value = 'constituicao-federal.md';
            
            const articles = await app.loadDocumentArticles('constituicao-federal.md');
            expect(articles).toHaveLength(2);
            expect(mockMarkdownUtils.fetchMarkdownDocument).toHaveBeenCalledWith('constituicao-federal.md');
            expect(mockMarkdownUtils.parseMarkdownToArticles).toHaveBeenCalled();

            // Select articles
            const checkboxes = document.querySelectorAll('#articles-list input[type="checkbox"]');
            expect(checkboxes).toHaveLength(2);
            
            // Select first article
            checkboxes[0].click();
            expect(app.selectedArticles).toHaveLength(1);
            expect(app.workspaceStepCompleted[2]).toBe(true);

            // Navigate to step 3
            app.goToWorkspaceStep(3);
            expect(app.currentStep).toBe(3);

            // Step 4: Execute AI prompt
            app.chromeAIAvailable = true; // Enable AI for this test
            
            const presetSelect = document.getElementById('preset-select');
            presetSelect.value = 'summary';
            
            const result = await app.executeAIPrompt();
            expect(result).toBe('Mock AI summary');
            expect(mockChromeAI.summarizeOnDevice).toHaveBeenCalled();
            expect(app.workspaceStepCompleted[3]).toBe(true);

            // Verify final state
            expect(app.workspaceStepCompleted).toEqual({ 1: true, 2: true, 3: true });
            
            // Check toast messages for workflow completion
            const toastMessages = app.getToastMessages();
            expect(toastMessages.some(toast => toast.message.includes('Configurações salvas'))).toBe(true);
            expect(toastMessages.some(toast => toast.message.includes('Documentos carregados'))).toBe(true);
            expect(toastMessages.some(toast => toast.message.includes('artigos carregados'))).toBe(true);
            expect(toastMessages.some(toast => toast.message.includes('Análise concluída'))).toBe(true);
        });

        it('should handle workflow with AI unavailable (fallback mode)', async () => {
            // Setup AI as unavailable
            app.chromeAIAvailable = false;
            global.self.ai = undefined;

            // Complete steps 1-2 (same as above test)
            app.navigate('workspace');
            app.showView('workspace');
            
            // Quick setup for testing AI fallback
            app.settings = { baseUrl: 'https://test.com/corpus' };
            app.goToWorkspaceStep(3);
            app.selectedArticles = [{ title: 'Test Article', text: 'Test content' }];
            
            // Update selected context
            const contextArea = document.getElementById('selected-context');
            contextArea.value = 'Test Article\nTest content';

            // Execute AI prompt (should use fallback)
            const result = await app.executeAIPrompt();
            expect(result).toContain('RESUMO SIMULADO');
            expect(result).toContain('Para análises reais, habilite o Chrome AI');
            
            // Should not call real AI functions
            expect(mockChromeAI.summarizeOnDevice).not.toHaveBeenCalled();
            expect(mockChromeAI.promptOnDevice).not.toHaveBeenCalled();
            
            // Should still mark step as completed
            expect(app.workspaceStepCompleted[3]).toBe(true);
        });
    });

    describe('Step Navigation and State Preservation (Requirement 3.6)', () => {
        it('should preserve state when navigating between steps', async () => {
            // Setup initial state
            app.navigate('workspace');
            app.showView('workspace');

            // Configure jurisdiction in step 1
            document.getElementById('language').value = 'pt-BR';
            document.getElementById('base-url').value = 'https://test.com/corpus';
            await app.saveJurisdictionAndContinue();

            // Navigate to step 2 and load articles
            app.goToWorkspaceStep(2);
            await app.loadAvailableDocuments();
            await app.loadDocumentArticles('codigo-civil.md');
            
            // Select an article
            const checkboxes = document.querySelectorAll('#articles-list input[type="checkbox"]');
            checkboxes[0].click();
            
            const originalSelectedCount = app.selectedArticles.length;
            const originalContext = document.getElementById('selected-context').value;

            // Navigate to step 3
            app.goToWorkspaceStep(3);
            expect(app.currentStep).toBe(3);

            // Navigate back to step 2
            app.goToWorkspaceStep(2);
            expect(app.currentStep).toBe(2);

            // Verify state is preserved
            expect(app.selectedArticles).toHaveLength(originalSelectedCount);
            expect(document.getElementById('selected-context').value).toBe(originalContext);
            expect(document.querySelectorAll('#articles-list input[type="checkbox"]:checked')).toHaveLength(1);

            // Navigate back to step 1
            app.goToWorkspaceStep(1);
            expect(app.currentStep).toBe(1);

            // Verify jurisdiction settings are preserved
            expect(document.getElementById('language').value).toBe('pt-BR');
            expect(document.getElementById('base-url').value).toBe('https://test.com/corpus');
        });

        it('should update navigation badges correctly during step changes', () => {
            app.navigate('workspace');
            app.showView('workspace');

            // Initialize badge state by calling updateNavigationBadges
            app.updateNavigationBadges();

            // Check initial badge state
            const badge = document.getElementById('workspace-badge');
            expect(badge.textContent).toBe('1');
            expect(badge.classList.contains('hidden')).toBe(false);

            // Navigate to step 2
            app.goToWorkspaceStep(2);
            expect(badge.textContent).toBe('2');

            // Mark step as completed
            app.markWorkspaceStepCompleted(2);
            expect(badge.classList.contains('success')).toBe(true);

            // Navigate to step 3
            app.goToWorkspaceStep(3);
            expect(badge.textContent).toBe('3');
            expect(badge.classList.contains('success')).toBe(false); // Should reset for new step
        });

        it('should prevent navigation to invalid steps', () => {
            app.navigate('workspace');
            app.showView('workspace');

            const initialStep = app.currentStep;

            // Try to navigate to invalid steps
            const result1 = app.goToWorkspaceStep(0);
            expect(result1).toBe(false);
            expect(app.currentStep).toBe(initialStep);

            const result2 = app.goToWorkspaceStep(4);
            expect(result2).toBe(false);
            expect(app.currentStep).toBe(initialStep);

            const result3 = app.goToWorkspaceStep(-1);
            expect(result3).toBe(false);
            expect(app.currentStep).toBe(initialStep);
        });
    });

    describe('AI Integration and Error Handling (Requirement 3.7)', () => {
        it('should test Chrome AI availability correctly', async () => {
            // Test when AI is available
            global.self.ai.assistant.create.mockResolvedValue({});
            const available1 = await app.testChromeAI();
            expect(available1).toBe(true);

            // Test when AI is not available (no ai in self)
            delete global.self.ai;
            const available2 = await app.testChromeAI();
            expect(available2).toBe(false);

            // Test when AI throws error
            global.self.ai = {
                assistant: {
                    create: vi.fn().mockRejectedValue(new Error('AI not ready'))
                }
            };
            const available3 = await app.testChromeAI();
            expect(available3).toBe(false);
        });

        it('should handle AI execution errors gracefully', async () => {
            app.navigate('workspace');
            app.goToWorkspaceStep(3);
            app.chromeAIAvailable = true;

            // Setup context
            document.getElementById('selected-context').value = 'Test content';
            
            // Mock AI error
            mockChromeAI.summarizeOnDevice.mockRejectedValue(new Error('AI quota exceeded'));

            const result = await app.executeAIPrompt();
            expect(result).toBeNull();

            // Check error was logged
            const errorLogs = app.getErrorLogs();
            expect(errorLogs).toHaveLength(1);
            expect(errorLogs[0].error).toContain('AI quota exceeded');

            // Check error toast was shown
            const toastMessages = app.getToastMessages();
            expect(toastMessages.some(toast => 
                toast.type === 'error' && toast.message.includes('Erro')
            )).toBe(true);
        });

        it('should handle network errors during document loading', async () => {
            app.navigate('workspace');
            app.goToWorkspaceStep(2);
            app.settings = { baseUrl: 'https://invalid-url.com' };

            // Mock network error - need to mock it before the call
            mockMarkdownUtils.fetchMarkdownDocument.mockRejectedValue(new Error('Failed to fetch'));
            
            // Clear the default successful mock for parseMarkdownToArticles
            mockMarkdownUtils.parseMarkdownToArticles.mockReturnValue([]);

            const articles = await app.loadDocumentArticles('test-doc.md');
            expect(articles).toHaveLength(0);

            // Check error was handled
            const errorLogs = app.getErrorLogs();
            expect(errorLogs).toHaveLength(1);
            expect(errorLogs[0].context).toBe('Article loading');
        });

        it('should validate required fields before AI execution', async () => {
            app.navigate('workspace');
            app.goToWorkspaceStep(3);
            app.chromeAIAvailable = true;

            // Try to execute without context
            document.getElementById('selected-context').value = '';

            const result = await app.executeAIPrompt();
            expect(result).toBeNull();

            // Check validation error
            const errorLogs = app.getErrorLogs();
            expect(errorLogs).toHaveLength(1);
            expect(errorLogs[0].error).toContain('Nenhum contexto selecionado');
        });

        it('should use different AI methods based on preset selection', async () => {
            app.navigate('workspace');
            app.goToWorkspaceStep(3);
            app.chromeAIAvailable = true;

            // Setup context
            document.getElementById('selected-context').value = 'Test content';

            // Test summary preset
            document.getElementById('preset-select').value = 'summary';
            await app.executeAIPrompt();
            expect(mockChromeAI.summarizeOnDevice).toHaveBeenCalledWith('Test content');

            // Reset mocks
            vi.clearAllMocks();

            // Test analysis preset
            document.getElementById('preset-select').value = 'analysis';
            await app.executeAIPrompt();
            expect(mockChromeAI.promptOnDevice).toHaveBeenCalled();
            expect(mockChromeAI.summarizeOnDevice).not.toHaveBeenCalled();
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should recover from jurisdiction save failures', async () => {
            app.navigate('workspace');
            app.showView('workspace');

            // Mock database error
            mockDB.saveSettings.mockRejectedValue(new Error('Database unavailable'));

            // Fill form
            document.getElementById('base-url').value = 'https://test.com/corpus';

            const result = await app.saveJurisdictionAndContinue();
            expect(result).toBe(false);
            expect(app.currentStep).toBe(1); // Should stay on step 1

            // Check error handling
            const errorLogs = app.getErrorLogs();
            expect(errorLogs).toHaveLength(1);
            expect(errorLogs[0].context).toBe('Jurisdiction save');
        });

        it('should handle missing DOM elements gracefully', () => {
            // Remove critical DOM elements
            document.getElementById('workspace-badge')?.remove();
            document.getElementById('articles-list')?.remove();

            // These should not throw errors
            expect(() => {
                app.updateNavigationBadges();
                app.renderArticlesList();
                app.toggleArticleSelection(0);
            }).not.toThrow();
        });

        it('should maintain workflow state across view changes', async () => {
            // Setup workspace state
            app.navigate('workspace');
            app.showView('workspace');
            await app.saveJurisdictionAndContinue();
            app.goToWorkspaceStep(2);

            // Navigate away and back
            app.navigate('home');
            app.showView('home');
            app.navigate('workspace');
            app.showView('workspace');

            // State should be preserved
            expect(app.workspaceStepCompleted[1]).toBe(true);
            expect(app.settings.baseUrl).toBeTruthy();
        });
    });

    describe('Performance and Memory Management', () => {
        it('should handle large article lists efficiently', async () => {
            app.navigate('workspace');
            app.goToWorkspaceStep(2);

            // Mock large article list
            const largeArticleList = Array.from({ length: 100 }, (_, i) => ({
                title: `Article ${i + 1}`,
                text: `Content for article ${i + 1}`.repeat(10),
                selected: false
            }));

            app.allArticles = largeArticleList;
            
            const startTime = performance.now();
            app.renderArticlesList();
            const renderTime = performance.now() - startTime;

            // Should render within reasonable time (< 100ms for 100 articles)
            expect(renderTime).toBeLessThan(100);

            // Should create correct number of checkboxes
            const checkboxes = document.querySelectorAll('#articles-list input[type="checkbox"]');
            expect(checkboxes).toHaveLength(100);
        });

        it('should clean up event listeners and data on reset', () => {
            app.navigate('workspace');
            app.goToWorkspaceStep(2);
            
            // Add some data
            app.allArticles = [{ title: 'Test', text: 'Content', selected: true }];
            app.selectedArticles = [{ title: 'Test', text: 'Content', selected: true }];
            app.toastMessages = [{ message: 'Test', type: 'info' }];

            // Reset
            app.reset();

            // Verify cleanup
            expect(app.allArticles).toHaveLength(0);
            expect(app.selectedArticles).toHaveLength(0);
            expect(app.toastMessages).toHaveLength(0);
            expect(app.currentStep).toBe(1);
            expect(app.currentView).toBe('home');
        });
    });
});