// PWA helpers: standalone detection + guarded service-worker registration.

const PREVIEW_HOST_PATTERNS = [
  /^id-preview--/,
  /^preview--/,
  /\.lovableproject\.com$/,
  /\.lovableproject-dev\.com$/,
  /\.beta\.lovable\.dev$/,
];

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  if (
    h === "lovableproject.com" ||
    h === "lovableproject-dev.com" ||
    h === "beta.lovable.dev"
  ) {
    return true;
  }
  return PREVIEW_HOST_PATTERNS.some((re) => re.test(h));
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-expect-error: non-standard
  if (window.navigator.standalone === true) return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
  if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  return false;
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const killSwitch = url.searchParams.get("sw") === "off";

  const shouldRefuse =
    !import.meta.env.PROD ||
    isInIframe() ||
    isPreviewHost() ||
    killSwitch;

  if (shouldRefuse) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs
          .filter((r) => {
            const scriptURL = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL;
            return scriptURL?.endsWith("/sw.js");
          })
          .map((r) => r.unregister()),
      );
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    /* ignore */
  }
}
