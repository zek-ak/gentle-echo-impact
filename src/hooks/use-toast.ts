// Lightweight toast hook backed by sonner, providing the same API
// the source repo uses: const { toast } = useToast(); toast({ title, description, variant }).
import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

function toast(options: ToastOptions) {
  const { title, description, variant } = options;
  if (variant === "destructive") {
    return sonnerToast.error(title || "", { description });
  }
  return sonnerToast(title || "", { description });
}

export function useToast() {
  return { toast };
}

export { toast };
