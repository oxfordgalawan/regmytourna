"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { RegistrationAuthPanel } from "@/components/auth/registration-auth-panel";

export function RegistrationAuthDialog({
  open,
  onOpenChange,
  initialTab = "login",
  onAuthenticated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "login" | "signup";
  onAuthenticated?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,42rem)] w-[calc(100%-1.5rem)] overflow-y-auto border border-umber bg-espresso sm:max-w-md">
        <DialogTitle className="sr-only">Log in or create an account</DialogTitle>
        <DialogDescription className="sr-only">Sign in to continue registration</DialogDescription>
        <RegistrationAuthPanel
          key={open ? initialTab : "closed"}
          defaultTab={initialTab}
          onAuthenticated={() => {
            onOpenChange(false);
            onAuthenticated?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}