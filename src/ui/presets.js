export const PRESETS = [
  {
    name: "Summarize in 3 paragraphs",
    kind: "summary",
    task: "Summarize the legal text into 3 concise paragraphs highlighting (1) legal basis, (2) key obligations/rights, (3) risks/limitations.",
    system: "Keep citations to specific articles from CONTEXT where applicable. Avoid new legal claims not present in CONTEXT."
  },
  {
    name: "Clarity & readability review",
    kind: "revise",
    task: "Rewrite the text for clarity and readability, preserving legal meaning, reducing redundancy, and using plain legal language.",
    system: "Keep terminology accurate. Provide sectioned output with headings. Do not invent facts."
  },
  {
    name: "Risk & inconsistency checklist",
    kind: "analyze",
    task: "List potential inconsistencies, missing references, and process risks as bullet points. Propose remediation suggestions.",
    system: "Cite the related article(s) from CONTEXT for each finding whenever possible."
  },
  {
    name: "Draft rental contract clauses",
    kind: "draft",
    task: "Draft standard rental clauses for the given jurisdiction based on CONTEXT, using the provided parameters (parties, dates, address, rent, adjustments, guarantees).",
    system: "Output structured clauses with headings. Include explicit citations to the relevant articles from CONTEXT that justify each clause. Do not exceed the scope of CONTEXT."
  }
];