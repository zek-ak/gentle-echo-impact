import { useEffect, useState } from "react";
import { isStandalonePWA } from "@/lib/pwa";

const STORAGE_KEY = "pwa_entered_v1";

/**
 * Gate shown ONLY when the app is launched as an installed PWA
 * (display-mode: standalone). Browser/website users bypass this entirely.
 *
 * Shows a startup screen with only the "Press Here to Contribute" button.
 * After click, the regular app renders for the rest of the session.
 */
export default function PWAGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [entered, setEntered] = useState(true);

  useEffect(() => {
    setMounted(true);
    const isPwa = isStandalonePWA();
    setStandalone(isPwa);
    if (isPwa) {
      const already = typeof sessionStorage !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1";
      setEntered(already);
    } else {
      setEntered(true);
    }
  }, []);

  // Until hydrated, always render children so SSR/website is unchanged.
  if (!mounted) return <>{children}</>;
  if (!standalone || entered) return <>{children}</>;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at top, #1a2238 0%, #0b0f1a 60%, #05070d 100%)",
        color: "white",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <img
        src="/sdaLogo.png"
        alt="Chuo Kikuu SDA"
        style={{ width: 96, height: 96, marginBottom: 24, borderRadius: 16 }}
      />
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
        Chuo Kikuu SDA Church
      </h1>
      <p style={{ opacity: 0.75, marginBottom: 40, maxWidth: 320, lineHeight: 1.5 }}>
        Welcome. Tap below to begin your contribution.
      </p>
      <button
        onClick={() => {
          try {
            sessionStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
          setEntered(true);
        }}
        style={{
          padding: "16px 32px",
          borderRadius: 16,
          border: "none",
          background: "linear-gradient(90deg, #d4af37, #f5c842, #d4af37)",
          color: "white",
          fontSize: "1.05rem",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 10px 30px rgba(212, 175, 55, 0.35)",
          letterSpacing: "0.02em",
        }}
      >
        Press Here to Contribute
      </button>
    </div>
  );
}
