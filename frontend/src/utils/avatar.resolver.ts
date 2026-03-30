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
export function getInitials(name: string): string {
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
