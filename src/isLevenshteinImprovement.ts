import * as levenshtein from 'fast-levenshtein'

const MIN_SIMILARITY_THRESHOLD = 0.3 // 30% similarity required

export function isLevenshteinImprovement(startText: string, endText: string, comparisonBaseText: string, log = false) {
  const startTextDistanceToBase = levenshtein.get(startText, comparisonBaseText)
  const endTextDistanceToBase = levenshtein.get(endText, comparisonBaseText)
  const combinedDistanceToBase = levenshtein.get(startText + endText, comparisonBaseText)

  // Calculate similarity ratios (0 = completely different, 1 = identical)
  const startSimilarity = 1 - startTextDistanceToBase / Math.max(startText.length, comparisonBaseText.length)
  const endSimilarity = 1 - endTextDistanceToBase / Math.max(endText.length, comparisonBaseText.length)
  const combinedSimilarity =
    1 - combinedDistanceToBase / Math.max(startText.length + endText.length, comparisonBaseText.length)

  // Check if the combined similarity is above threshold
  const isSimilarEnough = combinedSimilarity >= MIN_SIMILARITY_THRESHOLD

  // Check if combining actually improves the match
  const isActualImprovement = combinedSimilarity > Math.max(startSimilarity, endSimilarity)

  // Original distance-based check
  const isDistanceImprovement =
    startTextDistanceToBase >= combinedDistanceToBase && endTextDistanceToBase >= combinedDistanceToBase

  if (log) {
    console.log(
      comparisonBaseText,
      ':\n',
      `${startText} (dist: ${startTextDistanceToBase}, sim: ${startSimilarity.toFixed(3)})`,
      `${endText} (dist: ${endTextDistanceToBase}, sim: ${endSimilarity.toFixed(3)})`,
      `combined (dist: ${combinedDistanceToBase}, sim: ${combinedSimilarity.toFixed(3)})`,
      `\nSimilar enough: ${isSimilarEnough}, Actual improvement: ${isActualImprovement}, Distance improvement: ${isDistanceImprovement}`,
    )
  }

  // Return true only if all conditions are met:
  // 1. Combined similarity is above threshold
  // 2. Combining actually improves similarity
  // 3. Original distance check passes
  return isSimilarEnough && isActualImprovement && isDistanceImprovement
}
