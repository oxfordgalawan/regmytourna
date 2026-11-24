"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type RegisterFeeContextValue = {
  feeCents: number;
  currency: string;
  setFeeCents: (cents: number) => void;
};

const RegisterFeeContext = createContext<RegisterFeeContextValue | null>(null);

export function RegisterFeeProvider({
  initialFeeCents,
  currency,
  children,
}: {
  initialFeeCents: number;
  currency: string;
  children: ReactNode;
}) {
  const [feeCents, setFeeCents] = useState(initialFeeCents);

  return (
    <RegisterFeeContext.Provider value={{ feeCents, currency, setFeeCents }}>{children}</RegisterFeeContext.Provider>
  );
}

/** Keeps the mobile bar in sync with the sidebar "Total due" amount. */
export function useSyncRegisterFee(dueCents: number) {
  const ctx = useContext(RegisterFeeContext);
  useEffect(() => {
    ctx?.setFeeCents(dueCents);
  }, [ctx, dueCents]);
}

export function useRegisterFeeDisplay() {
  const ctx = useContext(RegisterFeeContext);
  if (!ctx) {
    return { feeCents: 0, currency: "PHP", signedInSync: false };
  }
  return { feeCents: ctx.feeCents, currency: ctx.currency, signedInSync: true };
}