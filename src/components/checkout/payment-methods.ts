import { QrCode, Smartphone, Wallet, CreditCard, Building2, type LucideIcon } from "lucide-react";

export type PaymentMethodKey = "qris" | "gopay" | "shopeepay" | "dana" | "va" | "credit_card";

export interface PaymentMethod {
  key: PaymentMethodKey;
  label: string;
  description: string;
  Icon: LucideIcon;
  badge?: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { key: "qris",        label: "QRIS",          description: "Scan dari semua e-wallet & m-banking", Icon: QrCode,     badge: "Populer" },
  { key: "gopay",       label: "GoPay",         description: "Bayar pakai saldo GoPay",              Icon: Smartphone },
  { key: "shopeepay",   label: "ShopeePay",     description: "Bayar pakai saldo ShopeePay",          Icon: Smartphone },
  { key: "dana",        label: "DANA",          description: "Bayar pakai saldo DANA",               Icon: Wallet },
  { key: "va",          label: "Virtual Account", description: "BCA · BNI · BRI · Permata · lainnya", Icon: Building2 },
  { key: "credit_card", label: "Kartu Kredit",  description: "Visa · Mastercard · JCB",              Icon: CreditCard },
];