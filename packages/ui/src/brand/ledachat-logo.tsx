/**
 * The LedaChat mark: a white chomper on Leda Purple, mouth open to the top
 * right so the cut reads as an L (docs/brand.md section 4). Brand colours are
 * fixed here on purpose, like the agent logos: the mark looks the same in
 * light and dark.
 */
export const LEDACHAT_MARK_PATH = "M12.7 11.3V3.8A7.5 7.5 0 1 0 20.2 11.3Z";

export function LedaChatLogo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="24" height="24" rx="4" fill="#702EC7" />
      <path d={LEDACHAT_MARK_PATH} fill="#FFFFFF" />
    </svg>
  );
}
