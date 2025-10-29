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
        const corpusBaseUrl = await resolveCorpusBaseUrl();

        // For initial implementation, use hardcoded US federal documents
        const documents = [
            {
                id: 'constitution-article-i-section-8',
                title: 'U.S. Constitution - Article I, Section 8',
                path: 'en-US/US/federal/constitution/article-i-section-8.md',
                scope: 'Federal',
                jurisdiction: 'US/Federal',
                year: 1787
            },
            {
                id: 'constitution-amendment-iv',
                title: 'U.S. Constitution - Amendment IV',
                path: 'en-US/US/federal/constitution/amendment-iv.md',
                scope: 'Federal',
                jurisdiction: 'US/Federal',
                year: 1791
            },
            {
                id: 'constitution-amendment-xiv-section-1',
                title: 'U.S. Constitution - Amendment XIV, Section 1',
                path: 'en-US/US/federal/constitution/amendment-xiv-section-1.md',
                scope: 'Federal',
                jurisdiction: 'US/Federal',
                year: 1868
            }
        ];

        return documents;
    } catch (error) {
        console.error('Error fetching documents from corpus:', error);
        return getFallbackDocuments();
    }
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
        {
            id: 'constitution-article-i-section-8',
            title: 'U.S. Constitution - Article I, Section 8',
            path: 'en-US/US/federal/constitution/article-i-section-8.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 1787
        },
        {
            id: 'constitution-amendment-iv',
            title: 'U.S. Constitution - Amendment IV',
            path: 'en-US/US/federal/constitution/amendment-iv.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 1791
        },
        {
            id: 'constitution-amendment-xiv-section-1',
            title: 'U.S. Constitution - Amendment XIV, Section 1',
            path: 'en-US/US/federal/constitution/amendment-xiv-section-1.md',
            scope: 'Federal',
            jurisdiction: 'US/Federal',
            year: 1868
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