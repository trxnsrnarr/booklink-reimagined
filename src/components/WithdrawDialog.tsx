import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Coins, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestWithdrawal } from "@/lib/economy.functions";
import { SuccessAnimation } from "./SuccessAnimation";

const COIN_TO_IDR = 100;
const MIN_COIN = 500;

export function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

type Method = "dana" | "ovo" | "gopay" | "bank";

export function WithdrawDialog({
  open,
  onOpenChange,
  balance,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  balance: number;
}) {
  const qc = useQueryClient();
  const submit = useServerFn(requestWithdrawal);

  const [step, setStep] = useState<"form" | "success">("form");
  const [method, setMethod] = useState<Method>("dana");
  const [amount, setAmount] = useState<number>(MIN_COIN);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");

  useEffect(() => {
    if (open) {
      setStep("form");
    }
  }, [open]);

  const idr = useMemo(() => Math.max(0, amount) * COIN_TO_IDR, [amount]);
  const belowMin = amount < MIN_COIN;
  const overBalance = amount > balance;
  const missingFields = !accountName.trim() || !accountNumber.trim() || (method === "bank" && !bankName.trim());
  const canSubmit = !belowMin && !overBalance && !missingFields;

  const m = useMutation({
    mutationFn: () =>
      submit({
        data: {
          amount_coin: amount,
          method,
          account_info: {
            account_name: accountName.trim(),
            account_number: accountNumber.trim(),
            bank_name: method === "bank" ? bankName.trim() : undefined,
          },
        },
      }),
    onSuccess: (r) => {
      if (r.status === "requested") {
        qc.invalidateQueries({ queryKey: ["author-dashboard"] });
        setStep("success");
      } else if (r.status === "insufficient") toast.error("Saldo coin tidak cukup.");
      else if (r.status === "min_500_coin") toast.error(`Minimum withdraw ${MIN_COIN} coin.`);
      else toast.message(r.status);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const methods: { id: Method; label: string }[] = [
    { id: "dana", label: "DANA" },
    { id: "ovo", label: "OVO" },
    { id: "gopay", label: "GoPay" },
    { id: "bank", label: "Bank" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display text-xl">
                  <Wallet className="h-5 w-5 text-primary" />
                  Tarik dana
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Saldo: <span className="font-semibold text-foreground">{balance.toLocaleString("id-ID")} coin</span>
                  {" · "}1 coin = Rp100 · Minimum {MIN_COIN} coin
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Metode</Label>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {methods.map((mm) => (
                      <button
                        key={mm.id}
                        type="button"
                        onClick={() => setMethod(mm.id)}
                        className={`px-2 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                          method === mm.id
                            ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"
                            : "bg-muted/40 hover:bg-muted text-foreground/80"
                        }`}
                      >
                        {mm.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="w-name" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Nama pemilik {method === "bank" ? "rekening" : "akun"}
                  </Label>
                  <Input
                    id="w-name"
                    className="mt-1.5"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Nama lengkap"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="w-num" className="text-xs uppercase tracking-wider text-muted-foreground">
                      {method === "bank" ? "Nomor rekening" : "Nomor HP"}
                    </Label>
                    <Input
                      id="w-num"
                      className="mt-1.5"
                      inputMode="numeric"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder={method === "bank" ? "1234567890" : "0812xxxxxxx"}
                    />
                  </div>
                  {method === "bank" && (
                    <div>
                      <Label htmlFor="w-bank" className="text-xs uppercase tracking-wider text-muted-foreground">
                        Nama bank
                      </Label>
                      <Input
                        id="w-bank"
                        className="mt-1.5"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="BCA / Mandiri / BNI"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="w-amt" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Jumlah coin
                  </Label>
                  <div className="relative mt-1.5">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="w-amt"
                      type="number"
                      min={MIN_COIN}
                      step={100}
                      className="pl-9"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="mt-2 flex gap-1.5 flex-wrap">
                    {[500, 1000, 2500, 5000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAmount(v)}
                        disabled={v > balance}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {v.toLocaleString("id-ID")}
                      </button>
                    ))}
                    {balance >= MIN_COIN && (
                      <button
                        type="button"
                        onClick={() => setAmount(balance)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/15 hover:bg-primary/25 text-primary"
                      >
                        MAX
                      </button>
                    )}
                  </div>
                </div>

                <motion.div
                  key={idr}
                  initial={{ scale: 0.97, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4"
                >
                  <p className="text-xs text-muted-foreground">Total yang diterima</p>
                  <p className="mt-1 font-display text-3xl font-bold text-gradient-warm">{formatIDR(idr)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {amount.toLocaleString("id-ID")} coin × Rp100
                  </p>
                </motion.div>

                {belowMin && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Minimum withdraw {MIN_COIN} coin ({formatIDR(MIN_COIN * COIN_TO_IDR)}).
                  </p>
                )}
                {overBalance && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Saldo coin tidak cukup.
                  </p>
                )}

                <Button
                  className="w-full h-11 rounded-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow"
                  disabled={!canSubmit || m.isPending}
                  onClick={() => m.mutate()}
                >
                  {m.isPending ? "Memproses..." : (
                    <>
                      Ajukan withdraw <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Diproses admin dalam 1–3 hari kerja.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DialogHeader className="sr-only">
                <DialogTitle>Withdraw berhasil</DialogTitle>
              </DialogHeader>
              <SuccessAnimation
                title="Withdraw berhasil diajukan"
                subtitle={`${amount.toLocaleString("id-ID")} coin → ${formatIDR(idr)} · via ${method.toUpperCase()}`}
              />
              <Button
                className="w-full h-11 rounded-full"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Selesai
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
