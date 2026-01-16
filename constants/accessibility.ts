/**
 * Accessibility constants for font scaling
 * 
 * These values cap the maximum font size multiplier to prevent
 * layout breakage when users have large font accessibility settings enabled.
 * 
 * Usage:
 *   <ThemedText maxFontSizeMultiplier={FontScaling.button}>Button Text</ThemedText>
 *   <Text maxFontSizeMultiplier={FontScaling.label}>Label</Text>
 */

export const FontScaling = {
  // Critical UI elements that must fit in constrained spaces
  button: 1.2,      // Buttons, action text
  badge: 1.1,       // Small badges, counts
  
  // Standard text elements
  label: 1.3,       // Form labels, section headers
  body: 1.4,        // Body text, descriptions
  
  // Large display text (already large, limit scaling)
  title: 1.2,       // Screen titles
  display: 1.1,     // Large numbers (credits, stats)
  
  // Allow more scaling for readability
  paragraph: 1.5,   // Long-form text, terms, privacy policy
} as const;

/**
 * Props to add to Text components that must fit in constrained spaces
 * Combines maxFontSizeMultiplier with adjustsFontSizeToFit
 */
export const constrainedTextProps = {
  maxFontSizeMultiplier: FontScaling.button,
  adjustsFontSizeToFit: true,
  numberOfLines: 1,
} as const;
