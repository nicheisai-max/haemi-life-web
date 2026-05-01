/**
 * Haemi Life Standard Initials Resolver
 *
 * STANDARD RULE:
 * 1. REMOVE TITLES: ["Dr", "Mr", "Mrs", "Ms", "Prof"]
 * 2. SPLIT NAME
 * 3. TAKE FIRST LETTER OF FIRST + LAST WORD
 * 4. MAX LENGTH = 2
 *
 * EXAMPLE: "Dr. Mpho Modise" -> "MM"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '';

  // 1. Remove standard medical/honorific titles (case insensitive)
  const clean = name
    .replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '')
    .trim();

  // 2. Split into parts and remove empty strings
  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '';
  
  if (parts.length === 1) {
    // Single name case: "Mpho" -> "M"
    return parts[0][0].toUpperCase();
  }

  // 3. Take first letter of first and last word: "Mpho Modise" -> "MM"
  // "Dr John Smith" -> "JS" (after title removal)
  return (
    parts[0][0] + parts[parts.length - 1][0]
  ).toUpperCase();
}

/**
 * Builds the canonical URL for a user's profile image.
 *
 * The `/api/files/profile/:userId` endpoint streams the image bytes when
 * the user has one, or returns 204 No Content when the user has no
 * picture — in which case the consuming `<AvatarImage>` will silently
 * fail and the sibling `<AvatarFallback>` (typically initials) takes
 * over without further wiring.
 *
 * Returns an empty string when no `userId` is supplied so callers can
 * pass the result directly into `<AvatarImage src={...} />` without
 * inline conditionals — Radix's primitive treats an empty `src` as a
 * load failure and immediately renders the fallback.
 *
 * Centralised here (single source of truth) so every admin / clinical
 * page that displays a user avatar shares the same URL contract. The
 * previous duplication of this logic across pages was a known drift
 * surface.
 */
export function getProfileImageUrl(userId: string | null | undefined): string {
    if (!userId) return '';
    const baseUrl = import.meta.env.VITE_API_URL ?? '';
    return `${baseUrl}/api/files/profile/${userId}`;
}
