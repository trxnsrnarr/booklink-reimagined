// Client-only helper to load Midtrans Snap.js with a given client key.
const SNAP_SANDBOX_URL = "https://app.sandbox.midtrans.com/snap/snap.js";
const SNAP_PROD_URL = "https://app.midtrans.com/snap/snap.js";

interface SnapResult {
  order_id: string;
  status_code?: string;
  transaction_status?: string;
  payment_type?: string;
}
interface SnapCallbacks {
  onSuccess?: (r: SnapResult) => void;
  onPending?: (r: SnapResult) => void;
  onError?: (r: unknown) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, cb?: SnapCallbacks) => void;
    };
  }
}

let loading: Promise<void> | null = null;
let loadedKey: string | null = null;
let loadedMode: "sandbox" | "production" | null = null;

export function loadSnap(clientKey: string, isProduction = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const mode = isProduction ? "production" : "sandbox";
  if (loadedKey === clientKey && loadedMode === mode && window.snap) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    document.querySelectorAll('script[data-midtrans="1"]').forEach((el) => el.remove());
    window.snap = undefined;
    const s = document.createElement("script");
    s.src = isProduction ? SNAP_PROD_URL : SNAP_SANDBOX_URL;
    s.setAttribute("data-client-key", clientKey);
    s.setAttribute("data-midtrans", "1");
    s.async = true;
    s.onload = () => { loadedKey = clientKey; loadedMode = mode; loading = null; resolve(); };
    s.onerror = () => { loading = null; reject(new Error("Gagal memuat Midtrans Snap")); };
    document.head.appendChild(s);
  });
  return loading;
}

export function openSnap(token: string, cb?: SnapCallbacks) {
  if (!window.snap) throw new Error("Midtrans Snap belum siap");
  window.snap.pay(token, cb);
}
