"use client";

/**
 * Inline script that runs before first paint (e.g. theme). Marked text/plain on the
 * client so React doesn't warn about rendering a <script>; the server copy is the one
 * that runs. Pattern from Next's "preventing flash before hydration" guide.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
