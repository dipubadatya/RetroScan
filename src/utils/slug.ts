export function cleanTitleFromFilename(fileName: string): string {
  // Strip file extension
  let base = fileName.replace(/\.[^/.]+$/, '');

  // Strip leading dump numbers (e.g. "1986 - ", "0024 - ")
  base = base.replace(/^\d{1,5}\s*[-_.]\s*/, '');

  // Strip bracketed/parenthetical metadata (e.g. "(USA)", "[!]", "(En,Fr,De)", "(v1.1)")
  base = base.replace(/\s*(\([^)]*\)|\[[^\]]*\])\s*/g, ' ');

  // Strip common revision/dump noise words
  base = base.replace(/\b(version|rev\s*\w*|v\d+(\.\d+)?|disc\s*\d+|cd\s*\d+)\b/gi, ' ');

  // Normalize delimiters to spaces
  base = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Inverted articles (e.g. "Legend of Zelda, The" -> "The Legend of Zelda")
  const articleMatch = base.match(/^(.+?),\s*(The|A|An)$/i);
  if (articleMatch) {
    base = `${articleMatch[2]} ${articleMatch[1]}`;
  }

  return base || fileName.replace(/\.[^/.]+$/, '');
}

/**
 * Generates a 100% deterministic, platform-independent canonical slug for a game.
 * Identical across Android, Windows PC, iOS, different file dumps, and friends' devices.
 */
export function generateCanonicalSlug(titleOrFileName: string): string {
  const cleanTitle = cleanTitleFromFilename(titleOrFileName);
  const slugified = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return slugified || 'unknown_game';
}

/**
 * Slug generator for filenames. Produces a deterministic canonical slug.
 * Kept signature compatible with (fileName, fileSize?) while ensuring
 * deterministic cross-platform permanence.
 */
export function generateFilenameSlug(fileName: string, _fileSize?: number): string {
  return generateCanonicalSlug(fileName);
}

