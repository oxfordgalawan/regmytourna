export type PayoutMethodType = "gcash" | "maya" | "bank" | "other";

export type PayoutMethodSnapshot = {
  label: string;
  method_type: PayoutMethodType;
  account_name: string;
  account_number: string;
  bank_name?: string | null;
  notes?: string | null;
};

export const PH_BANKS = [
  "BDO Unibank",
  "BPI",
  "Metrobank",
  "Landbank",
  "PNB",
  "Security Bank",
  "UnionBank",
  "RCBC",
  "China Bank",
  "EastWest Bank",
  "AUB",
  "PSBank",
  "Robinsons Bank",
  "GoTyme",
  "Maribank",
  "Other",
] as const;

export type PhilippineBank = (typeof PH_BANKS)[number];

export const PAYOUT_METHOD_TYPES: {
  value: PayoutMethodType;
  label: string;
  numberLabel: string;
  placeholder: string;
  hint: string;
  requiresBank: boolean;
  digits?: number;
  minDigits?: number;
  maxDigits?: number;
}[] = [
  {
    value: "gcash",
    label: "GCash",
    numberLabel: "Mobile number",
    placeholder: "09XX XXX XXXX",
    hint: "11-digit Philippine mobile number starting with 09",
    requiresBank: false,
    digits: 11,
  },
  {
    value: "maya",
    label: "Maya",
    numberLabel: "Mobile number",
    placeholder: "09XX XXX XXXX",
    hint: "11-digit Philippine mobile number starting with 09",
    requiresBank: false,
    digits: 11,
  },
  {
    value: "bank",
    label: "Bank account",
    numberLabel: "Account number",
    placeholder: "Enter account number",
    hint: "10–12 digit account number",
    requiresBank: true,
    minDigits: 10,
    maxDigits: 12,
  },
  {
    value: "other",
    label: "Other",
    numberLabel: "Account / reference",
    placeholder: "Account or payment details",
    hint: "Describe how you want to receive funds",
    requiresBank: false,
  },
];

export function getPayoutMethodConfig(type: string) {
  return PAYOUT_METHOD_TYPES.find((t) => t.value === type);
}

export function stripAccountNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeAccountNumber(methodType: PayoutMethodType, raw: string): string {
  const config = getPayoutMethodConfig(methodType);
  if (!config) return raw.trim();
  if (methodType === "other") return raw.trim();
  if (methodType === "bank") return stripAccountNumber(raw);
  return stripAccountNumber(raw);
}

export function validatePayoutMethod(data: {
  methodType: PayoutMethodType;
  accountNumber: string;
  bankName?: string;
}): string | null {
  const config = getPayoutMethodConfig(data.methodType);
  if (!config) return "Invalid payout method type";

  if (config.requiresBank && !data.bankName?.trim()) {
    return "Bank name is required";
  }

  if (data.methodType === "other") {
    if (!data.accountNumber.trim()) return "Account or reference is required";
    return null;
  }

  const digits = stripAccountNumber(data.accountNumber);

  if (config.digits !== undefined) {
    if (digits.length !== config.digits) {
      return `${config.numberLabel} must be exactly ${config.digits} digits`;
    }
    if (!digits.startsWith("09")) {
      return "Philippine mobile numbers must start with 09";
    }
    return null;
  }

  const min = config.minDigits ?? 10;
  const max = config.maxDigits ?? 12;
  if (digits.length < min || digits.length > max) {
    return `${config.numberLabel} must be ${min}–${max} digits`;
  }

  return null;
}

export function maskAccountNumber(methodType: PayoutMethodType, accountNumber: string): string {
  if (methodType === "other") {
    const s = accountNumber.trim();
    if (s.length <= 4) return s;
    return `•••• ${s.slice(-4)}`;
  }
  const digits = stripAccountNumber(accountNumber);
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

export function methodTypeLabel(type: PayoutMethodType | string): string {
  return getPayoutMethodConfig(type)?.label ?? String(type);
}
