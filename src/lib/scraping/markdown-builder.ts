export interface AttachmentSection {
  fileName: string;
  text: string;
  url?: string;
  type?: string;
}

export interface SourceDocumentMeta {
  postedAt: Date | null;
  channel: string;
  team: string;
  sender: string;
  teamsMessageId: string;
  syncedAt?: Date;
}

export function buildSourceMarkdown(
  body: string,
  attachmentSections: AttachmentSection[],
  meta: SourceDocumentMeta
): string {
  const postedAt = meta.postedAt?.toISOString() ?? new Date().toISOString();
  const syncedAt = (meta.syncedAt ?? new Date()).toISOString();

  const frontmatter = [
    "---",
    `date: ${postedAt}`,
    `channel: ${meta.channel}`,
    `team: ${meta.team}`,
    `sender: ${meta.sender}`,
    `teamsMessageId: ${meta.teamsMessageId}`,
    `syncedAt: ${syncedAt}`,
    "---",
  ].join("\n");

  let markdown = `${frontmatter}\n\n${body.trim()}`;

  if (attachmentSections.length > 0) {
    markdown += "\n\n## Attachments\n";
    for (const att of attachmentSections) {
      markdown += `\n### ${att.fileName}\n${att.text.trim()}\n`;
    }
  }

  return markdown;
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---\n*/m, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

export function parseMarkdownFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    result[key] = value;
  }
  return result;
}
