/**
 * LexFlow Web Application
 * Main application controller with Chrome AI integration
 */

import { ChromeAI } from './chrome-ai.js';
import { DataManager } from './data-manager.js';
import { ToastSystem } from './toast-system.js';
import { initializeConfig } from '../util/config-loader.js';
import { resolveCorpusBaseUrl, loadDocumentsFromCorpus } from '../util/corpus-resolver.js';
import { setSetting, getSetting, setSettings, getAllSettings } from '../util/settings.js';
import { submitToCorpusPR, buildMarkdownFromForm } from '../util/worker-api.js';
import { showToast } from '../util/toast.js';
import { fetchDocumentsFromCorpus, fetchDocumentContent, searchArticlesAcrossDocuments } from '../util/document-fetcher.js';

class LexFlowApp {
    constructor() {
        this.chromeAI = new ChromeAI();
        this.dataManager = new DataManager();
        this.toastSystem = new ToastSystem();
        
        this.currentView = 'home';
        this.currentStep = 'laws-articles';
        this.selectedArticles = [];
        this.selectedContext = '';
        this.selectedCitations = [];
        this.currentDocument = null;
        this.availableDocuments = [];
        this.currentDocumentArticles = [];
        this.queueItems = [];
        this.historyItems = [];
        this.aiResult = null;
        
        this.init();
    }

    async init() {
        try {
            // Load configuration first
            let appConfig;
            try {
                appConfig = await initializeConfig();
                await setSetting('appConfig', appConfig);
                console.log('[LexFlow] Configuration loaded successfully');
            } catch (configError) {
                console.warn('[LexFlow] Configuration loading failed, using defaults:', configError);
                // Set minimal default configuration
                appConfig = {
                    app: { name: 'LexFlow', version: '1.0.0' },
                    ui: { defaultLanguage: 'en-US' },
                    corpus: { fallbackUrl: 'https://raw.githubusercontent.com/org/legal-corpus/main' }
                };
                await setSetting('appConfig', appConfig);
            }
            
            // Set serverless endpoint
            await setSetting('serverlessEndpoint', 'https://lexflow-corpus.webmaster-1d0.workers.dev');
            
            // Initialize data
            await this.dataManager.init();
            
            // Resolve corpus URL (with fallback handling)
            let corpusBaseUrl;
            try {
                corpusBaseUrl = await resolveCorpusBaseUrl();
            } catch (corpusError) {
                console.warn('[LexFlow] Corpus URL resolution failed:', corpusError);
                corpusBaseUrl = 'https://raw.githubusercontent.com/org/legal-corpus/main';
            }
            
            // Load saved data
            await this.loadUserData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load workspace state
            this.loadWorkspaceState();
            
            // Initialize documents from corpus
            await this.initializeDocumentsFromCorpus(corpusBaseUrl);
            
            // Update UI
            this.updateStats();
            
            console.log('[LexFlow] Application initialized successfully');
        } catch (error) {
            console.error('[LexFlow] Critical initialization error:', error);
            showToast('Application initialization failed. Some features may not work properly.', 'error');
            
            // Try to continue with minimal functionality
            try {
                await this.dataManager.init();
                this.setupEventListeners();
                this.initializeDocuments(); // Use fallback documents
                this.updateStats();
            } catch (fallbackError) {
                console.error('[LexFlow] Fallback initialization also failed:', fallbackError);
                showToast('Critical error: Application could not start', 'error');
            }
        }
    }

    async loadUserData() {
        try {
            // Load user preferences
            const userData = await this.dataManager.getUserData();
            if (userData.name) {
                document.getElementById('user-name').textContent = userData.name;
            }
            if (userData.location) {
                document.getElementById('user-location').textContent = userData.location;
            }

            // Load history
            this.historyItems = await this.dataManager.getHistory();
            this.updateHistoryView();

            // Load queue items (from Chrome storage if available)
            this.queueItems = await this.dataManager.getQueueItems();
            this.updateCollectorView();

            // Setup extension integration
            this.setupExtensionIntegration();

        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    setupEventListeners() {
        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                if (view) {
                    this.showView(view);
                }
            });
        });

        // Feature cards
        document.querySelectorAll('.feature-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.navigate;
                if (view) {
                    this.showView(view);
                }
            });
        });

        // Step navigation
        document.querySelectorAll('.step-pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                const step = e.target.dataset.step;
                if (step) {
                    this.showStep(step);
                }
            });
        });

        // Step action buttons
        document.getElementById('go-to-prompt-studio')?.addEventListener('click', () => {
            this.goToPromptStudio();
        });
        document.getElementById('back-to-articles')?.addEventListener('click', () => {
            this.showStep('laws-articles');
        });
        document.getElementById('send-to-curation')?.addEventListener('click', () => {
            this.sendToCuration();
        });

        // Search input
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            this.searchArticles(e.target.value);
        });

        // Clear all articles button
        document.getElementById('clear-all-articles')?.addEventListener('click', () => {
            this.clearAllArticles();
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectPreset(e.target, e.target.dataset.preset);
            });
        });

        // Execute AI button
        document.getElementById('execute-ai-btn')?.addEventListener('click', () => {
            this.executeAI();
        });

        // Feedback buttons
        document.querySelectorAll('.feedback-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.giveFeedback(e.target, e.target.dataset.feedback);
            });
        });

        // Copy result button
        document.getElementById('copy-result-btn')?.addEventListener('click', () => {
            this.copyResult();
        });

        // Add sample content button
        document.getElementById('add-sample-content')?.addEventListener('click', () => {
            this.addSampleContent();
        });

        // Settings modal
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.openSettingsModal();
        });
        document.getElementById('settings-close')?.addEventListener('click', () => {
            this.closeSettingsModal();
        });
        document.getElementById('settings-cancel')?.addEventListener('click', () => {
            this.closeSettingsModal();
        });
        document.getElementById('settings-save')?.addEventListener('click', () => {
            this.saveSettings();
        });
    }

    async initializeDocumentsFromCorpus(corpusBaseUrl) {
        try {
            this.showDocumentsLoading(true);
            const documents = await fetchDocumentsFromCorpus();
            this.availableDocuments = documents;
            this.renderDocuments(documents);
            this.showDocumentsLoading(false);
        } catch (error) {
            console.error('Error loading documents from corpus:', error);
            this.showDocumentsLoading(false);
            this.showDocumentsError();
        }
    }

    showDocumentsLoading(show) {
        const loadingEl = document.getElementById('documents-loading');
        const documentList = document.getElementById('document-list');
        
        if (show) {
            loadingEl.style.display = 'flex';
            documentList.innerHTML = '<div class="loading-state" id="documents-loading"><div class="spinner"></div>Loading documents...</div>';
        } else {
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
        }
    }

    showDocumentsError() {
        const documentList = document.getElementById('document-list');
        documentList.innerHTML = `
            <div class="empty-state">
                <p>No articles found for this document</p>
                <small>Try changing the document or search term</small>
                <button class="btn btn-secondary" onclick="window.app.initializeDocumentsFromCorpus()" style="margin-top: 1rem;">
                    🔄 Retry
                </button>
            </div>
        `;
    }

    renderDocuments(documents) {
        const documentList = document.getElementById('document-list');
        
        if (documents.length === 0) {
            documentList.innerHTML = `
                <div class="empty-state">
                    <p>No documents available</p>
                    <small>Check your connection and try again</small>
                </div>
            `;
            return;
        }
        
        documentList.innerHTML = documents.map(doc => `
            <div class="document-item" data-doc-id="${doc.id}">
                <div class="document-title">${doc.title}</div>
                <div class="document-meta">${doc.scope} • ${doc.jurisdiction} • ${doc.year}</div>
            </div>
        `).join('');

        // Add event listeners to document items
        documentList.querySelectorAll('.document-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const docId = e.currentTarget.dataset.docId;
                this.selectDocument(e.currentTarget, docId);
            });
        });
    }

    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show selected view
        document.getElementById(viewName + '-view').classList.add('active');
        
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Find and activate the correct tab
        const tabTexts = {
            'home': 'Home',
            'workspace': 'Legal Workspace',
            'collector': 'Collector',
            'history': 'History'
        };
        
        document.querySelectorAll('.nav-tab').forEach(tab => {
            if (tab.textContent.includes(tabTexts[viewName])) {
                tab.classList.add('active');
            }
        });
        
        this.currentView = viewName;
        
        // Reset workspace to first step when switching to workspace
        if (viewName === 'workspace') {
            this.showStep('laws-articles');
        }
    }

    async selectDocument(element, docId) {
        // Update UI
        document.querySelectorAll('.document-item').forEach(item => {
            item.classList.remove('selected');
        });
        element.classList.add('selected');
        
        this.currentDocument = this.availableDocuments.find(doc => doc.id === docId);
        if (this.currentDocument) {
            await this.displayArticles(this.currentDocument);
        }
    }

    async displayArticles(document) {
        const container = document.getElementById('articles-container');
        
        // Show loading state
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                Loading articles...
            </div>
        `;
        
        try {
            const articles = await fetchDocumentContent(document);
            this.currentDocumentArticles = articles;
            
            if (articles.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>No articles found for this document</p>
                        <small>Try changing the document or search term</small>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = articles.map(article => `
                <div class="article-item" data-article-id="${article.id}">
                    <div class="article-number">${article.number}</div>
                    <div class="article-content">${article.content}</div>
                </div>
            `).join('');

            // Add event listeners to article items
            container.querySelectorAll('.article-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const articleId = e.currentTarget.dataset.articleId;
                    this.toggleArticle(e.currentTarget, articleId);
                });
            });
            
        } catch (error) {
            console.error('Error loading articles:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <p>Error loading articles</p>
                    <small>Please try again</small>
                    <button class="btn btn-secondary" onclick="window.app.displayArticles(window.app.currentDocument)" style="margin-top: 1rem;">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }

    toggleArticle(element, articleId) {
        element.classList.toggle('selected');
        
        const article = this.currentDocumentArticles.find(a => a.id === articleId);
        if (!article) return;
        
        if (element.classList.contains('selected')) {
            this.selectedArticles.push(article);
        } else {
            this.selectedArticles = this.selectedArticles.filter(a => a.id !== articleId);
        }
        
        this.updateSelectedContext();
        this.updateGoToPromptStudioButton();
    }

    updateSelectedContext() {
        const contextContainer = document.getElementById('selected-context');
        const itemsContainer = document.getElementById('context-items');
        
        if (this.selectedArticles.length > 0) {
            contextContainer.style.display = 'block';
            itemsContainer.innerHTML = this.selectedArticles.map((article, index) => `
                <div class="context-item">
                    <div class="context-content">
                        <strong>${article.number}</strong><br>
                        ${article.content.substring(0, 150)}...
                    </div>
                    <div class="context-actions">
                        <button class="icon-btn delete" data-article-id="${article.id}" title="Remove article">
                            ❌
                        </button>
                    </div>
                </div>
            `).join('');

            // Add event listeners to remove buttons
            itemsContainer.querySelectorAll('.icon-btn.delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const articleId = e.target.dataset.articleId;
                    this.removeArticle(articleId);
                });
            });
            
            // Update context for prompt studio
            this.buildSelectedContext();
        } else {
            contextContainer.style.display = 'none';
            this.selectedContext = '';
            this.selectedCitations = [];
        }
    }

    buildSelectedContext() {
        this.selectedContext = this.selectedArticles.map(article => 
            `${article.number}: ${article.content}`
        ).join('\n\n');
        
        this.selectedCitations = this.selectedArticles.map(article => ({
            number: article.number,
            citation: article.citation,
            document: article.document
        }));
    }

    updateGoToPromptStudioButton() {
        const button = document.getElementById('go-to-prompt-studio');
        if (button) {
            button.disabled = this.selectedArticles.length === 0;
        }
    }

    removeArticle(articleId) {
        // Remove from array
        this.selectedArticles = this.selectedArticles.filter(a => a.id !== articleId);
        
        // Remove visual selection
        const articleElements = document.querySelectorAll('.article-item');
        articleElements.forEach(element => {
            if (element.dataset.articleId === articleId) {
                element.classList.remove('selected');
            }
        });
        
        this.updateSelectedContext();
        this.updateGoToPromptStudioButton();
        this.toastSystem.show('Article removed from context', 'success');
    }

    showStep(stepName) {
        // Update step pills
        document.querySelectorAll('.step-pill').forEach(pill => {
            pill.classList.remove('active');
        });
        document.querySelector(`[data-step="${stepName}"]`).classList.add('active');
        
        // Update step content
        document.querySelectorAll('.workspace-step').forEach(step => {
            step.classList.remove('active');
        });
        document.getElementById(`step-${stepName}`).classList.add('active');
        
        this.currentStep = stepName;
        
        // Save state to sessionStorage
        this.saveWorkspaceState();
        
        if (stepName === 'prompt-studio') {
            this.updatePromptStudioContext();
        }
    }

    goToPromptStudio() {
        if (this.selectedArticles.length === 0) {
            this.toastSystem.show('Please select at least one article', 'error');
            return;
        }
        
        this.showStep('prompt-studio');
    }

    updatePromptStudioContext() {
        const contextSummary = document.getElementById('context-summary');
        if (contextSummary && this.selectedArticles.length > 0) {
            const summary = `${this.selectedArticles.length} article(s) selected from ${this.currentDocument?.title || 'document'}:\n\n` +
                this.selectedArticles.map(article => `• ${article.number}`).join('\n');
            
            contextSummary.textContent = summary;
        }
    }

    saveWorkspaceState() {
        const state = {
            currentStep: this.currentStep,
            selectedArticles: this.selectedArticles,
            selectedContext: this.selectedContext,
            selectedCitations: this.selectedCitations,
            currentDocument: this.currentDocument,
            aiResult: this.aiResult
        };
        
        try {
            sessionStorage.setItem('lexflow-workspace-state', JSON.stringify(state));
        } catch (error) {
            console.error('Error saving workspace state:', error);
        }
    }

    loadWorkspaceState() {
        try {
            const saved = sessionStorage.getItem('lexflow-workspace-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.currentStep = state.currentStep || 'laws-articles';
                this.selectedArticles = state.selectedArticles || [];
                this.selectedContext = state.selectedContext || '';
                this.selectedCitations = state.selectedCitations || [];
                this.currentDocument = state.currentDocument || null;
                this.aiResult = state.aiResult || null;
                
                // Restore UI state
                if (this.currentStep !== 'laws-articles') {
                    this.showStep(this.currentStep);
                }
                
                if (this.selectedArticles.length > 0) {
                    this.updateSelectedContext();
                    this.updateGoToPromptStudioButton();
                }
            }
        } catch (error) {
            console.error('Error loading workspace state:', error);
        }
    }

    clearAllArticles() {
        this.selectedArticles = [];
        this.selectedContext = '';
        this.selectedCitations = [];
        
        // Remove all visual selections
        document.querySelectorAll('.article-item.selected').forEach(element => {
            element.classList.remove('selected');
        });
        
        this.updateSelectedContext();
        this.updateGoToPromptStudioButton();
        this.toastSystem.show('All articles have been removed', 'success');
    }

    sendToCuration() {
        if (this.selectedArticles.length === 0) {
            this.toastSystem.show('Please select at least one article', 'error');
            return;
        }

        // Create curation item
        const curationItem = {
            id: Date.now(),
            title: this.generateCurationTitle(),
            jurisdiction: this.currentDocument?.jurisdiction || 'US/Federal',
            language: 'en-US',
            source_url: this.generateSourceUrls(),
            captured_text: this.selectedContext,
            notes: this.aiResult ? `AI Analysis: ${this.aiResult.prompt}` : 'Selected articles for curation',
            citations: this.selectedCitations,
            status: 'queued',
            timestamp: new Date().toISOString(),
            mode: 'selection',
            category: 'Constitutional Law'
        };

        // Add to queue
        this.queueItems.unshift(curationItem);
        
        // Switch to collector view and show the new item
        this.showView('collector');
        this.updateCollectorView();
        
        // Select the new item
        setTimeout(() => {
            const firstQueueItem = document.querySelector('.queue-item');
            if (firstQueueItem) {
                this.selectQueueItem(firstQueueItem, 0);
            }
        }, 100);

        this.toastSystem.show('Content sent to curation queue', 'success');
    }

    generateCurationTitle() {
        if (this.selectedArticles.length === 1) {
            return `${this.currentDocument?.title} — ${this.selectedArticles[0].number}`;
        } else {
            const firstCitation = this.selectedArticles[0].number;
            return `${this.currentDocument?.title} — ${firstCitation} (${this.selectedArticles.length} articles)`;
        }
    }

    generateSourceUrls() {
        // Map corpus path back to public raw URL
        if (this.currentDocument?.path) {
            const corpusBaseUrl = localStorage.getItem('lexflow-corpus-base-url') || 'https://raw.githubusercontent.com/viniciusvollrath/legal-corpus/main';
            return `${corpusBaseUrl}/${this.currentDocument.path}`;
        }
        return '';
    }

    selectPreset(element, presetType) {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        element.classList.add('active');
        
        const prompts = {
            'executive-summary': 'Create an executive summary of the selected articles, highlighting the main rights and obligations, using accessible language for presentation to the client.',
            'legal-analysis': 'Perform a detailed legal analysis of the selected articles, identifying potential conflicts, gaps, and relevant doctrinal interpretations.',
            'legal-comparison': 'Compare the selected articles, identifying similarities, differences, and possible normative hierarchies between them.',
            'clause-generation': 'Based on the selected articles, generate practical contractual clauses that comply with the presented legislation.'
        };
        
        document.getElementById('custom-prompt').value = prompts[presetType] || prompts['executive-summary'];
    }

    async executeAI() {
        if (this.selectedArticles.length === 0) {
            this.toastSystem.show('Please select at least one article for analysis', 'error');
            return;
        }

        const outputContainer = document.getElementById('ai-output');
        const thinkingDiv = document.getElementById('ai-thinking');
        const resultDiv = document.getElementById('ai-result');
        const sendToCurationBtn = document.getElementById('send-to-curation');
        
        outputContainer.style.display = 'block';
        thinkingDiv.style.display = 'flex';
        resultDiv.style.display = 'none';
        sendToCurationBtn.style.display = 'none';

        try {
            // Check Chrome AI availability
            const aiStatus = await this.chromeAI.checkAvailability();
            if (!aiStatus.prompt) {
                throw new Error('Chrome AI is not available. Please check your Chrome settings.');
            }

            const systemPrompt = `You are a legal assistant specialized in legal analysis. 
            Analyze the provided legal texts with technical precision and language appropriate for legal professionals.
            Provide structured, practical, and well-founded analyses.`;

            const userPrompt = document.getElementById('custom-prompt').value + '\n\nArticles for analysis:\n' + this.selectedContext;

            // Execute AI analysis
            const result = await this.chromeAI.analyzeText(systemPrompt, userPrompt);

            if (result.success) {
                // Show result
                thinkingDiv.style.display = 'none';
                resultDiv.style.display = 'block';
                sendToCurationBtn.style.display = 'inline-block';
                
                const formattedResult = this.formatAIResult(result.result);
                document.getElementById('result-content').innerHTML = formattedResult;
                
                // Store result for curation
                this.aiResult = {
                    prompt: userPrompt,
                    result: result.result,
                    timestamp: new Date().toISOString()
                };
                
                // Save to history
                await this.saveAnalysisToHistory(userPrompt, result.result);
                
                this.toastSystem.show('Analysis completed successfully!', 'success');
            } else {
                throw new Error(result.message || 'Error in AI analysis');
            }

        } catch (error) {
            console.error('AI execution error:', error);
            thinkingDiv.style.display = 'none';
            
            // Show info banner about Chrome AI availability
            this.showAIUnavailableBanner();
            
            this.toastSystem.show('Chrome AI not available. Please check your Chrome settings.', 'warning', 8000);
        }
    }

    showAIUnavailableBanner() {
        const resultDiv = document.getElementById('ai-result');
        resultDiv.style.display = 'block';
        
        document.getElementById('result-content').innerHTML = `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 1rem; margin: 1rem 0;">
                <h4 style="color: #856404; margin: 0 0 0.5rem 0;">🔧 Chrome Built-in AI Not Available</h4>
                <p style="color: #856404; margin: 0;">
                    Chrome Built-in AI (Gemini Nano) is not available in your browser. 
                    To use AI analysis features, please:
                </p>
                <ul style="color: #856404; margin: 0.5rem 0 0 1rem;">
                    <li>Use Chrome Canary (version 120+)</li>
                    <li>Enable the "Prompt API for Gemini Nano" flag</li>
                    <li>Enable the "Built-in AI API" flag</li>
                    <li>Restart your browser</li>
                </ul>
                <p style="color: #856404; margin: 0.5rem 0 0 0; font-size: 0.9rem;">
                    You can still use the "Send to Curation" feature to process your selected articles.
                </p>
            </div>
        `;
        
        // Show send to curation button even without AI result
        document.getElementById('send-to-curation').style.display = 'inline-block';
    }

    showFallbackResult() {
        const resultDiv = document.getElementById('ai-result');
        resultDiv.style.display = 'block';
        
        const mockResult = this.generateMockResult();
        document.getElementById('result-content').innerHTML = mockResult;
    }

    generateMockResult() {
        return `
            <h4>📋 Resumo Executivo - Análise Jurídica</h4>
            
            <p><strong>Artigos Analisados:</strong> ${this.selectedArticles.map(a => a.number).join(', ')}</p>
            
            <h5>🎯 Principais Pontos:</h5>
            <ul>
                <li><strong>Direitos Fundamentais:</strong> Os artigos estabelecem garantias constitucionais básicas, incluindo igualdade perante a lei e direitos sociais essenciais.</li>
                <li><strong>Responsabilidade Civil:</strong> Há clara definição de responsabilidade por atos ilícitos e obrigação de reparar danos causados.</li>
                <li><strong>Proteção ao Consumidor:</strong> Estabelece direitos básicos e responsabilidade objetiva dos fornecedores.</li>
            </ul>
            
            <h5>⚖️ Implicações Práticas:</h5>
            <p>A análise revela um sistema jurídico coerente que prioriza a proteção da dignidade humana e estabelece mecanismos claros de responsabilização. Para aplicação prática, recomenda-se:</p>
            <ul>
                <li>Verificar jurisprudência recente sobre interpretação dos dispositivos</li>
                <li>Considerar princípios constitucionais na aplicação das normas</li>
                <li>Atentar para prazos e procedimentos específicos</li>
            </ul>
            
            <h5>🔍 Recomendações:</h5>
            <p>Para casos concretos, sugere-se análise complementar da doutrina especializada e precedentes dos tribunais superiores.</p>
        `;
    }

    formatAIResult(result) {
        // Format the AI result with proper HTML structure
        return result.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    async saveAnalysisToHistory(prompt, result) {
        const historyItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            prompt: prompt.substring(0, 200) + '...',
            result: result.substring(0, 500) + '...',
            articles: this.selectedArticles.map(a => a.number).join(', '),
            type: 'ai_analysis'
        };

        this.historyItems.unshift(historyItem);
        await this.dataManager.saveHistory(this.historyItems);
        this.updateHistoryView();
        this.updateStats();
    }

    giveFeedback(button, type) {
        // Remove previous feedback
        document.querySelectorAll('.feedback-btn').forEach(btn => {
            btn.classList.remove('active', 'positive', 'negative');
        });
        
        // Add current feedback
        button.classList.add('active', type);
        
        const message = type === 'positive' ? 'Obrigado pelo feedback positivo!' : 'Feedback registrado. Vamos melhorar!';
        this.toastSystem.show(message, 'success');
    }

    async copyResult() {
        const resultContent = document.getElementById('result-content').innerText;
        
        try {
            await navigator.clipboard.writeText(resultContent);
            
            const copyBtn = document.querySelector('.copy-btn');
            const originalText = copyBtn.innerHTML;
            
            copyBtn.innerHTML = '✅ Copiado!';
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.classList.remove('copied');
            }, 2000);
            
            this.toastSystem.show('Resultado copiado para a área de transferência!', 'success');
        } catch (error) {
            this.toastSystem.show('Erro ao copiar. Tente selecionar o texto manualmente.', 'error');
        }
    }

    searchArticles(term) {
        if (!this.currentDocument || !term) {
            if (this.currentDocument) {
                this.displayArticles(this.currentDocument);
            }
            return;
        }
        
        const filtered = this.currentDocumentArticles.filter(article => 
            article.content.toLowerCase().includes(term.toLowerCase()) ||
            article.number.toLowerCase().includes(term.toLowerCase())
        );
        
        const container = document.getElementById('articles-container');
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No articles found for the search term</p>
                    <small>Try a different search term</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filtered.map(article => `
            <div class="article-item ${this.selectedArticles.find(a => a.id === article.id) ? 'selected' : ''}" data-article-id="${article.id}">
                <div class="article-number">${article.number}</div>
                <div class="article-content">${article.content}</div>
            </div>
        `).join('');

        // Add event listeners to filtered articles
        container.querySelectorAll('.article-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const articleId = e.currentTarget.dataset.articleId;
                this.toggleArticle(e.currentTarget, articleId);
            });
        });
    }

    addSampleContent() {
        const sampleItems = [
            {
                id: Date.now(),
                title: 'STF decide sobre marco temporal para terras indígenas',
                url: 'https://g1.globo.com/politica/noticia/stf-marco-temporal.html',
                content: 'O Supremo Tribunal Federal (STF) decidiu por maioria que não existe marco temporal para demarcação de terras indígenas...',
                status: 'queued',
                timestamp: new Date().toISOString(),
                category: 'Direito Constitucional'
            },
            {
                id: Date.now() + 1,
                title: 'Nova Lei de Proteção de Dados',
                url: 'https://conjur.com.br/nova-lei-lgpd.html',
                content: 'Sancionada nova lei que altera dispositivos da LGPD, estabelecendo regras mais claras para tratamento de dados...',
                status: 'processed',
                timestamp: new Date(Date.now() - 86400000).toISOString(),
                category: 'Direito Digital'
            }
        ];

        this.queueItems.push(...sampleItems);
        this.updateCollectorView();
        this.toastSystem.show('Conteúdo de exemplo adicionado!', 'success');
    }

    updateCollectorView() {
        const queueContainer = document.getElementById('queue-items');
        const queueCount = document.getElementById('queue-count');
        
        queueCount.textContent = this.queueItems.length;
        
        if (this.queueItems.length === 0) {
            queueContainer.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 2rem;">Nenhum item na fila. Use o botão "Adicionar Conteúdo" para começar.</p>';
            return;
        }
        
        queueContainer.innerHTML = this.queueItems.map((item, index) => {
            const statusText = {
                'queued': 'Aguardando',
                'processed': 'Processado', 
                'published': 'Publicado'
            };
            
            const getHostname = (url) => {
                try {
                    return new URL(url).hostname;
                } catch {
                    return 'Fonte desconhecida';
                }
            };
            
            return `
                <div class="queue-item ${index === 0 ? 'selected' : ''}" data-queue-index="${index}">
                    <div class="queue-title">${item.title || 'Conteúdo Capturado'}</div>
                    <div class="queue-meta">
                        <span class="status-badge status-${item.status}">${statusText[item.status] || 'Aguardando'}</span>
                        • ${getHostname(item.url || item.source_url)}
                        • ${new Date(item.timestamp).toLocaleDateString()}
                        ${item.mode ? `• ${item.mode === 'selection' ? 'Seleção' : 'Página completa'}` : ''}
                    </div>
                    <div class="queue-preview">${(item.text || item.content || '').substring(0, 100)}...</div>
                    ${item.jurisdiction ? `<div class="queue-jurisdiction">📍 ${this.formatJurisdiction(item.jurisdiction)}</div>` : ''}
                </div>
            `;
        }).join('');

        // Add event listeners to queue items
        queueContainer.querySelectorAll('.queue-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.queueIndex);
                this.selectQueueItem(e.currentTarget, index);
            });
        });
        
        // Show first item in editor if available
        if (this.queueItems.length > 0) {
            this.showItemInEditor(this.queueItems[0]);
        }
    }

    selectQueueItem(element, index) {
        document.querySelectorAll('.queue-item').forEach(item => {
            item.classList.remove('selected');
        });
        element.classList.add('selected');
        
        this.showItemInEditor(this.queueItems[index]);
    }

    showItemInEditor(item) {
        const editorForm = document.getElementById('metadata-form');
        
        // Get jurisdiction display text
        const getJurisdictionText = (jurisdiction) => {
            if (!jurisdiction) return 'Não especificada';
            const parts = [];
            if (jurisdiction.country) parts.push(jurisdiction.country.toUpperCase());
            if (jurisdiction.state) parts.push(jurisdiction.state.toUpperCase());
            if (jurisdiction.city) parts.push(jurisdiction.city);
            if (jurisdiction.level) parts.push(`(${jurisdiction.level})`);
            return parts.join(' - ') || 'Não especificada';
        };
        
        editorForm.innerHTML = `
            <div class="form-group">
                <label class="form-label">Título *</label>
                <input type="text" class="form-control" id="edit-title" value="${(item.title || '').replace(/"/g, '&quot;')}" required>
            </div>
            
            <div class="form-group">
                <label class="form-label">Jurisdição</label>
                <input type="text" class="form-control" id="edit-jurisdiction" 
                       value="${getJurisdictionText(item.jurisdiction)}" readonly>
                <small class="form-text">Detectada automaticamente da fonte</small>
            </div>
            
            <div class="form-group">
                <label class="form-label">Idioma</label>
                <select class="form-control" id="edit-language">
                    <option value="pt-BR" ${item.language === 'pt-BR' ? 'selected' : ''}>Português (Brasil)</option>
                    <option value="en-US" ${item.language === 'en-US' ? 'selected' : ''}>English (US)</option>
                    <option value="es-ES" ${item.language === 'es-ES' ? 'selected' : ''}>Español</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">URL da Fonte *</label>
                <input type="url" class="form-control" id="edit-source-url" 
                       value="${(item.source_url || item.url || '').replace(/"/g, '&quot;')}" required>
            </div>
            
            <div class="form-group">
                <label class="form-label">Version Date</label>
                <input type="date" class="form-control" id="edit-version-date"ass="form-control" id="edit-version-date" 
                       value="${item.version_date || new Date().toISOString().split('T')[0]}">
            </div>
            
            <div class="form-group">
                <label class="form-label">Categoria</label>
                <select class="form-control" id="edit-category">
                    <option value="Direito Constitucional" ${item.category === 'Direito Constitucional' ? 'selected' : ''}>Direito Constitucional</option>
                    <option value="Direito Civil" ${item.category === 'Direito Civil' ? 'selected' : ''}>Direito Civil</option>
                    <option value="Direito Penal" ${item.category === 'Direito Penal' ? 'selected' : ''}>Direito Penal</option>
                    <option value="Direito Trabalhista" ${item.category === 'Direito Trabalhista' ? 'selected' : ''}>Direito Trabalhista</option>
                    <option value="Direito Administrativo" ${item.category === 'Direito Administrativo' ? 'selected' : ''}>Direito Administrativo</option>
                    <option value="Direito Digital" ${item.category === 'Direito Digital' ? 'selected' : ''}>Direito Digital</option>
                    <option value="Direito Ambiental" ${item.category === 'Direito Ambiental' ? 'selected' : ''}>Direito Ambiental</option>
                    <option value="Outros" ${item.category === 'Outros' ? 'selected' : ''}>Outros</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Tags</label>
                <input type="text" class="form-control" id="edit-tags" 
                       value="${(item.metadata?.keywords?.join(', ') || '').replace(/"/g, '&quot;')}"
                       placeholder="Separadas por vírgula">
            </div>
            
            <div class="form-group">
                <label class="form-label">Captured Text *</label>
                <textarea class="form-control" rows="6" id="edit-text" required>${(item.captured_text || item.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                <small class="form-text">${(item.captured_text || item.text || '').length || 0} characters</small>
            </div>
            
            <div class="form-group">
                <label class="form-label">Summary/Notes</label>
                <textarea class="form-control" rows="3" id="edit-summary" 
                          placeholder="Add a summary or notes about this content">${(item.notes || item.summary || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label">Legal Impact</label>
                <select class="form-control" id="edit-impact">
                    <option value="high" ${item.impact === 'high' ? 'selected' : ''}>High - Binding precedent</option>
                    <option value="medium" ${item.impact === 'medium' ? 'selected' : ''}>Medium - Jurisprudential guidance</option>
                    <option value="low" ${item.impact === 'low' ? 'selected' : ''}>Low - Specific case</option>
                    <option value="informational" ${item.impact === 'informational' ? 'selected' : ''}>Informational</option>
                </select>
            </div>
            
            <div class="form-actions" style="margin-top: 1.5rem;">
                <button class="btn btn-primary" data-action="save-metadata" data-item-id="${item.id}">
                    💾 Save Metadata
                </button>
                
                <button class="btn btn-success" data-action="process-item" data-item-id="${item.id}" style="margin-top: 0.5rem;">
                    ✅ Process & Generate Markdown
                </button>
                
                <button class="btn btn-secondary" data-action="generate-pr" data-item-id="${item.id}" style="margin-top: 0.5rem;">
                    🔄 Create Pull Request
                </button>
            </div>
        `;

        // Add event listeners to form action buttons
        editorForm.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const itemId = parseInt(e.target.dataset.itemId);
                
                switch (action) {
                    case 'save-metadata':
                        this.saveItemMetadata(itemId);
                        break;
                    case 'process-item':
                        this.processItem(itemId);
                        break;
                    case 'generate-pr':
                        this.generatePR(itemId);
                        break;
                }
            });
        });
    }

    /**
     * Save item metadata from editor form
     * @param {number} itemId - Item ID to save
     */
    async saveItemMetadata(itemId) {
        try {
            const updates = {
                title: document.getElementById('edit-title').value,
                language: document.getElementById('edit-language').value,
                source_url: document.getElementById('edit-source-url').value,
                version_date: document.getElementById('edit-version-date').value,
                category: document.getElementById('edit-category').value,
                captured_text: document.getElementById('edit-text').value,
                text: document.getElementById('edit-text').value, // Keep both for compatibility
                notes: document.getElementById('edit-summary').value,
                summary: document.getElementById('edit-summary').value, // Keep both for compatibility
                impact: document.getElementById('edit-impact').value,
                tags: document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(t => t),
                lastModified: new Date().toISOString()
            };

            await this.updateCapturedContentMetadata(itemId, updates);
        } catch (error) {
            console.error('Error saving metadata:', error);
            showToast('Error saving metadata', 'error');
        }
    }

    async processItem(itemId) {
        try {
            // Save metadata first
            await this.saveItemMetadata(itemId);
            
            // Get item data
            const item = this.queueItems.find(item => item.id === itemId);
            if (!item) {
                throw new Error('Item not found');
            }
            
            // Build form data for markdown generation
            const formData = {
                title: document.getElementById('edit-title').value,
                jurisdiction: typeof item.jurisdiction === 'string' ? item.jurisdiction : this.formatJurisdictionForSubmission(item.jurisdiction),
                language: document.getElementById('edit-language').value,
                sourceUrl: document.getElementById('edit-source-url').value,
                versionDate: document.getElementById('edit-version-date').value || new Date().toISOString().split('T')[0],
                docType: document.getElementById('edit-category').value,
                text: document.getElementById('edit-text').value
            };
            
            // Generate markdown
            const markdown = buildMarkdownFromForm(formData);
            
            showToast('Item processed and Markdown generated!', 'success');
            
            // Update status
            await this.updateCapturedContentMetadata(itemId, { 
                status: 'processed',
                processedAt: new Date().toISOString(),
                markdown: markdown
            });
            
        } catch (error) {
            console.error('Error processing item:', error);
            showToast('Error processing item', 'error');
        }
    }

    async generatePR(itemId) {
        try {
            // Get item data
            const item = this.queueItems.find(item => item.id === itemId);
            if (!item) {
                throw new Error('Item not found');
            }
            
            // Build form data
            const formData = {
                title: document.getElementById('edit-title').value,
                jurisdiction: typeof item.jurisdiction === 'string' ? item.jurisdiction : this.formatJurisdictionForSubmission(item.jurisdiction),
                language: document.getElementById('edit-language').value,
                sourceUrl: document.getElementById('edit-source-url').value,
                versionDate: document.getElementById('edit-version-date').value || new Date().toISOString().split('T')[0],
                docType: document.getElementById('edit-category').value,
                text: document.getElementById('edit-text').value
            };
            
            // Generate markdown
            const markdown = buildMarkdownFromForm(formData);
            
            // Submit to corpus
            const result = await submitToCorpusPR({
                title: `[LexFlow] ${formData.title}`,
                markdown,
                metadata: {
                    jurisdiction: formData.jurisdiction,
                    language: formData.language || 'en-US',
                    doc_type: formData.docType || 'general',
                    file_slug: this.slugify(formData.title),
                    version_date: formData.versionDate,
                    source_url: formData.sourceUrl
                }
            });
            
            showToast('✅ Corpus submission successful', 'success');
            
            // Show PR link if available
            if (result?.url) {
                this.renderPRLink(result.url);
            }
            
            // Update status
            await this.updateCapturedContentMetadata(itemId, { 
                status: 'published',
                publishedAt: new Date().toISOString(),
                prUrl: result?.url
            });
            
        } catch (error) {
            console.error('Corpus submission failed:', error);
            showToast('Corpus submission failed. Please check your configuration.', 'error');
        }
    }

    updateHistoryView() {
        const historyContainer = document.getElementById('history-items');
        
        if (this.historyItems.length === 0) {
            historyContainer.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 2rem;">Nenhuma análise realizada ainda. Use o Workspace Jurídico para começar.</p>';
            return;
        }
        
        historyContainer.innerHTML = this.historyItems.slice(0, 10).map(item => {
            return `
                <div class="history-item">
                    <div class="history-title">Análise: ${item.articles || 'Análise Jurídica'}</div>
                    <div class="history-meta">
                        ${new Date(item.timestamp).toLocaleDateString()} • ${item.type || 'AI Analysis'} • ${item.articles || 'N/A'}
                    </div>
                    <div class="history-preview">${(item.result || '').substring(0, 200)}...</div>
                </div>
            `;
        }).join('');
    }

    updateStats() {
        // Update home stats
        document.getElementById('stat-analyses').textContent = this.historyItems.length;
        document.getElementById('stat-documents').textContent = this.queueItems.filter(item => item.status === 'processed').length;
        document.getElementById('stat-time').textContent = (this.historyItems.length * 0.5).toFixed(1) + 'h';
        
        // Update history stats
        document.getElementById('history-analyses').textContent = this.historyItems.length;
        document.getElementById('history-documents').textContent = this.queueItems.filter(item => item.status === 'processed').length;
        document.getElementById('history-articles').textContent = this.selectedArticles.length;
    }

    updateDocuments() {
        // Reinitialize documents when jurisdiction changes
        this.initializeDocuments();
        this.toastSystem.show('Documentos atualizados para a nova jurisdição', 'success');
    }

    /**
     * Setup extension integration for content capture
     */
    setupExtensionIntegration() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            try {
                // Request any pending captured content
                chrome.runtime.sendMessage({ type: "GET_CAPTURED_CONTENT" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('Extension communication error:', chrome.runtime.lastError);
                        return;
                    }
                    
                    if (response?.success && response.data) {
                        this.queueItems = response.data;
                        this.updateCollectorView();
                    }
                });

                console.log('Extension integration setup complete');
            } catch (error) {
                console.log('Extension integration not available:', error);
            }
        }
    }

    /**
     * Handle captured content from extension
     * @param {Object} captureData - Captured content data
     */
    async handleCapturedContent(captureData) {
        try {
            // Reload queue items from storage
            this.queueItems = await this.dataManager.getQueueItems();
            this.updateCollectorView();
            
            // Show notification
            this.toastSystem.show(
                `Conteúdo capturado: ${captureData.mode === 'selection' ? 'texto selecionado' : 'página completa'}`,
                'success'
            );

            // Auto-switch to collector view if not already there
            if (this.currentView !== 'collector') {
                this.toastSystem.showWithAction(
                    'Conteúdo adicionado à fila de curadoria',
                    'info',
                    'Ver Fila',
                    () => this.showView('collector'),
                    5000
                );
            }
        } catch (error) {
            console.error('Error handling captured content:', error);
            this.toastSystem.show('Erro ao processar conteúdo capturado', 'error');
        }
    }

    /**
     * Update captured content metadata
     * @param {number} itemId - Item ID
     * @param {Object} updates - Updates to apply
     */
    async updateCapturedContentMetadata(itemId, updates) {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                // Update via extension
                chrome.runtime.sendMessage({
                    type: "UPDATE_CAPTURED_CONTENT",
                    itemId: itemId,
                    updates: updates
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('Extension communication error:', chrome.runtime.lastError);
                        // Fallback to local update
                        this.updateLocalMetadata(itemId, updates);
                        return;
                    }
                    
                    if (response?.success) {
                        showToast('Metadata updated', 'success');
                        // Reload queue
                        this.loadUserData();
                    } else {
                        this.updateLocalMetadata(itemId, updates);
                    }
                });
            } else {
                this.updateLocalMetadata(itemId, updates);
            }
        } catch (error) {
            console.error('Error updating captured content:', error);
            this.updateLocalMetadata(itemId, updates);
        }
    }

    async updateLocalMetadata(itemId, updates) {
        try {
            const itemIndex = this.queueItems.findIndex(item => item.id === itemId);
            if (itemIndex !== -1) {
                this.queueItems[itemIndex] = { ...this.queueItems[itemIndex], ...updates };
                await this.dataManager.saveQueueItems(this.queueItems);
                this.updateCollectorView();
                showToast('Metadata updated', 'success');
            }
        } catch (error) {
            console.error('Error updating local metadata:', error);
            showToast('Error updating metadata', 'error');
        }
    }

    /**
     * Format jurisdiction for display
     * @param {Object} jurisdiction - Jurisdiction object
     * @returns {string} Formatted jurisdiction text
     */
    formatJurisdiction(jurisdiction) {
        if (!jurisdiction) return '';
        
        const parts = [];
        if (jurisdiction.country) parts.push(jurisdiction.country.toUpperCase());
        if (jurisdiction.state) parts.push(jurisdiction.state.toUpperCase());
        if (jurisdiction.city) parts.push(jurisdiction.city);
        
        return parts.join(' - ');
    }

    /**
     * Format jurisdiction for submission
     * @param {Object} jurisdiction - Jurisdiction object
     * @returns {string} Formatted jurisdiction for API
     */
    formatJurisdictionForSubmission(jurisdiction) {
        if (!jurisdiction) return 'unknown';
        
        const parts = [];
        if (jurisdiction.country) parts.push(jurisdiction.country.toLowerCase());
        if (jurisdiction.state) parts.push(jurisdiction.state.toLowerCase());
        if (jurisdiction.city) parts.push(jurisdiction.city.toLowerCase());
        
        return parts.join('-') || 'unknown';
    }

    /**
     * Create URL-friendly slug from title
     * @param {string} title - Title to slugify
     * @returns {string} URL-friendly slug
     */
    slugify(title) {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Render PR link in UI
     * @param {string} prUrl - Pull request URL
     */
    renderPRLink(prUrl) {
        const linkContainer = document.createElement('div');
        linkContainer.className = 'pr-link-container';
        linkContainer.innerHTML = `
            <div style="margin-top: 1rem; padding: 12px; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px;">
                <strong>Pull Request Created:</strong><br>
                <a href="${prUrl}" target="_blank" style="color: #0ea5e9; text-decoration: none;">
                    ${prUrl}
                </a>
            </div>
        `;
        
        // Add to form actions area
        const formActions = document.querySelector('.form-actions');
        if (formActions) {
            formActions.appendChild(linkContainer);
        }
    }

    /**
     * Open settings modal
     */
    async openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        
        // Load current settings
        const settings = await getAllSettings();
        
        document.getElementById('settings-language').value = settings.language || 'en-US';
        document.getElementById('settings-country').value = settings.country || '';
        document.getElementById('settings-state').value = settings.state || '';
        document.getElementById('settings-city').value = settings.city || '';
        document.getElementById('settings-endpoint').value = settings.serverlessEndpoint || 'https://lexflow-corpus.webmaster-1d0.workers.dev';
        
        modal.style.display = 'flex';
    }

    /**
     * Close settings modal
     */
    closeSettingsModal() {
        const modal = document.getElementById('settings-modal');
        modal.style.display = 'none';
    }

    /**
     * Save settings from modal
     */
    async saveSettings() {
        try {
            const settings = {
                language: document.getElementById('settings-language').value,
                country: document.getElementById('settings-country').value,
                state: document.getElementById('settings-state').value,
                city: document.getElementById('settings-city').value,
                serverlessEndpoint: document.getElementById('settings-endpoint').value
            };

            await setSettings(settings);
            
            // Update user location display
            const location = [settings.city, settings.state, settings.country]
                .filter(Boolean)
                .join(', ');
            if (location) {
                document.getElementById('user-location').textContent = location;
            }

            showToast('Settings saved successfully', 'success');
            this.closeSettingsModal();

            // Re-resolve corpus URL if language changed
            try {
                await resolveCorpusBaseUrl();
            } catch (error) {
                console.warn('Could not re-resolve corpus URL:', error);
            }

        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Error saving settings', 'error');
        }
    }
}

// Make app available globally for debugging
window.app = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LexFlowApp();
});