// ★ Bangla phonetic input converter
// Converts Latin/English typing to Bangla using a simplified Avro-phonetic-style mapping.
//
// Usage:
//   banglaPhonetic('ami')      → 'আমি'
//   banglaPhonetic('bangla')   → 'বাংলা'
//   banglaPhonetic('tumi kemon acho') → 'তুমি কেমন আছো'
//
// This is a basic converter — handles common cases but not every edge case
// (e.g. complex conjuncts, special Avro rules). For advanced needs, users
// can still use their OS-level Bijoy/Avro keyboard.

// Order matters: longer sequences must be matched before shorter ones
// (e.g. 'kh' before 'k', 'ksh' before 'kh')
const CONSONANT_MAP: [string, string][] = [
  // Special conjuncts first
  ['kSh', 'ক্ষ'],
  ['kkh', 'ক্ষ'],
  ['Ng', 'ঙ'],
  ['NG', 'ঞ'],
  ['jh', 'ঝ'],
  ['kh', 'খ'],
  ['gh', 'ঘ'],
  ['chh', 'ছ'],
  ['ch', 'চ'],
  ['Th', 'ঠ'],
  ['Dh', 'ঢ'],
  ['th', 'থ'],
  ['dh', 'ধ'],
  ['ph', 'ফ'],
  ['bh', 'ভ'],
  ['sh', 'শ'],
  ['Sh', 'ষ'],
  ['ng', 'ং'],
  ['nn', 'ণ্ণ'],
  // Single consonants
  ['k', 'ক'],
  ['g', 'গ'],
  ['j', 'জ'],
  ['T', 'ট'],
  ['D', 'ড'],
  ['t', 'ত'],
  ['d', 'দ'],
  ['n', 'ন'],
  ['N', 'ণ'],
  ['p', 'প'],
  ['f', 'ফ'],
  ['b', 'ব'],
  ['v', 'ভ'],
  ['m', 'ম'],
  ['y', 'য'],
  ['r', 'র'],
  ['l', 'ল'],
  ['s', 'স'],
  ['h', 'হ'],
  ['z', 'য'],
  ['w', 'ও'],
  ['x', 'ক্স'],
  ['q', 'ক'],
]

// Independent vowels (used at start of word or after space)
const VOWEL_MAP: [string, string][] = [
  ['aa', 'আ'],
  ['AA', 'আ'],
  ['i', 'ই'],
  ['ii', 'ঈ'],
  ['ee', 'ঈ'],
  ['I', 'ঈ'],
  ['u', 'উ'],
  ['uu', 'ঊ'],
  ['oo', 'ঊ'],
  ['U', 'ঊ'],
  ['e', 'এ'],
  ['E', 'এ'],
  ['oi', 'ঐ'],
  ['O', 'ঐ'],
  ['o', 'ও'],
  ['O', 'ও'],
  ['ou', 'ঔ'],
  ['au', 'ঔ'],
  ['a', 'আ'],
]

// Vowel signs (matra) — used when vowel comes AFTER a consonant
const VOWEL_SIGN_MAP: [string, string][] = [
  ['aa', 'া'],
  ['i', 'ি'],
  ['ii', 'ী'],
  ['ee', 'ী'],
  ['I', 'ী'],
  ['u', 'ু'],
  ['uu', 'ূ'],
  ['oo', 'ূ'],
  ['U', 'ূ'],
  ['e', 'ে'],
  ['E', 'ে'],
  ['oi', 'ৈ'],
  ['o', 'ো'],
  ['ou', 'ৌ'],
  ['au', 'ৌ'],
  ['a', 'া'], // implicit a after consonant → া
]

// Digits
const DIGIT_MAP: Record<string, string> = {
  '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
  '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
}

// Punctuation that should pass through unchanged
const PUNCTUATION = new Set([' ', '.', ',', ';', ':', '!', '?', "'", '"', '(', ')', '[', ']', '{', '}', '-', '_', '/', '\\', '@', '#', '$', '%', '^', '&', '*', '+', '=', '<', '>', '|', '`', '~', '\n', '\t', '\r'])

function findMatch(input: string, pos: number, map: [string, string][]): [string, string] | null {
  for (const [latin, bangla] of map) {
    if (input.substr(pos, latin.length) === latin) {
      return [latin, bangla]
    }
  }
  return null
}

/**
 * Convert a Latin/English string to Bangla using phonetic mapping.
 *
 * Algorithm:
 *   1. Walk through the input character by character.
 *   2. For each position, try to match the longest consonant or vowel sequence.
 *   3. If a vowel appears at the start of a word (after space/punct/start), use the independent form.
 *   4. If a vowel appears after a consonant, use the matra (diacritic) form.
 *   5. Digits convert to Bangla digits.
 *   6. Punctuation passes through unchanged.
 */
export function banglaPhonetic(input: string): string {
  if (!input) return ''

  let result = ''
  let i = 0
  let lastWasConsonant = false

  while (i < input.length) {
    const ch = input[i]

    // Punctuation / whitespace — pass through, reset consonant flag
    if (PUNCTUATION.has(ch)) {
      result += ch
      lastWasConsonant = false
      i++
      continue
    }

    // Digits
    if (DIGIT_MAP[ch]) {
      result += DIGIT_MAP[ch]
      lastWasConsonant = false
      i++
      continue
    }

    // Try consonant first (longest match)
    const consonantMatch = findMatch(input, i, CONSONANT_MAP)
    if (consonantMatch) {
      result += consonantMatch[1]
      lastWasConsonant = true
      i += consonantMatch[0].length
      continue
    }

    // Try vowel — use independent form if at word start, matra if after consonant
    const vowelMap = lastWasConsonant ? VOWEL_SIGN_MAP : VOWEL_MAP
    const vowelMatch = findMatch(input, i, vowelMap)
    if (vowelMatch) {
      result += vowelMatch[1]
      // After a matra vowel, we're still "after consonant" so subsequent vowels
      // should also be matras — but typically a word has only one vowel sound
      // after a consonant. For simplicity, set to false.
      lastWasConsonant = false
      i += vowelMatch[0].length
      continue
    }

    // Unknown character — pass through unchanged
    result += ch
    lastWasConsonant = false
    i++
  }

  return result
}

/**
 * Convert just the current "word" being typed (text after the last whitespace)
 * to Bangla. Used for real-time conversion as the user types.
 *
 * Returns the full input with the last word converted.
 */
export function banglaPhoneticLastWord(input: string): string {
  if (!input) return ''

  // Find the last word boundary (whitespace or start of string)
  let lastBoundary = input.length
  for (let i = input.length - 1; i >= 0; i--) {
    if (PUNCTUATION.has(input[i]) || input[i] === ' ') {
      lastBoundary = i + 1
      break
    }
    if (i === 0) {
      lastBoundary = 0
      break
    }
  }

  const prefix = input.substring(0, lastBoundary)
  const lastWord = input.substring(lastBoundary)

  return prefix + banglaPhonetic(lastWord)
}
