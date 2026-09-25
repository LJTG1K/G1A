/**
 * The G1A app icon as ImageResponse JSX: white wordmark on a dark bubble with an
 * accent dot. `maskable` keeps everything inside the 80% safe zone and fills the
 * whole square, as Android launchers crop it to their own shape.
 */
export function BrandIcon({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const font = Math.round(size * (maskable ? 0.3 : 0.36));
  const dot = Math.round(size * 0.09);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        borderRadius: radius,
        background: "linear-gradient(145deg, #2c2c2e 0%, #000000 100%)",
        color: "#f5f5f7",
        fontSize: font,
        fontWeight: 700,
        letterSpacing: -font * 0.04,
      }}
    >
      G1A
      <div
        style={{
          position: "absolute",
          width: dot,
          height: dot,
          borderRadius: dot,
          background: "#2997ff",
          top: Math.round(size * (maskable ? 0.3 : 0.22)),
          right: Math.round(size * (maskable ? 0.28 : 0.2)),
        }}
      />
    </div>
  );
}
