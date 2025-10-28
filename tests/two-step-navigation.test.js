/**
 * Unit Tests for 2-Step Workspace Navigation
 * Tests step navigation, state management, and UI updates
 * Requirements: 1.1, 1.3, 5.1, 5.2, 5.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setSetting, getSetting } from '../src/util/settings.js';

// Mock the settings module
vi.mock('../src/util/settings.js', () => ({
    setSetting: vi.fn(),
    getSetting: vi.fn()
}));

describe('2-Step Workspace Navigation Tests', () => {
    let mockNavigationManager;
    let mockDOM;

    beforeEach(() => {
        // Setup DOM structure for 2-step navigation
        document.body.innerHTML = `
            <div class="workspace-container">
                <!-- Step Pills -->
                <div class="workspace-steps">
                    <div class="step active" data-step="1">
                        <span class="step-number">1</span>
                        <span class="step-title">Leis & Artigos</span>
                    </div>
                    <div class="step disabled" data-step="2">
                        <span class="step-number">2</span>
                        <span class="step-title">Prompt Studio</span>
                    </div>
                </div>

                <!-- Step Content -->
                <div class="step-content-container">
                    <div id="step-1-content" class="step-content active">
                        <h2>Leis & Artigos</h2>
                        <div class="document-controls">
                            <select id="document-select">
                                <option value="">Selecione um documento</option>
                            </select>
                            <input type="text" id="search-input" placeholder="Buscar artigos...">
                        </div>
                        <div id="articles-list"></div>
                        <textarea id="context-area" readonly></textarea>
                        <div class="step-actions">
                            <button id="next-to-step-2" disabled>Próximo: Prompt Studio</button>
                        </div>
                    </div>

                    <div id="step-2-content" class="step-content">
                        <h2>Prompt Studio</h2>
                        <div class="prompt-controls">
                            <select id="preset-select">
                                <option value="summary">Resumo</option>
                                <option value="analysis">Análise</option>
                            </select>
                            <textarea id="custom-prompt" placeholder="Prompt personalizado..."></textarea>
                        </div>
                        <div class="ai-controls">
                            <button id="execute-ai" disabled>🤖 Executar IA</button>
                        </div>
                        <div id="ai-output"></div>
                        <div class="step-actions">
                            <button id="back-to-step-1">Voltar: Leis & Artigos</button>
                        </div>
                    </div>
                </div>

                <!-- Navigation State Display -->
                <div id="navigation-debug" class="debug-info">
                    <span id="current-step-display">1</span>
                    <span id="context-count-display">0</span>
                </div>
            </div>
        `;

        // Mock DOM utilities
        mockDOM = {
            getStepPill(stepNumber) {
                return document.querySelector(`.workspace-steps .step[data-step="${stepNumber}"]`);
            },

            getStepContent(stepNumber) {
                return document.getElementById(`step-${stepNumber}-content`);
            },

            getAllStepPills() {
                return document.querySelectorAll('.workspace-steps .step');
            },

            getAllStepContents() {
                return document.querySelectorAll('.step-content');
            },

            updateDebugDisplay(currentStep, contextCount) {
                const stepDisplay = document.getElementById('current-step-display');
                const contextDisplay = document.getElementById('context-count-display');
                if (stepDisplay) stepDisplay.textContent = currentStep;
                if (contextDisplay) contextDisplay.textContent = contextCount;
            }
        };

        // Mock navigation manager for 2-step flow
        mockNavigationManager = {
            currentStep: 1,
            maxSteps: 2,
            selectedContext: {
                articles: [],
                text: '',
                lastUpdated: null
            },
            chromeAIAvailable: false,
            navigationHistory: [],

            /**
             * Navigate to a specific step
             */
            goToStep(stepNumber, options = {}) {
                const { force = false, skipValidation = false } = options;

                // Validate step number
                if (stepNumber < 1 || stepNumber > this.maxSteps) {
                    console.warn(`Invalid step number: ${stepNumber}. Must be between 1 and ${this.maxSteps}`);
                    return false;
                }

                // Check if step is accessible
                if (!skipValidation && !this.isStepAccessible(stepNumber)) {
                    console.warn(`Step ${stepNumber} is not accessible`);
                    return false;
                }

                // Don't navigate if already on the target step (unless forced)
                if (!force && this.currentStep === stepNumber) {
                    return true;
                }

                const previousStep = this.currentStep;
                this.currentStep = stepNumber;

                // Update UI
                this.updateStepUI();
                this.updateStepAccessibility();
                this.updateNavigationButtons();

                // Record navigation
                this.recordNavigation(previousStep, stepNumber);

                // Update debug display
                mockDOM.updateDebugDisplay(this.currentStep, this.selectedContext.articles.length);

                console.debug(`Navigated from step ${previousStep} to step ${stepNumber}`);
                return true;
            },

            /**
             * Check if a step is accessible
             */
            isStepAccessible(stepNumber) {
                switch (stepNumber) {
                    case 1:
                        return true; // Step 1 is always accessible

                    case 2:
                        // Step 2 requires context to be selected
                        return this.selectedContext.articles.length > 0;

                    default:
                        return false;
                }
            },

            /**
             * Update step UI (pills and content)
             */
            updateStepUI() {
                // Update step pills
                mockDOM.getAllStepPills().forEach((pill, index) => {
                    const stepNumber = index + 1;
                    pill.classList.toggle('active', stepNumber === this.currentStep);
                });

                // Update step content
                mockDOM.getAllStepContents().forEach((content, index) => {
                    const stepNumber = index + 1;
                    content.classList.toggle('active', stepNumber === this.currentStep);
                });
            },

            /**
             * Update step accessibility (enabled/disabled states)
             */
            updateStepAccessibility() {
                mockDOM.getAllStepPills().forEach((pill, index) => {
                    const stepNumber = index + 1;
                    const isAccessible = this.isStepAccessible(stepNumber);
                    
                    pill.classList.toggle('disabled', !isAccessible);
                    pill.style.pointerEvents = isAccessible ? 'auto' : 'none';
                    pill.style.opacity = isAccessible ? '1' : '0.5';
                });

                // Update AI execute button
                const executeBtn = document.getElementById('execute-ai');
                if (executeBtn) {
                    const canExecuteAI = this.selectedContext.articles.length > 0 && this.chromeAIAvailable;
                    executeBtn.disabled = !canExecuteAI;
                }
            },

            /**
             * Update navigation buttons
             */
            updateNavigationButtons() {
                const nextBtn = document.getElementById('next-to-step-2');
                const backBtn = document.getElementById('back-to-step-1');

                if (nextBtn) {
                    nextBtn.disabled = !this.isStepAccessible(2);
                }

                if (backBtn) {
                    backBtn.style.display = this.currentStep > 1 ? 'block' : 'none';
                }
            },

            /**
             * Record navigation for history/debugging
             */
            recordNavigation(fromStep, toStep) {
                this.navigationHistory.push({
                    from: fromStep,
                    to: toStep,
                    timestamp: Date.now(),
                    contextSize: this.selectedContext.articles.length,
                    aiAvailable: this.chromeAIAvailable
                });

                // Keep only last 50 navigation records
                if (this.navigationHistory.length > 50) {
                    this.navigationHistory = this.navigationHistory.slice(-50);
                }
            },

            /**
             * Navigate to next step
             */
            nextStep() {
                const nextStepNumber = this.currentStep + 1;
                return this.goToStep(nextStepNumber);
            },

            /**
             * Navigate to previous step
             */
            previousStep() {
                const prevStepNumber = this.currentStep - 1;
                return this.goToStep(prevStepNumber);
            },

            /**
             * Update selected context
             */
            updateSelectedContext(articles) {
                this.selectedContext = {
                    articles: articles || [],
                    text: (articles || []).map(a => `${a.title}\n${a.text}`).join('\n\n'),
                    lastUpdated: Date.now()
                };

                // Update context area
                const contextArea = document.getElementById('context-area');
                if (contextArea) {
                    contextArea.value = this.selectedContext.text;
                }

                // Update step accessibility
                this.updateStepAccessibility();
                this.updateNavigationButtons();

                // Update debug display
                mockDOM.updateDebugDisplay(this.currentStep, this.selectedContext.articles.length);

                // Save context state
                this.saveContextState();
            },

            /**
             * Set Chrome AI availability
             */
            setChromeAIAvailability(available) {
                this.chromeAIAvailable = available;
                this.updateStepAccessibility();
            },

            /**
             * Save context state to storage
             */
            async saveContextState() {
                try {
                    await setSetting('workspace-context-state', this.selectedContext);
                    await setSetting('workspace-current-step', this.currentStep);
                } catch (error) {
                    console.error('Error saving context state:', error);
                }
            },

            /**
             * Restore context state from storage
             */
            async restoreContextState() {
                try {
                    const savedContext = await getSetting('workspace-context-state');
                    const savedStep = await getSetting('workspace-current-step');

                    if (savedContext) {
                        this.selectedContext = savedContext;
                        
                        const contextArea = document.getElementById('context-area');
                        if (contextArea) {
                            contextArea.value = this.selectedContext.text;
                        }
                    }

                    if (savedStep && savedStep >= 1 && savedStep <= this.maxSteps) {
                        this.goToStep(savedStep, { skipValidation: true });
                    }

                    this.updateStepAccessibility();
                    this.updateNavigationButtons();
                    mockDOM.updateDebugDisplay(this.currentStep, this.selectedContext.articles.length);
                } catch (error) {
                    console.error('Error restoring context state:', error);
                }
            },

            /**
             * Reset navigation state
             */
            reset() {
                this.currentStep = 1;
                this.selectedContext = {
                    articles: [],
                    text: '',
                    lastUpdated: null
                };
                this.navigationHistory = [];
                this.chromeAIAvailable = false;

                this.updateStepUI();
                this.updateStepAccessibility();
                this.updateNavigationButtons();
                mockDOM.updateDebugDisplay(this.currentStep, 0);
            },

            /**
             * Get navigation statistics
             */
            getNavigationStats() {
                return {
                    currentStep: this.currentStep,
                    totalNavigations: this.navigationHistory.length,
                    contextSize: this.selectedContext.articles.length,
                    lastNavigation: this.navigationHistory[this.navigationHistory.length - 1] || null,
                    stepAccessibility: {
                        step1: this.isStepAccessible(1),
                        step2: this.isStepAccessible(2)
                    }
                };
            }
        };

        // Setup event listeners
        document.getElementById('next-to-step-2').addEventListener('click', () => {
            mockNavigationManager.nextStep();
        });

        document.getElementById('back-to-step-1').addEventListener('click', () => {
            mockNavigationManager.previousStep();
        });

        // Step pill click handlers
        mockDOM.getAllStepPills().forEach((pill, index) => {
            pill.addEventListener('click', () => {
                const stepNumber = index + 1;
                mockNavigationManager.goToStep(stepNumber);
            });
        });

        // Initialize UI
        mockNavigationManager.updateStepUI();
        mockNavigationManager.updateStepAccessibility();
        mockNavigationManager.updateNavigationButtons();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    describe('Basic Navigation Functionality', () => {
        it('should initialize with step 1 active', () => {
            expect(mockNavigationManager.currentStep).toBe(1);
            
            const activeStepPill = document.querySelector('.workspace-steps .step.active');
            expect(activeStepPill.dataset.step).toBe('1');
            
            const activeContent = document.querySelector('.step-content.active');
            expect(activeContent.id).toBe('step-1-content');
        });

        it('should navigate to valid steps', () => {
            // Add context to enable step 2
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            const result = mockNavigationManager.goToStep(2);
            expect(result).toBe(true);
            expect(mockNavigationManager.currentStep).toBe(2);

            const activeStepPill = document.querySelector('.workspace-steps .step.active');
            expect(activeStepPill.dataset.step).toBe('2');
        });

        it('should reject navigation to invalid steps', () => {
            const result1 = mockNavigationManager.goToStep(0);
            expect(result1).toBe(false);
            expect(mockNavigationManager.currentStep).toBe(1);

            const result2 = mockNavigationManager.goToStep(3);
            expect(result2).toBe(false);
            expect(mockNavigationManager.currentStep).toBe(1);

            const result3 = mockNavigationManager.goToStep(-1);
            expect(result3).toBe(false);
            expect(mockNavigationManager.currentStep).toBe(1);
        });

        it('should handle navigation to same step', () => {
            const result = mockNavigationManager.goToStep(1);
            expect(result).toBe(true);
            expect(mockNavigationManager.currentStep).toBe(1);

            // Should not create navigation history entry for same step
            expect(mockNavigationManager.navigationHistory).toHaveLength(0);
        });

        it('should force navigation when requested', () => {
            const initialHistoryLength = mockNavigationManager.navigationHistory.length;
            
            const result = mockNavigationManager.goToStep(1, { force: true });
            expect(result).toBe(true);
            
            // Should create navigation history entry even for same step when forced
            expect(mockNavigationManager.navigationHistory.length).toBe(initialHistoryLength + 1);
        });
    });

    describe('Step Accessibility Logic', () => {
        it('should always allow access to step 1', () => {
            expect(mockNavigationManager.isStepAccessible(1)).toBe(true);
            
            // Even with no context
            mockNavigationManager.updateSelectedContext([]);
            expect(mockNavigationManager.isStepAccessible(1)).toBe(true);
        });

        it('should require context for step 2 access', () => {
            // No context - step 2 should not be accessible
            mockNavigationManager.updateSelectedContext([]);
            expect(mockNavigationManager.isStepAccessible(2)).toBe(false);

            // With context - step 2 should be accessible
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);
            expect(mockNavigationManager.isStepAccessible(2)).toBe(true);
        });

        it('should prevent navigation to inaccessible steps', () => {
            // No context - cannot navigate to step 2
            mockNavigationManager.updateSelectedContext([]);
            
            const result = mockNavigationManager.goToStep(2);
            expect(result).toBe(false);
            expect(mockNavigationManager.currentStep).toBe(1);
        });

        it('should allow forced navigation to inaccessible steps', () => {
            // No context - but force navigation
            mockNavigationManager.updateSelectedContext([]);
            
            const result = mockNavigationManager.goToStep(2, { skipValidation: true });
            expect(result).toBe(true);
            expect(mockNavigationManager.currentStep).toBe(2);
        });
    });

    describe('UI State Management', () => {
        it('should update step pills correctly', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            mockNavigationManager.goToStep(2);

            const step1Pill = mockDOM.getStepPill(1);
            const step2Pill = mockDOM.getStepPill(2);

            expect(step1Pill.classList.contains('active')).toBe(false);
            expect(step2Pill.classList.contains('active')).toBe(true);
        });

        it('should update step content visibility', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            mockNavigationManager.goToStep(2);

            const step1Content = mockDOM.getStepContent(1);
            const step2Content = mockDOM.getStepContent(2);

            expect(step1Content.classList.contains('active')).toBe(false);
            expect(step2Content.classList.contains('active')).toBe(true);
        });

        it('should update step accessibility styling', () => {
            // No context - step 2 should be disabled
            mockNavigationManager.updateSelectedContext([]);
            mockNavigationManager.updateStepAccessibility();

            const step2Pill = mockDOM.getStepPill(2);
            expect(step2Pill.classList.contains('disabled')).toBe(true);
            expect(step2Pill.style.opacity).toBe('0.5');
            expect(step2Pill.style.pointerEvents).toBe('none');

            // With context - step 2 should be enabled
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            expect(step2Pill.classList.contains('disabled')).toBe(false);
            expect(step2Pill.style.opacity).toBe('1');
            expect(step2Pill.style.pointerEvents).toBe('auto');
        });

        it('should update navigation buttons correctly', () => {
            const nextBtn = document.getElementById('next-to-step-2');
            const backBtn = document.getElementById('back-to-step-1');

            // Step 1 - next disabled (no context), back hidden
            mockNavigationManager.updateSelectedContext([]);
            mockNavigationManager.updateNavigationButtons();

            expect(nextBtn.disabled).toBe(true);
            expect(backBtn.style.display).toBe('none');

            // Step 1 with context - next enabled
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            expect(nextBtn.disabled).toBe(false);

            // Step 2 - back visible
            mockNavigationManager.goToStep(2);
            expect(backBtn.style.display).toBe('block');
        });

        it('should update AI execute button based on context and AI availability', () => {
            const executeBtn = document.getElementById('execute-ai');

            // No context, no AI
            mockNavigationManager.updateSelectedContext([]);
            mockNavigationManager.setChromeAIAvailability(false);
            expect(executeBtn.disabled).toBe(true);

            // Context but no AI
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);
            expect(executeBtn.disabled).toBe(true);

            // Context and AI available
            mockNavigationManager.setChromeAIAvailability(true);
            expect(executeBtn.disabled).toBe(false);

            // No context but AI available
            mockNavigationManager.updateSelectedContext([]);
            expect(executeBtn.disabled).toBe(true);
        });
    });

    describe('Context Management', () => {
        it('should update context correctly', () => {
            const articles = [
                { title: 'Article 1', text: 'Content 1' },
                { title: 'Article 2', text: 'Content 2' }
            ];

            mockNavigationManager.updateSelectedContext(articles);

            expect(mockNavigationManager.selectedContext.articles).toEqual(articles);
            expect(mockNavigationManager.selectedContext.text).toBe('Article 1\nContent 1\n\nArticle 2\nContent 2');
            expect(mockNavigationManager.selectedContext.lastUpdated).toBeTypeOf('number');

            const contextArea = document.getElementById('context-area');
            expect(contextArea.value).toBe(mockNavigationManager.selectedContext.text);
        });

        it('should handle empty context', () => {
            mockNavigationManager.updateSelectedContext([]);

            expect(mockNavigationManager.selectedContext.articles).toEqual([]);
            expect(mockNavigationManager.selectedContext.text).toBe('');

            const contextArea = document.getElementById('context-area');
            expect(contextArea.value).toBe('');
        });

        it('should handle null/undefined context', () => {
            mockNavigationManager.updateSelectedContext(null);

            expect(mockNavigationManager.selectedContext.articles).toEqual([]);
            expect(mockNavigationManager.selectedContext.text).toBe('');

            mockNavigationManager.updateSelectedContext(undefined);

            expect(mockNavigationManager.selectedContext.articles).toEqual([]);
            expect(mockNavigationManager.selectedContext.text).toBe('');
        });

        it('should save context state to storage', async () => {
            setSetting.mockResolvedValue(true);

            const articles = [{ title: 'Test', text: 'Content' }];
            mockNavigationManager.updateSelectedContext(articles);

            await mockNavigationManager.saveContextState();

            expect(setSetting).toHaveBeenCalledWith('workspace-context-state', mockNavigationManager.selectedContext);
            expect(setSetting).toHaveBeenCalledWith('workspace-current-step', mockNavigationManager.currentStep);
        });

        it('should restore context state from storage', async () => {
            const savedContext = {
                articles: [{ title: 'Saved Article', text: 'Saved Content' }],
                text: 'Saved Article\nSaved Content',
                lastUpdated: Date.now() - 1000
            };

            getSetting.mockImplementation((key) => {
                if (key === 'workspace-context-state') return Promise.resolve(savedContext);
                if (key === 'workspace-current-step') return Promise.resolve(2);
                return Promise.resolve(null);
            });

            await mockNavigationManager.restoreContextState();

            expect(mockNavigationManager.selectedContext).toEqual(savedContext);
            expect(mockNavigationManager.currentStep).toBe(2);

            const contextArea = document.getElementById('context-area');
            expect(contextArea.value).toBe(savedContext.text);
        });

        it('should handle context restoration errors', async () => {
            getSetting.mockRejectedValue(new Error('Storage error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await mockNavigationManager.restoreContextState();

            expect(consoleSpy).toHaveBeenCalledWith('Error restoring context state:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('Navigation History', () => {
        it('should record navigation history', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            mockNavigationManager.goToStep(2);
            mockNavigationManager.goToStep(1);

            expect(mockNavigationManager.navigationHistory).toHaveLength(2);
            
            const firstNav = mockNavigationManager.navigationHistory[0];
            expect(firstNav.from).toBe(1);
            expect(firstNav.to).toBe(2);
            expect(firstNav.contextSize).toBe(1);

            const secondNav = mockNavigationManager.navigationHistory[1];
            expect(secondNav.from).toBe(2);
            expect(secondNav.to).toBe(1);
        });

        it('should limit navigation history size', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            // Generate many navigation events
            for (let i = 0; i < 60; i++) {
                const targetStep = (i % 2) + 1;
                mockNavigationManager.goToStep(targetStep, { force: true });
            }

            expect(mockNavigationManager.navigationHistory.length).toBe(50);
        });

        it('should include context and AI info in navigation history', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);
            mockNavigationManager.setChromeAIAvailability(true);

            mockNavigationManager.goToStep(2);

            const lastNav = mockNavigationManager.navigationHistory[mockNavigationManager.navigationHistory.length - 1];
            expect(lastNav.contextSize).toBe(1);
            expect(lastNav.aiAvailable).toBe(true);
            expect(lastNav.timestamp).toBeTypeOf('number');
        });
    });

    describe('Helper Methods', () => {
        it('should navigate to next step', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            const result = mockNavigationManager.nextStep();
            expect(result).toBe(true);
            expect(mockNavigationManager.currentStep).toBe(2);
        });

        it('should navigate to previous step', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);
            mockNavigationManager.goToStep(2);

            const result = mockNavigationManager.previousStep();
            expect(result).toBe(true);
            expect(mockNavigationManager.currentStep).toBe(1);
        });

        it('should handle next step at boundary', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);
            mockNavigationManager.goToStep(2);

            const result = mockNavigationManager.nextStep();
            expect(result).toBe(false);
            expect(mockNavigationManager.currentStep).toBe(2);
        });

        it('should handle previous step at boundary', () => {
            const result = mockNavigationManager.previousStep();
            expect(result).toBe(false);
            expect(mockNavigationManager.currentStep).toBe(1);
        });

        it('should reset navigation state', () => {
            // Setup some state
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);
            mockNavigationManager.goToStep(2);
            mockNavigationManager.setChromeAIAvailability(true);

            // Reset
            mockNavigationManager.reset();

            expect(mockNavigationManager.currentStep).toBe(1);
            expect(mockNavigationManager.selectedContext.articles).toEqual([]);
            expect(mockNavigationManager.navigationHistory).toEqual([]);
            expect(mockNavigationManager.chromeAIAvailable).toBe(false);

            const activeStepPill = document.querySelector('.workspace-steps .step.active');
            expect(activeStepPill.dataset.step).toBe('1');
        });

        it('should provide navigation statistics', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);
            mockNavigationManager.goToStep(2);
            mockNavigationManager.setChromeAIAvailability(true);

            const stats = mockNavigationManager.getNavigationStats();

            expect(stats.currentStep).toBe(2);
            expect(stats.totalNavigations).toBe(1);
            expect(stats.contextSize).toBe(1);
            expect(stats.lastNavigation).toBeTruthy();
            expect(stats.stepAccessibility.step1).toBe(true);
            expect(stats.stepAccessibility.step2).toBe(true);
        });
    });

    describe('Event Handling', () => {
        it('should handle next button click', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            const nextBtn = document.getElementById('next-to-step-2');
            nextBtn.click();

            expect(mockNavigationManager.currentStep).toBe(2);
        });

        it('should handle back button click', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);
            mockNavigationManager.goToStep(2);

            const backBtn = document.getElementById('back-to-step-1');
            backBtn.click();

            expect(mockNavigationManager.currentStep).toBe(1);
        });

        it('should handle step pill clicks', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            const step2Pill = mockDOM.getStepPill(2);
            step2Pill.click();

            expect(mockNavigationManager.currentStep).toBe(2);
        });

        it('should ignore clicks on disabled step pills', () => {
            // No context - step 2 should be disabled
            mockNavigationManager.updateSelectedContext([]);

            const step2Pill = mockDOM.getStepPill(2);
            step2Pill.click();

            // Should remain on step 1
            expect(mockNavigationManager.currentStep).toBe(1);
        });
    });

    describe('Debug and Monitoring', () => {
        it('should update debug display', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' },
                { title: 'Article 2', text: 'Content 2' }
            ]);
            mockNavigationManager.goToStep(2);

            const stepDisplay = document.getElementById('current-step-display');
            const contextDisplay = document.getElementById('context-count-display');

            expect(stepDisplay.textContent).toBe('2');
            expect(contextDisplay.textContent).toBe('2');
        });

        it('should log navigation events', () => {
            const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);
            mockNavigationManager.goToStep(2);

            expect(consoleSpy).toHaveBeenCalledWith('Navigated from step 1 to step 2');

            consoleSpy.mockRestore();
        });

        it('should log warnings for invalid navigation', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            mockNavigationManager.goToStep(0);
            expect(consoleSpy).toHaveBeenCalledWith('Invalid step number: 0. Must be between 1 and 2');

            mockNavigationManager.goToStep(2); // No context
            expect(consoleSpy).toHaveBeenCalledWith('Step 2 is not accessible');

            consoleSpy.mockRestore();
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle rapid navigation changes', () => {
            mockNavigationManager.updateSelectedContext([
                { title: 'Article 1', text: 'Content 1' }
            ]);

            const startTime = performance.now();

            // Rapid navigation
            for (let i = 0; i < 100; i++) {
                const targetStep = (i % 2) + 1;
                mockNavigationManager.goToStep(targetStep, { force: true });
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(200); // Should be reasonably fast
            expect(mockNavigationManager.currentStep).toBe(2); // Last step
        });

        it('should handle large context efficiently', () => {
            const largeContext = Array.from({ length: 1000 }, (_, i) => ({
                title: `Article ${i}`,
                text: `Content ${i}`.repeat(100)
            }));

            const startTime = performance.now();
            mockNavigationManager.updateSelectedContext(largeContext);
            const endTime = performance.now();

            const duration = endTime - startTime;
            expect(duration).toBeLessThan(100); // Should handle large context efficiently
            expect(mockNavigationManager.selectedContext.articles.length).toBe(1000);
        });

        it('should handle missing DOM elements gracefully', () => {
            // Remove some DOM elements
            document.getElementById('context-area').remove();
            document.getElementById('execute-ai').remove();

            // Should not throw errors
            expect(() => {
                mockNavigationManager.updateSelectedContext([
                    { title: 'Article 1', text: 'Content 1' }
                ]);
                mockNavigationManager.updateStepAccessibility();
                mockNavigationManager.updateNavigationButtons();
            }).not.toThrow();
        });
    });
});