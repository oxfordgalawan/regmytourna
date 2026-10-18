import { toast as sonner } from "sonner";
import { showError } from "@/lib/ui/error-dialog";

/** App toast API — errors open a modal; other types use Sonner. */
export const toast = {
  success: sonner.success.bind(sonner),
  warning: sonner.warning.bind(sonner),
  info: sonner.info.bind(sonner),
  message: sonner.message.bind(sonner),
  promise: sonner.promise.bind(sonner),
  loading: sonner.loading.bind(sonner),
  dismiss: sonner.dismiss.bind(sonner),
  error: (message: unknown) => showError(typeof message === "string" ? message : String(message ?? "")),
};
