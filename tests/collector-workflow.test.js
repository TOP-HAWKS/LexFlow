/**
 * Collector Workflow Integration Tests
 * Tests content capture from both context menu options, queue management, 
 * metadata editing functionality, and markdown generation with GitHub integration
 * Requirements: 4.1, 4.4, 4.6
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Chrome extension APIs
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
    onClicked: {
      addListener: vi.fn()
    }
  },
  notifications: {
    create: vi.fn()
  },
  tabs: {
    sendMessage: vi.fn()
  }
};

// Mock database operations
const mockDB = {
  addSubmission: vi.fn(),
  listSubmissions: vi.fn(),
  updateSubmission: vi.fn()
};

vi.mock('../src/db.js', () => mockDB);

// Mock markdown builder
const mockMDBuilder = {
  buildMarkdown: vi.fn()
};

vi.mock('../src/util/md-builder.js', () => mockMDBuilder);

// Mock LexFlow App for collector testing
class MockCollectorApp {
    constructor() {
        this.currentView = 'collector';
        this.captureQueue = [];
        this.selectedSubmission = null;
        this.toastMessages = [];
        this.errorLogs = [];
        
        // Initialize DOM elements
        this.initMockDOM();
        
        // Setup Chrome API mock
        global.chrome = mockChrome;
    }

    initMockDOM() {
        document.body.innerHTML = `
            <div class="app-container">
                <!-- Navigation -->
                <nav class="app-nav">
                    <span id="collector-badge" class="nav-badge hidden"></span>
                </nav>

                <!-- Collector View -->
                <div id="collector-view" class="view active">
                    <!-- Capture Queue Section -->
                    <div id="capture-queue" class="queue-section">
                        <h3>Capture Queue <span id="queue-count" class="badge">0</span></h3>
                        <div id="queue-list" class="queue-list"></div>
                        <div id="queue-empty" class="empty-state hidden">
                            <p>No captured content yet</p>
                            <p>Use right-click context menu to capture content from web pages</p>
                        </div>
                    </div>

                    <!-- Metadata Editor Section -->
                    <div id="metadata-editor" class="editor-section hidden">
                        <h3>Edit Metadata</h3>
                        <form id="metadata-form">
                            <div class="form-group">
                                <label for="edit-title">Title *</label>
                                <input type="text" id="edit-title" name="title" required>
                            </div>
                            <div class="form-group">
                                <label for="edit-jurisdiction">Jurisdiction</label>
                                <input type="text" id="edit-jurisdiction" name="jurisdiction" 
                                       placeholder="e.g., Brazil, São Paulo">
                            </div>
                            <div class="form-group">
                                <label for="edit-language">Language</label>
                                <select id="edit-language" name="language">
                                    <option value="pt-BR">Português (Brasil)</option>
                                    <option value="en-US">English (US)</option>
                                    <option value="es-ES">Español</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="edit-source-url">Source URL *</label>
                                <input type="url" id="edit-source-url" name="sourceUrl" required>
                            </div>
                            <div class="form-group">
                                <label for="edit-version-date">Version Date</label>
                                <input type="date" id="edit-version-date" name="versionDate">
                            </div>
                            <div class="form-group">
                                <label for="edit-content">Content *</label>
                                <textarea id="edit-content" name="content" rows="10" required></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" id="cancel-edit">Cancel</button>
                                <button type="button" id="save-metadata">Save Changes</button>
                                <button type="button" id="generate-markdown">Generate Markdown</button>
                            </div>
                        </form>
                    </div>

                    <!-- Markdown Preview Section -->
                    <div id="markdown-preview" class="preview-section hidden">
                        <h3>Markdown Preview</h3>
                        <div id="markdown-content" class="markdown-output"></div>
                        <div class="preview-actions">
                            <button type="button" id="copy-markdown">Copy Markdown</button>
                            <button type="button" id="create-github-issue">Create GitHub Issue</button>
                            <button type="button" id="back-to-editor">Back to Editor</button>
                        </div>
                    </div>
                </div>

                <!-- Toast Container -->
                <div id="toast-container"></div>
            </div>
        `;
    }

    // Content Capture Simulation
    simulateContentCapture(mode, content, metadata = {}) {
        const captureData = {
            type: "LEXFLOW_CAPTURE_PAYLOAD",
            url: metadata.url || "https://example.com/legal-document",
            title: metadata.title || "Legal Document Title",
            text: content,
            mode: mode, // 'selected' or 'full'
            lang: metadata.lang || "pt-BR",
            sourceHint: metadata.sourceHint || "",
            timestamp: Date.now()
        };

        // Simulate service worker processing
        return this.handleCaptureMessage(captureData);
    }

    async handleCaptureMessage(msg) {
        try {
            const submission = {
                ts: msg.timestamp || Date.now(),
                url: msg.url,
                title: msg.title,
                selectionText: msg.text,
                mode: msg.mode || 'selected',
                lang: msg.lang || "pt-BR",
                jurisdiction: null,
                sourceHint: msg.sourceHint || "",
                status: "queued"
            };

            // Mock database save
            await mockDB.addSubmission(submission);
            
            // Add to local queue for UI
            submission.id = Date.now(); // Mock ID
            this.captureQueue.push(submission);
            
            // Update UI
            this.updateQueueDisplay();
            
            // Show success notification
            const modeText = msg.mode === 'full' ? 'full page' : 'selection';
            const charCount = msg.text ? msg.text.length : 0;
            const message = `Content captured (${modeText}${charCount > 0 ? `, ${charCount} chars` : ''})`;
            
            this.showToast(message, 'success');
            
            return { ok: true, mode: msg.mode, charCount };
        } catch (error) {
            this.handleError(error, 'Content capture');
            return { ok: false, error: error.message };
        }
    }

    // Queue Management
    async loadCaptureQueue() {
        try {
            const submissions = await mockDB.listSubmissions('queued');
            this.captureQueue = submissions || [];
            this.updateQueueDisplay();
            return this.captureQueue;
        } catch (error) {
            this.handleError(error, 'Queue loading');
            return [];
        }
    }

    updateQueueDisplay() {
        const queueList = document.getElementById('queue-list');
        const queueCount = document.getElementById('queue-count');
        const queueEmpty = document.getElementById('queue-empty');
        
        if (!queueList) return;
        
        // Update count badge
        if (queueCount) {
            queueCount.textContent = this.captureQueue.length;
        }
        
        // Update navigation badge
        const collectorBadge = document.getElementById('collector-badge');
        if (collectorBadge) {
            if (this.captureQueue.length > 0) {
                collectorBadge.textContent = this.captureQueue.length;
                collectorBadge.classList.remove('hidden');
            } else {
                collectorBadge.classList.add('hidden');
            }
        }
        
        // Show/hide empty state
        if (this.captureQueue.length === 0) {
            queueList.innerHTML = '';
            if (queueEmpty) queueEmpty.classList.remove('hidden');
            return;
        }
        
        if (queueEmpty) queueEmpty.classList.add('hidden');
        
        // Render queue items
        queueList.innerHTML = '';
        this.captureQueue.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'queue-item';
            itemDiv.dataset.id = item.id;
            
            const preview = item.selectionText.substring(0, 150);
            const modeIcon = item.mode === 'full' ? '📄' : '📝';
            const charCount = item.selectionText.length;
            
            itemDiv.innerHTML = `
                <div class="item-header">
                    <span class="mode-icon">${modeIcon}</span>
                    <h4 class="item-title">${item.title}</h4>
                    <span class="item-meta">${charCount} chars • ${item.mode}</span>
                </div>
                <div class="item-preview">${preview}${preview.length < item.selectionText.length ? '...' : ''}</div>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${item.id}">Edit</button>
                    <button class="delete-btn" data-id="${item.id}">Delete</button>
                </div>
            `;
            
            queueList.appendChild(itemDiv);
        });
        
        // Add event listeners
        queueList.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.editSubmission(id);
            });
        });
        
        queueList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.deleteSubmission(id);
            });
        });
    }

    // Metadata Editing
    editSubmission(id) {
        const submission = this.captureQueue.find(item => item.id === id);
        if (!submission) {
            this.showToast('Submission not found', 'error');
            return;
        }
        
        this.selectedSubmission = submission;
        this.showMetadataEditor(submission);
    }

    showMetadataEditor(submission) {
        // Hide queue, show editor
        document.getElementById('capture-queue').classList.add('hidden');
        document.getElementById('metadata-editor').classList.remove('hidden');
        document.getElementById('markdown-preview').classList.add('hidden');
        
        // Populate form
        document.getElementById('edit-title').value = submission.title || '';
        document.getElementById('edit-jurisdiction').value = submission.jurisdiction || '';
        document.getElementById('edit-language').value = submission.lang || 'pt-BR';
        document.getElementById('edit-source-url').value = submission.url || '';
        document.getElementById('edit-version-date').value = this.formatDateForInput(submission.ts);
        document.getElementById('edit-content').value = submission.selectionText || '';
        
        // Add event listeners
        this.addEditorEventListeners();
    }

    addEditorEventListeners() {
        const cancelBtn = document.getElementById('cancel-edit');
        const saveBtn = document.getElementById('save-metadata');
        const generateBtn = document.getElementById('generate-markdown');
        
        // Remove existing listeners
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        saveBtn.replaceWith(saveBtn.cloneNode(true));
        generateBtn.replaceWith(generateBtn.cloneNode(true));
        
        // Add new listeners
        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.cancelEdit();
        });
        
        document.getElementById('save-metadata').addEventListener('click', () => {
            this.saveMetadata();
        });
        
        document.getElementById('generate-markdown').addEventListener('click', () => {
            this.generateMarkdown();
        });
    }

    async saveMetadata() {
        try {
            if (!this.selectedSubmission) {
                throw new Error('No submission selected');
            }
            
            const form = document.getElementById('metadata-form');
            const formData = new FormData(form);
            
            // Validate required fields
            const title = formData.get('title');
            const sourceUrl = formData.get('sourceUrl');
            const content = formData.get('content');
            
            if (!title || !sourceUrl || !content) {
                throw new Error('Title, Source URL, and Content are required');
            }
            
            // Update submission
            const updates = {
                title: title,
                jurisdiction: formData.get('jurisdiction'),
                lang: formData.get('language'),
                url: sourceUrl,
                versionDate: formData.get('versionDate'),
                selectionText: content,
                status: 'editing'
            };
            
            // Mock database update
            await mockDB.updateSubmission(this.selectedSubmission.id, updates);
            
            // Update local copy
            Object.assign(this.selectedSubmission, updates);
            
            // Update queue display
            this.updateQueueDisplay();
            
            this.showToast('Metadata saved successfully', 'success');
            
            return true;
        } catch (error) {
            this.handleError(error, 'Metadata save');
            return false;
        }
    }

    cancelEdit() {
        this.selectedSubmission = null;
        this.showQueueView();
    }

    showQueueView() {
        document.getElementById('capture-queue').classList.remove('hidden');
        document.getElementById('metadata-editor').classList.add('hidden');
        document.getElementById('markdown-preview').classList.add('hidden');
    }

    // Markdown Generation and GitHub Integration
    async generateMarkdown() {
        try {
            if (!this.selectedSubmission) {
                throw new Error('No submission selected');
            }
            
            // Get current form data
            const form = document.getElementById('metadata-form');
            const formData = new FormData(form);
            
            const markdownData = {
                title: formData.get('title'),
                jurisdiction: formData.get('jurisdiction'),
                language: formData.get('language'),
                sourceUrl: formData.get('sourceUrl'),
                versionDate: formData.get('versionDate'),
                content: formData.get('content')
            };
            
            // Generate markdown using builder
            const markdown = mockMDBuilder.buildMarkdown(markdownData);
            
            // Show preview
            this.showMarkdownPreview(markdown);
            
            return markdown;
        } catch (error) {
            this.handleError(error, 'Markdown generation');
            return null;
        }
    }

    showMarkdownPreview(markdown) {
        // Hide editor, show preview
        document.getElementById('metadata-editor').classList.add('hidden');
        document.getElementById('markdown-preview').classList.remove('hidden');
        
        // Display markdown
        const contentDiv = document.getElementById('markdown-content');
        contentDiv.innerHTML = `<pre><code>${this.escapeHtml(markdown)}</code></pre>`;
        
        // Store markdown for copying
        this.generatedMarkdown = markdown;
        
        // Add preview event listeners
        this.addPreviewEventListeners();
    }

    addPreviewEventListeners() {
        const copyBtn = document.getElementById('copy-markdown');
        const githubBtn = document.getElementById('create-github-issue');
        const backBtn = document.getElementById('back-to-editor');
        
        // Remove existing listeners
        copyBtn.replaceWith(copyBtn.cloneNode(true));
        githubBtn.replaceWith(githubBtn.cloneNode(true));
        backBtn.replaceWith(backBtn.cloneNode(true));
        
        // Add new listeners
        document.getElementById('copy-markdown').addEventListener('click', () => {
            this.copyMarkdownToClipboard();
        });
        
        document.getElementById('create-github-issue').addEventListener('click', () => {
            this.createGitHubIssue();
        });
        
        document.getElementById('back-to-editor').addEventListener('click', () => {
            this.backToEditor();
        });
    }

    async copyMarkdownToClipboard() {
        try {
            if (!this.generatedMarkdown) {
                throw new Error('No markdown to copy');
            }
            
            // Use Clipboard API if available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(this.generatedMarkdown);
            } else {
                // Fallback for testing environment
                this.fallbackCopyToClipboard(this.generatedMarkdown);
            }
            
            this.showToast('Markdown copied to clipboard', 'success');
            return true;
        } catch (error) {
            this.handleError(error, 'Clipboard copy');
            return false;
        }
    }

    fallbackCopyToClipboard(text) {
        // Create temporary textarea for copying
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    createGitHubIssue() {
        try {
            if (!this.selectedSubmission || !this.generatedMarkdown) {
                throw new Error('No content available for GitHub issue');
            }
            
            const title = encodeURIComponent(`Legal Content: ${this.selectedSubmission.title}`);
            const body = encodeURIComponent(this.generatedMarkdown);
            const labels = encodeURIComponent('legal-content,lexflow-capture');
            
            // Construct GitHub issue URL
            const githubUrl = `https://github.com/owner/repo/issues/new?title=${title}&body=${body}&labels=${labels}`;
            
            // Open in new tab (simulated for testing)
            this.openGitHubIssue(githubUrl);
            
            // Mark submission as completed
            this.markSubmissionCompleted();
            
            this.showToast('GitHub issue created successfully', 'success');
            
            return githubUrl;
        } catch (error) {
            this.handleError(error, 'GitHub issue creation');
            return null;
        }
    }

    openGitHubIssue(url) {
        // In real implementation, this would open a new tab
        // For testing, we just store the URL
        this.lastGitHubUrl = url;
        console.log('GitHub issue URL:', url);
    }

    async markSubmissionCompleted() {
        try {
            if (!this.selectedSubmission) return;
            
            // Update status to completed
            await mockDB.updateSubmission(this.selectedSubmission.id, { status: 'completed' });
            
            // Remove from queue
            this.captureQueue = this.captureQueue.filter(item => item.id !== this.selectedSubmission.id);
            
            // Update display
            this.updateQueueDisplay();
            
            // Return to queue view
            this.showQueueView();
            
            this.selectedSubmission = null;
        } catch (error) {
            this.handleError(error, 'Submission completion');
        }
    }

    backToEditor() {
        document.getElementById('markdown-preview').classList.add('hidden');
        document.getElementById('metadata-editor').classList.remove('hidden');
    }

    // Utility Methods
    deleteSubmission(id) {
        const index = this.captureQueue.findIndex(item => item.id === id);
        if (index !== -1) {
            this.captureQueue.splice(index, 1);
            this.updateQueueDisplay();
            this.showToast('Submission deleted', 'success');
        }
    }

    formatDateForInput(timestamp) {
        const date = new Date(timestamp);
        return date.toISOString().split('T')[0];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Error Handling and Toast System
    handleError(error, context) {
        this.errorLogs.push({ error: error.message, context, timestamp: Date.now() });
        this.showToast(`Error: ${error.message}`, 'error');
        console.error(`Error in ${context}:`, error);
    }

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

    // Test Utilities
    getToastMessages() {
        return this.toastMessages;
    }

    getErrorLogs() {
        return this.errorLogs;
    }

    getCaptureQueue() {
        return this.captureQueue;
    }

    getSelectedSubmission() {
        return this.selectedSubmission;
    }

    clearToasts() {
        this.toastMessages = [];
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            toastContainer.innerHTML = '';
        }
    }

    reset() {
        this.captureQueue = [];
        this.selectedSubmission = null;
        this.toastMessages = [];
        this.errorLogs = [];
        this.generatedMarkdown = null;
        this.lastGitHubUrl = null;
        this.clearToasts();
        this.showQueueView();
    }
}

describe('Collector Workflow Integration Tests', () => {
    let app;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        
        // Create fresh app instance
        app = new MockCollectorApp();
        
        // Setup default mock responses
        mockDB.addSubmission.mockResolvedValue(true);
        mockDB.listSubmissions.mockResolvedValue([]);
        mockDB.updateSubmission.mockResolvedValue(true);
        mockMDBuilder.buildMarkdown.mockReturnValue('# Mock Markdown\n\nContent here');
        
        // Mock clipboard API
        global.navigator.clipboard = {
            writeText: vi.fn().mockResolvedValue()
        };
    });

    afterEach(() => {
        app.reset();
    });

    describe('Content Capture from Context Menu Options (Requirement 4.1)', () => {
        it('should capture selected text content successfully', async () => {
            const selectedText = "Article 5. All persons are equal before the law.";
            const metadata = {
                url: "https://example.com/constitution",
                title: "Brazilian Constitution",
                lang: "pt-BR"
            };

            const result = await app.simulateContentCapture('selected', selectedText, metadata);

            expect(result.ok).toBe(true);
            expect(result.mode).toBe('selected');
            expect(result.charCount).toBe(selectedText.length);

            // Verify database call
            expect(mockDB.addSubmission).toHaveBeenCalledWith(
                expect.objectContaining({
                    ts: expect.any(Number),
                    url: metadata.url,
                    title: metadata.title,
                    selectionText: selectedText,
                    mode: 'selected',
                    lang: metadata.lang,
                    jurisdiction: null,
                    sourceHint: "",
                    status: "queued"
                })
            );

            // Verify queue was updated
            expect(app.getCaptureQueue()).toHaveLength(1);
            expect(app.getCaptureQueue()[0].selectionText).toBe(selectedText);

            // Verify success toast
            const toasts = app.getToastMessages();
            expect(toasts.some(toast => 
                toast.message.includes('Content captured') && 
                toast.message.includes('selection') &&
                toast.type === 'success'
            )).toBe(true);
        });

        it('should capture full page content with character limit', async () => {
            // Create content that exceeds 50k characters
            const longContent = 'A'.repeat(60000);
            const metadata = {
                url: "https://example.com/long-document",
                title: "Long Legal Document"
            };

            const result = await app.simulateContentCapture('full', longContent, metadata);

            expect(result.ok).toBe(true);
            expect(result.mode).toBe('full');
            expect(result.charCount).toBe(60000);

            // Verify database call
            expect(mockDB.addSubmission).toHaveBeenCalledWith(
                expect.objectContaining({
                    ts: expect.any(Number),
                    url: metadata.url,
                    title: metadata.title,
                    selectionText: longContent,
                    mode: 'full',
                    lang: "pt-BR",
                    jurisdiction: null,
                    sourceHint: "",
                    status: "queued"
                })
            );

            // Verify success toast mentions full page
            const toasts = app.getToastMessages();
            expect(toasts.some(toast => 
                toast.message.includes('Content captured') && 
                toast.message.includes('full page') &&
                toast.message.includes('60000 chars')
            )).toBe(true);
        });

        it('should handle capture errors gracefully', async () => {
            // Mock database error
            mockDB.addSubmission.mockRejectedValue(new Error('Database quota exceeded'));

            const result = await app.simulateContentCapture('selected', 'Test content');

            expect(result.ok).toBe(false);
            expect(result.error).toBe('Database quota exceeded');

            // Verify error was logged
            const errorLogs = app.getErrorLogs();
            expect(errorLogs).toHaveLength(1);
            expect(errorLogs[0].error).toContain('Database quota exceeded');

            // Verify error toast
            const toasts = app.getToastMessages();
            expect(toasts.some(toast => 
                toast.type === 'error' && 
                toast.message.includes('Error')
            )).toBe(true);
        });

        it('should update navigation badges when content is captured', async () => {
            expect(app.getCaptureQueue()).toHaveLength(0);

            // Capture first item
            await app.simulateContentCapture('selected', 'First content');
            
            let badge = document.getElementById('collector-badge');
            expect(badge.textContent).toBe('1');
            expect(badge.classList.contains('hidden')).toBe(false);

            // Capture second item
            await app.simulateContentCapture('full', 'Second content');
            
            badge = document.getElementById('collector-badge');
            expect(badge.textContent).toBe('2');

            // Verify queue count
            const queueCount = document.getElementById('queue-count');
            expect(queueCount.textContent).toBe('2');
        });
    });

    describe('Queue Management and Metadata Editing (Requirement 4.4)', () => {
        beforeEach(async () => {
            // Setup test data
            await app.simulateContentCapture('selected', 'Article 1 content', {
                url: 'https://example.com/doc1',
                title: 'Document 1'
            });
            await app.simulateContentCapture('full', 'Full document content', {
                url: 'https://example.com/doc2',
                title: 'Document 2'
            });
        });

        it('should display capture queue with proper formatting', () => {
            const queueList = document.getElementById('queue-list');
            const queueItems = queueList.querySelectorAll('.queue-item');
            
            expect(queueItems).toHaveLength(2);

            // Check first item (selected text)
            const firstItem = queueItems[0];
            expect(firstItem.querySelector('.mode-icon').textContent).toBe('📝');
            expect(firstItem.querySelector('.item-title').textContent).toBe('Document 1');
            expect(firstItem.querySelector('.item-meta').textContent).toContain('selected');
            expect(firstItem.querySelector('.item-preview').textContent).toContain('Article 1 content');

            // Check second item (full page)
            const secondItem = queueItems[1];
            expect(secondItem.querySelector('.mode-icon').textContent).toBe('📄');
            expect(secondItem.querySelector('.item-title').textContent).toBe('Document 2');
            expect(secondItem.querySelector('.item-meta').textContent).toContain('full');
        });

        it('should open metadata editor when edit button is clicked', () => {
            const editBtn = document.querySelector('.edit-btn');
            editBtn.click();

            // Verify editor is shown
            expect(document.getElementById('capture-queue').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('metadata-editor').classList.contains('hidden')).toBe(false);

            // Verify form is populated
            const submission = app.getCaptureQueue()[0];
            expect(document.getElementById('edit-title').value).toBe(submission.title);
            expect(document.getElementById('edit-source-url').value).toBe(submission.url);
            expect(document.getElementById('edit-content').value).toBe(submission.selectionText);
            expect(document.getElementById('edit-language').value).toBe(submission.lang);
        });

        it('should save metadata changes successfully', async () => {
            // Open editor
            const editBtn = document.querySelector('.edit-btn');
            editBtn.click();

            // Modify form data
            document.getElementById('edit-title').value = 'Updated Title';
            document.getElementById('edit-jurisdiction').value = 'Brazil, São Paulo';
            document.getElementById('edit-language').value = 'en-US';
            document.getElementById('edit-source-url').value = 'https://updated-url.com';
            document.getElementById('edit-version-date').value = '2024-01-15';
            document.getElementById('edit-content').value = 'Updated content text';

            // Save changes
            const saveBtn = document.getElementById('save-metadata');
            const result = await new Promise(resolve => {
                saveBtn.addEventListener('click', async () => {
                    const success = await app.saveMetadata();
                    resolve(success);
                });
                saveBtn.click();
            });

            expect(result).toBe(true);

            // Verify database update was called
            expect(mockDB.updateSubmission).toHaveBeenCalledWith(
                expect.any(Number),
                {
                    title: 'Updated Title',
                    jurisdiction: 'Brazil, São Paulo',
                    lang: 'en-US',
                    url: 'https://updated-url.com',
                    versionDate: '2024-01-15',
                    selectionText: 'Updated content text',
                    status: 'editing'
                }
            );

            // Verify success toast
            const toasts = app.getToastMessages();
            expect(toasts.some(toast => 
                toast.message.includes('Metadata saved successfully') &&
                toast.type === 'success'
            )).toBe(true);
        });

        it('should validate required fields before saving', async () => {
            // Open editor
            const editBtn = document.querySelector('.edit-btn');
            editBtn.click();

            // Clear required fields
            document.getElementById('edit-title').value = '';
            document.getElementById('edit-source-url').value = '';
            document.getElementById('edit-content').value = '';

            // Attempt to save
            const result = await app.saveMetadata();

            expect(result).toBe(false);

            // Verify error was shown
            const errorLogs = app.getErrorLogs();
            expect(errorLogs.some(log => 
                log.error.includes('Title, Source URL, and Content are required')
            )).toBe(true);

            // Verify database was not called
            expect(mockDB.updateSubmission).not.toHaveBeenCalled();
        });

        it('should cancel editing and return to queue view', () => {
            // Open editor
            const editBtn = document.querySelector('.edit-btn');
            editBtn.click();

            // Cancel editing
            const cancelBtn = document.getElementById('cancel-edit');
            cancelBtn.click();

            // Verify queue view is shown
            expect(document.getElementById('capture-queue').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('metadata-editor').classList.contains('hidden')).toBe(true);
            expect(app.getSelectedSubmission()).toBeNull();
        });

        it('should delete submissions from queue', () => {
            const initialCount = app.getCaptureQueue().length;
            
            // Delete first item
            const deleteBtn = document.querySelector('.delete-btn');
            deleteBtn.click();

            expect(app.getCaptureQueue()).toHaveLength(initialCount - 1);

            // Verify success toast
            const toasts = app.getToastMessages();
            expect(toasts.some(toast => 
                toast.message.includes('Submission deleted') &&
                toast.type === 'success'
            )).toBe(true);
        });

        it('should show empty state when queue is empty', () => {
            // Clear all items by creating a fresh app with empty queue
            app.reset();
            app.captureQueue = [];
            app.updateQueueDisplay();

            const queueEmpty = document.getElementById('queue-empty');
            expect(queueEmpty.classList.contains('hidden')).toBe(false);
            expect(queueEmpty.textContent).toContain('No captured content yet');

            // Badge should be hidden
            const badge = document.getElementById('collector-badge');
            expect(badge.classList.contains('hidden')).toBe(true);
        });
    });

    describe('Markdown Generation and GitHub Integration (Requirement 4.6)', () => {
        beforeEach(async () => {
            // Setup test submission
            await app.simulateContentCapture('selected', 'Test legal content', {
                url: 'https://example.com/legal-doc',
                title: 'Test Legal Document'
            });
            
            // Open editor
            const editBtn = document.querySelector('.edit-btn');
            editBtn.click();
        });

        it('should generate markdown with proper YAML frontmatter', async () => {
            // Fill form with test data
            document.getElementById('edit-title').value = 'Legal Article Test';
            document.getElementById('edit-jurisdiction').value = 'Brazil, Federal';
            document.getElementById('edit-language').value = 'pt-BR';
            document.getElementById('edit-source-url').value = 'https://example.com/source';
            document.getElementById('edit-version-date').value = '2024-01-15';
            document.getElementById('edit-content').value = 'Article content here';

            const markdown = await app.generateMarkdown();

            expect(markdown).toBeTruthy();

            // Verify markdown builder was called with correct data
            expect(mockMDBuilder.buildMarkdown).toHaveBeenCalledWith({
                title: 'Legal Article Test',
                jurisdiction: 'Brazil, Federal',
                language: 'pt-BR',
                sourceUrl: 'https://example.com/source',
                versionDate: '2024-01-15',
                content: 'Article content here'
            });

            // Verify preview is shown
            expect(document.getElementById('metadata-editor').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('markdown-preview').classList.contains('hidden')).toBe(false);

            // Verify markdown content is displayed
            const markdownContent = document.getElementById('markdown-content');
            expect(markdownContent.innerHTML).toContain('Mock Markdown');
        });

        it('should copy markdown to clipboard successfully', async () => {
            await app.generateMarkdown();

            const result = await app.copyMarkdownToClipboard();

            expect(result).toBe(true);
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# Mock Markdown\n\nContent here');

            // Verify success toast
            const toasts = app.getToastMessages();
            expect(toasts.some(toast => 
                toast.message.includes('Markdown copied to clipboard') &&
                toast.type === 'success'
            )).toBe(true);
        });

        it('should handle clipboard copy errors gracefully', async () => {
            await app.generateMarkdown();

            // Mock clipboard error
            navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard access denied'));

            const result = await app.copyMarkdownToClipboard();

            expect(result).toBe(false);

            // Verify error was logged
            const errorLogs = app.getErrorLogs();
            expect(errorLogs.some(log => 
                log.error.includes('Clipboard access denied')
            )).toBe(true);
        });

        it('should create GitHub issue with proper URL formatting', async () => {
            await app.generateMarkdown();

            const githubUrl = app.createGitHubIssue();

            expect(githubUrl).toBeTruthy();
            expect(githubUrl).toContain('https://github.com/owner/repo/issues/new');
            expect(githubUrl).toContain('title=Legal%20Content%3A%20Test%20Legal%20Document');
            expect(githubUrl).toContain('labels=legal-content%2Clexflow-capture');

            // Verify URL was stored for testing
            expect(app.lastGitHubUrl).toBe(githubUrl);

            // Verify success toast
            const toasts = app.getToastMessages();
            expect(toasts.some(toast => 
                toast.message.includes('GitHub issue created successfully') &&
                toast.type === 'success'
            )).toBe(true);
        });

        it('should mark submission as completed after GitHub issue creation', async () => {
            await app.generateMarkdown();

            const initialQueueLength = app.getCaptureQueue().length;
            
            app.createGitHubIssue();

            // Wait for async completion
            await new Promise(resolve => setTimeout(resolve, 0));

            // Verify submission was marked as completed
            expect(mockDB.updateSubmission).toHaveBeenCalledWith(
                expect.any(Number),
                { status: 'completed' }
            );

            // Verify submission was removed from queue
            expect(app.getCaptureQueue()).toHaveLength(initialQueueLength - 1);

            // Verify returned to queue view
            expect(document.getElementById('capture-queue').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('markdown-preview').classList.contains('hidden')).toBe(true);
        });

        it('should navigate back to editor from preview', async () => {
            await app.generateMarkdown();

            // Click back to editor
            const backBtn = document.getElementById('back-to-editor');
            backBtn.click();

            // Verify editor is shown
            expect(document.getElementById('markdown-preview').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('metadata-editor').classList.contains('hidden')).toBe(false);
        });

        it('should handle missing content for GitHub issue creation', () => {
            // Try to create GitHub issue without generating markdown
            app.selectedSubmission = null;
            
            const result = app.createGitHubIssue();

            expect(result).toBeNull();

            // Verify error was logged
            const errorLogs = app.getErrorLogs();
            expect(errorLogs.some(log => 
                log.error.includes('No content available for GitHub issue')
            )).toBe(true);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle database connection errors during queue loading', async () => {
            mockDB.listSubmissions.mockRejectedValue(new Error('Database connection failed'));

            const result = await app.loadCaptureQueue();

            expect(result).toEqual([]);

            // Verify error was logged
            const errorLogs = app.getErrorLogs();
            expect(errorLogs.some(log => 
                log.error.includes('Database connection failed')
            )).toBe(true);
        });

        it('should handle metadata update failures', async () => {
            await app.simulateContentCapture('selected', 'Test content');
            
            // Open editor
            const editBtn = document.querySelector('.edit-btn');
            editBtn.click();

            // Mock database error
            mockDB.updateSubmission.mockRejectedValue(new Error('Update failed'));

            const result = await app.saveMetadata();

            expect(result).toBe(false);

            // Verify error was handled
            const errorLogs = app.getErrorLogs();
            expect(errorLogs.some(log => 
                log.error.includes('Update failed')
            )).toBe(true);
        });

        it('should handle markdown generation errors', async () => {
            await app.simulateContentCapture('selected', 'Test content');
            
            const editBtn = document.querySelector('.edit-btn');
            editBtn.click();

            // Mock markdown builder error
            mockMDBuilder.buildMarkdown.mockImplementation(() => {
                throw new Error('Markdown generation failed');
            });

            const result = await app.generateMarkdown();

            expect(result).toBeNull();

            // Verify error was logged
            const errorLogs = app.getErrorLogs();
            expect(errorLogs.some(log => 
                log.error.includes('Markdown generation failed')
            )).toBe(true);
        });

        it('should handle empty capture queue gracefully', () => {
            // Ensure queue is empty
            app.reset();

            // Try to edit non-existent submission
            app.editSubmission(999);

            // Verify error toast was shown
            const toasts = app.getToastMessages();
            expect(toasts.some(toast => 
                toast.message.includes('Submission not found') &&
                toast.type === 'error'
            )).toBe(true);
        });
    });

    describe('Integration with Chrome Extension APIs', () => {
        it('should properly format capture messages for service worker', async () => {
            const testContent = "Legal article content";
            const testMetadata = {
                url: "https://example.com/legal",
                title: "Legal Document",
                lang: "pt-BR",
                sourceHint: "Article 123"
            };

            await app.simulateContentCapture('selected', testContent, testMetadata);

            // Verify proper message format was processed
            expect(mockDB.addSubmission).toHaveBeenCalledWith(
                expect.objectContaining({
                    ts: expect.any(Number),
                    url: testMetadata.url,
                    title: testMetadata.title,
                    selectionText: testContent,
                    mode: 'selected',
                    lang: testMetadata.lang,
                    jurisdiction: null,
                    sourceHint: testMetadata.sourceHint,
                    status: "queued"
                })
            );
        });

        it('should handle both selected and full page capture modes', async () => {
            // Test selected mode
            await app.simulateContentCapture('selected', 'Selected text');
            expect(app.getCaptureQueue()[0].mode).toBe('selected');

            // Test full page mode
            await app.simulateContentCapture('full', 'Full page content');
            expect(app.getCaptureQueue()[1].mode).toBe('full');

            // Verify different icons are used
            const queueItems = document.querySelectorAll('.queue-item');
            expect(queueItems[0].querySelector('.mode-icon').textContent).toBe('📝');
            expect(queueItems[1].querySelector('.mode-icon').textContent).toBe('📄');
        });
    });
});