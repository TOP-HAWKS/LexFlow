/**
 * Document Fetcher for LexFlow
 * Handles fetching legal documents from corpus URLs
 */

import { resolveCorpusBaseUrl } from './corpus-resolver.js';
import { storeArticles, getStoredArticles } from './article-storage.js';

/**
 * Fetch document list from corpus
 * @returns {Promise<Array>} Array of available documents
 */
export async function fetchDocumentsFromCorpus() {
    try {
        console.log('[LexFlow] Fetching documents from GitHub repository...');

        // Try to fetch documents dynamically from GitHub API
        let documents = await fetchDocumentsFromGitHub();

        if (documents.length === 0) {
            console.warn('[LexFlow] No documents found in repository, using fallback');
            documents = getFallbackDocuments();
        }

        // Filter documents by user language preference
        const filteredDocuments = await filterDocumentsByLanguage(documents);

        console.log(`[LexFlow] Returning ${filteredDocuments.length} documents after language filtering`);
        return filteredDocuments;
    } catch (error) {
        console.error('Error fetching documents from corpus:', error);
        return getFallbackDocuments();
    }
}

/**
 * Filter documents by user language preference
 * @param {Array} documents - All available documents
 * @returns {Promise<Array>} Filtered documents
 */
async function filterDocumentsByLanguage(documents) {
    try {
        // Import settings function dynamically
        const settingsModule = await import('./settings.js');
        const settings = await settingsModule.getAllSettings();

        const userLanguage = settings.language || 'en-US';
        console.log(`[LexFlow] Filtering documents for language: ${userLanguage}`);

        // Filter documents by language, with fallback to all documents
        const languageFiltered = documents.filter(doc => {
            const matches = doc.language === userLanguage ||
                !doc.language || // Include documents without language specified
                doc.language === 'en-US'; // Always include English as fallback

            if (matches) {
                console.log(`[LexFlow] Including document: ${doc.title} (${doc.language || 'no language'})`);
            }

            return matches;
        });

        if (languageFiltered.length > 0) {
            console.log(`[LexFlow] Filtered to ${languageFiltered.length} documents for language: ${userLanguage}`);
            return languageFiltered;
        } else {
            console.log('[LexFlow] No documents found for user language, returning all documents');
            return documents;
        }
    } catch (error) {
        console.error('[LexFlow] Error filtering by language:', error);
        return documents;
    }
}

/**
 * Fetch documents from GitHub repository using GitHub API
 * @returns {Promise<Array>} Array of documents found in repository
 */
async function fetchDocumentsFromGitHub() {
    const documents = [];

    try {
        // GitHub API base URL for the repository
        const repoApiUrl = 'https://api.github.com/repos/viniciusvollrath/legal-corpus';

        // Fetch directory structure for different languages and jurisdictions
        const paths = [
            'contents/en-US/us/federal',
            'contents/pt-BR/br/federal'
        ];

        for (const path of paths) {
            try {
                console.log(`[LexFlow] Checking path: ${path}`);
                const response = await fetch(`${repoApiUrl}/contents/${path}`);

                if (response.ok) {
                    const files = await response.json();

                    // Filter for .md files
                    const mdFiles = files.filter(file =>
                        file.type === 'file' &&
                        file.name.endsWith('.md') &&
                        file.size > 100 // Only files with actual content
                    );

                    console.log(`[LexFlow] Found ${mdFiles.length} markdown files in ${path}`);

                    // Convert GitHub API response to document objects
                    for (const file of mdFiles) {
                        const document = await createDocumentFromGitHubFile(file, path);
                        if (document) {
                            documents.push(document);
                        }
                    }
                } else {
                    console.log(`[LexFlow] Path ${path} not found or not accessible`);
                }
            } catch (pathError) {
                console.warn(`[LexFlow] Error fetching ${path}:`, pathError);
            }
        }

        return documents;
    } catch (error) {
        console.error('[LexFlow] Error fetching from GitHub API:', error);
        return [];
    }
}

/**
 * Create document object from GitHub file
 * @param {Object} file - GitHub API file object
 * @param {string} basePath - Base path in repository
 * @returns {Promise<Object|null>} Document object or null if invalid
 */
async function createDocumentFromGitHubFile(file, basePath) {
    try {
        // Extract metadata from file path and name
        const pathParts = basePath.split('/');
        const language = pathParts[1]; // en-US or pt-BR
        const country = pathParts[2]; // us or br
        const level = pathParts[3]; // federal

        // Create document ID from filename
        const fileName = file.name.replace('.md', '');
        const documentId = `${country}-${level}-${fileName}`;

        // Try to fetch the file content to get title from frontmatter
        let title = fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        try {
            const contentResponse = await fetch(file.download_url);
            if (contentResponse.ok) {
                const content = await contentResponse.text();

                // Extract title from YAML frontmatter
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (frontmatterMatch) {
                    const yamlContent = frontmatterMatch[1];
                    const titleMatch = yamlContent.match(/title:\s*["']?([^"'\n]+)["']?/);
                    if (titleMatch) {
                        title = titleMatch[1];
                    }
                }
            }
        } catch (contentError) {
            console.warn(`[LexFlow] Could not fetch content for ${file.name}:`, contentError);
        }

        return {
            id: documentId,
            title: title,
            path: `${basePath}/${file.name}`,
            scope: level.charAt(0).toUpperCase() + level.slice(1),
            jurisdiction: `${country.toUpperCase()}/${level.charAt(0).toUpperCase() + level.slice(1)}`,
            year: extractYearFromContent(title) || new Date().getFullYear(),
            language: language,
            size: file.size,
            lastModified: file.sha
        };
    } catch (error) {
        console.error(`[LexFlow] Error creating document from file ${file.name}:`, error);
        return null;
    }
}

/**
 * Extract year from document title or content
 * @param {string} title - Document title
 * @returns {number|null} Extracted year or null
 */
function extractYearFromContent(title) {
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
}

/**
 * Fetch document content and parse articles
 * @param {Object} document - Document object
 * @returns {Promise<Array>} Array of articles
 */
export async function fetchDocumentContent(document) {
    try {
        // First, try to get from IndexedDB cache
        const cachedArticles = await getStoredArticles(document.id);
        if (cachedArticles && cachedArticles.length > 0) {
            console.log(`[LexFlow] Using cached articles for ${document.id}`);
            return cachedArticles;
        }

        const corpusBaseUrl = await resolveCorpusBaseUrl();
        const documentUrl = `${corpusBaseUrl}/${document.path}`;

        console.log(`[LexFlow] Fetching document from: ${documentUrl}`);
        const response = await fetch(documentUrl);

        if (!response.ok) {
            console.warn(`[LexFlow] Document not found at ${documentUrl}, using mock articles`);
            const mockArticles = getMockArticles(document.id);

            // Store mock articles for faster subsequent loads
            await storeArticles(document.id, mockArticles, 'mock');

            return mockArticles;
        }

        const markdown = await response.text();

        // Check if the document has actual content (not just frontmatter)
        const contentWithoutFrontmatter = markdown.replace(/^---[\s\S]*?---\n?/, '').trim();

        if (!contentWithoutFrontmatter || contentWithoutFrontmatter.length < 50) {
            console.warn(`[LexFlow] Document at ${documentUrl} is empty or has insufficient content, using mock articles`);
            const mockArticles = getMockArticles(document.id);
            await storeArticles(document.id, mockArticles, 'mock');
            return mockArticles;
        }

        const articles = parseMarkdownToArticles(markdown, document);

        if (articles.length === 0) {
            // If parsing failed, use mock articles
            console.warn(`[LexFlow] No articles parsed from ${documentUrl}, using mock articles`);
            const mockArticles = getMockArticles(document.id);
            await storeArticles(document.id, mockArticles, 'mock');
            return mockArticles;
        }

        // Store the fetched articles
        await storeArticles(document.id, articles, 'remote');

        console.log(`[LexFlow] Loaded ${articles.length} articles from ${document.title}`);
        return articles;

    } catch (error) {
        console.error('Error fetching document content:', error);
        const mockArticles = getMockArticles(document.id);
        console.log(`[LexFlow] Using ${mockArticles.length} mock articles for ${document.title}`);

        // Store mock articles as fallback
        try {
            await storeArticles(document.id, mockArticles, 'mock');
        } catch (storeError) {
            console.error('Error storing mock articles:', storeError);
        }

        return mockArticles;
    }
}

/**
 * Parse markdown content into articles
 * @param {string} markdown - Markdown content
 * @param {Object} document - Document object
 * @returns {Array} Array of parsed articles
 */
function parseMarkdownToArticles(markdown, document) {
    const articles = [];

    // Remove YAML frontmatter if present
    const content = markdown.replace(/^---[\s\S]*?---\n/, '');

    // Split by headings (## or ###)
    const sections = content.split(/^(#{2,3})\s+(.+)$/gm);

    let currentHeading = null;
    let currentContent = '';

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        if (section.match(/^#{2,3}$/)) {
            // This is a heading marker, next item is the heading text
            if (currentHeading && currentContent.trim()) {
                articles.push({
                    id: `${document.id}-${slugify(currentHeading)}`,
                    number: currentHeading,
                    content: currentContent.trim(),
                    citation: `${document.jurisdiction}/${document.path}#${slugify(currentHeading)}`,
                    document: document.id
                });
            }
            currentHeading = sections[i + 1];
            currentContent = '';
            i++; // Skip the heading text
        } else if (currentHeading) {
            currentContent += section;
        }
    }

    // Add the last article if exists
    if (currentHeading && currentContent.trim()) {
        articles.push({
            id: `${document.id}-${slugify(currentHeading)}`,
            number: currentHeading,
            content: currentContent.trim(),
            citation: `${document.jurisdiction}/${document.path}#${slugify(currentHeading)}`,
            document: document.id
        });
    }

    return articles;
}

/**
 * Get fallback documents when corpus is not available
 * @returns {Array} Fallback document list
 */
function getFallbackDocuments() {
    return [
        // US Federal documents
        {
            id: 'us-federal-obscenity-constitution-annotated',
            title: 'Obscenity Constitution Annotated',
            path: 'contents/en-US/us/federal/obscenity-constitution-annotated-congressgov-library-of-congress.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 2024,
            language: 'en-US'
        },
        {
            id: 'us-federal-state-power-alcohol',
            title: 'State Power Over Alcohol and First Amendment Free Speech',
            path: 'contents/en-US/us/federal/state-power-over-alcohol-and-first-amendment-free-speech-and-commercial-speech.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 2024,
            language: 'en-US'
        },
        // Brazilian Federal documents
        {
            id: 'br-federal-l8245',
            title: 'Lei 8245 - Lei do Inquilinato',
            path: 'contents/pt-BR/br/federal/l8245.md',
            scope: 'Federal',
            jurisdiction: 'BR/Federal',
            year: 1991,
            language: 'pt-BR'
        },
        // Legacy documents for compatibility
        {
            id: 'constitution-article-i-section-8',
            title: 'U.S. Constitution - Article I, Section 8',
            path: 'en-US/US/federal/constitution/article-i-section-8.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 1787,
            language: 'en-US'
        },
        {
            id: 'constitution-amendment-iv',
            title: 'U.S. Constitution - Amendment IV',
            path: 'en-US/US/federal/constitution/amendment-iv.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 1791,
            language: 'en-US'
        },
        {
            id: 'constitution-amendment-xiv-section-1',
            title: 'U.S. Constitution - Amendment XIV, Section 1',
            path: 'en-US/US/federal/constitution/amendment-xiv-section-1.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 1868,
            language: 'en-US'
        }
    ];
}

/**
 * Get mock articles for testing when document fetch fails
 * @param {string} documentId - Document ID
 * @returns {Array} Mock articles
 */
function getMockArticles(documentId) {
    const mockArticles = {
        'constitution-article-i-section-8': [
            {
                id: 'constitution-article-i-section-8-clause-1',
                number: 'Clause 1 - Taxation Power',
                content: 'The Congress shall have Power To lay and collect Taxes, Duties, Imposts and Excises, to pay the Debts and provide for the common Defence and general Welfare of the United States; but all Duties, Imposts and Excises shall be uniform throughout the United States.',
                citation: 'US/Federal/constitution/article-i-section-8.md#clause-1',
                document: documentId
            },
            {
                id: 'constitution-article-i-section-8-clause-2',
                number: 'Clause 2 - Borrowing Power',
                content: 'To borrow Money on the credit of the United States.',
                citation: 'US/Federal/constitution/article-i-section-8.md#clause-2',
                document: documentId
            },
            {
                id: 'constitution-article-i-section-8-clause-3',
                number: 'Clause 3 - Commerce Clause',
                content: 'To regulate Commerce with foreign Nations, and among the several States, and with the Indian Tribes.',
                citation: 'US/Federal/constitution/article-i-section-8.md#clause-3',
                document: documentId
            },
            {
                id: 'constitution-article-i-section-8-clause-4',
                number: 'Clause 4 - Naturalization and Bankruptcy',
                content: 'To establish an uniform Rule of Naturalization, and uniform Laws on the subject of Bankruptcies throughout the United States.',
                citation: 'US/Federal/constitution/article-i-section-8.md#clause-4',
                document: documentId
            },
            {
                id: 'constitution-article-i-section-8-clause-18',
                number: 'Clause 18 - Necessary and Proper Clause',
                content: 'To make all Laws which shall be necessary and proper for carrying into Execution the foregoing Powers, and all other Powers vested by this Constitution in the Government of the United States, or in any Department or Officer thereof.',
                citation: 'US/Federal/constitution/article-i-section-8.md#clause-18',
                document: documentId
            }
        ],
        'constitution-amendment-iv': [
            {
                id: 'constitution-amendment-iv-text',
                number: 'Fourth Amendment - Search and Seizure',
                content: 'The right of the people to be secure in their persons, houses, papers, and effects, against unreasonable searches and seizures, shall not be violated, and no Warrants shall issue, but upon probable cause, supported by Oath or affirmation, and particularly describing the place to be searched, and the persons or things to be seized.',
                citation: 'US/Federal/constitution/amendment-iv.md#amendment-iv',
                document: documentId
            },
            {
                id: 'constitution-amendment-iv-reasonable-expectation',
                number: 'Reasonable Expectation of Privacy',
                content: 'The Fourth Amendment protects against unreasonable searches and seizures by government officials. A search occurs when the government violates a person\'s reasonable expectation of privacy.',
                citation: 'US/Federal/constitution/amendment-iv.md#reasonable-expectation',
                document: documentId
            },
            {
                id: 'constitution-amendment-iv-warrant-requirement',
                number: 'Warrant Requirement',
                content: 'Generally, searches and seizures must be conducted pursuant to a warrant issued by a neutral magistrate based on probable cause. However, there are several exceptions to this warrant requirement.',
                citation: 'US/Federal/constitution/amendment-iv.md#warrant-requirement',
                document: documentId
            }
        ],
        'constitution-amendment-xiv-section-1': [
            {
                id: 'constitution-amendment-xiv-section-1-citizenship',
                number: 'Citizenship Clause',
                content: 'All persons born or naturalized in the United States, and subject to the jurisdiction thereof, are citizens of the United States and of the State wherein they reside.',
                citation: 'US/Federal/constitution/amendment-xiv-section-1.md#citizenship-clause',
                document: documentId
            },
            {
                id: 'constitution-amendment-xiv-section-1-privileges',
                number: 'Privileges or Immunities Clause',
                content: 'No State shall make or enforce any law which shall abridge the privileges or immunities of citizens of the United States.',
                citation: 'US/Federal/constitution/amendment-xiv-section-1.md#privileges-immunities',
                document: documentId
            },
            {
                id: 'constitution-amendment-xiv-section-1-due-process',
                number: 'Due Process Clause',
                content: 'nor shall any State deprive any person of life, liberty, or property, without due process of law.',
                citation: 'US/Federal/constitution/amendment-xiv-section-1.md#due-process',
                document: documentId
            },
            {
                id: 'constitution-amendment-xiv-section-1-equal-protection',
                number: 'Equal Protection Clause',
                content: 'nor deny to any person within its jurisdiction the equal protection of the laws.',
                citation: 'US/Federal/constitution/amendment-xiv-section-1.md#equal-protection',
                document: documentId
            },
            {
                id: 'constitution-amendment-xiv-section-1-incorporation',
                number: 'Incorporation Doctrine',
                content: 'The Fourteenth Amendment has been interpreted to incorporate most of the Bill of Rights, making them applicable to state governments as well as the federal government.',
                citation: 'US/Federal/constitution/amendment-xiv-section-1.md#incorporation',
                document: documentId
            }
        ]
    };

    // If no specific mock articles found, return generic ones
    if (!mockArticles[documentId]) {
        return [
            {
                id: `${documentId}-article-1`,
                number: 'Article 1',
                content: 'This is a sample article for demonstration purposes. The actual content would be loaded from the legal corpus repository.',
                citation: `US/Federal/${documentId}.md#article-1`,
                document: documentId
            },
            {
                id: `${documentId}-article-2`,
                number: 'Article 2',
                content: 'This is another sample article showing how legal documents are structured and displayed in the LexFlow interface.',
                citation: `US/Federal/${documentId}.md#article-2`,
                document: documentId
            }
        ];
    }

    return mockArticles[documentId];
}

/**
 * Create URL-friendly slug from text
 * @param {string} text - Text to slugify
 * @returns {string} URL-friendly slug
 */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Search articles across all documents
 * @param {Array} documents - Array of documents
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} Array of matching articles
 */
export async function searchArticlesAcrossDocuments(documents, searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
        return [];
    }

    const results = [];
    const term = searchTerm.toLowerCase();

    for (const document of documents) {
        try {
            const articles = await fetchDocumentContent(document);
            const matches = articles.filter(article =>
                article.content.toLowerCase().includes(term) ||
                article.number.toLowerCase().includes(term)
            );

            results.push(...matches.map(article => ({
                ...article,
                documentTitle: document.title
            })));
        } catch (error) {
            console.error(`Error searching in document ${document.id}:`, error);
        }
    }

    return results;
}