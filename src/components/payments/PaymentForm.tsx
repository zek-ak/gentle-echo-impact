import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X, Loader2, Phone } from "lucide-react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

type PaymentType = "mobile_money" | "bank_transfer";

const mobileMoneyMethods = [
  { id: "mpesa", name: "M-Pesa" },
  { id: "tigopesa", name: "Tigo Pesa" },
  { id: "airtel", name: "Airtel Money" },
  { id: "halopesa", name: "HaloPesa" },
];

const bankMethods = [
  { id: "crdb", name: "CRDB Bank", acc: "02XXXXXXXXXXXX" },
  { id: "nmb", name: "NMB Bank", acc: "XXXXXXXXXX" },
  { id: "nbc", name: "NBC Bank", acc: "XXXXXXXXXXXX" },
];

const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
};

const formatCurrency = (amt: number): string => amt.toLocaleString("en-TZ");

interface PaymentFormProps {
  userId?: string | null;
  /** Demo mode: skip ClickPesa call (used by guest dashboard preview) */
  isSimulated?: boolean;
}

const PaymentForm = ({ userId = null, isSimulated = false }: PaymentFormProps) => {
  const [paymentType, setPaymentType] = useState<PaymentType>("mobile_money");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedMobileMethod, setSelectedMobileMethod] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");

  const [paymentState, setPaymentState] = useState<"form" | "sending" | "pending" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [successSummary, setSuccessSummary] = useState<{ amount: number; type: PaymentType; method?: string | null } | null>(null);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value.replace(/[^0-9]/g, ""));
  }, []);

  const pollStatus = async (orderReference: string, maxAttempts = 60): Promise<string> => {
    const supabase = createSupabaseClient(getSession()?.access_token);
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const { data, error } = await supabase.functions.invoke("clickpesa-status", {
          body: { orderReference },
        });
        if (error) continue;
        const s = (data as any)?.status;
        if (s === "success") return "success";
        if (s === "failed" || s === "reversed") return s;
      } catch {
        // continue polling
      }
    }
    return "timeout";
  };

  const reset = () => {
    setPaymentState("form");
    setPhone("");
    setReference("");
    setAmount("");
    setSelectedMobileMethod(null);
    setSelectedBank(null);
    setAccountNumber("");
    setErrorMsg("");
    setSuccessSummary(null);
  };

  const handleSubmit = async () => {
    const numericAmount = parseInt(amount, 10);
    if (!numericAmount || numericAmount < 500 || numericAmount > 10_000_000) {
      toast.error("Enter a valid amount (TZS 500 – 10,000,000)");
      return;
    }

    // Bank transfer: just display info
    if (paymentType === "bank_transfer") {
      if (!selectedBank) {
        toast.error("Please select a bank");
        return;
      }
      setSuccessSummary({ amount: numericAmount, type: "bank_transfer", method: selectedBank });
      setPaymentState("success");
      return;
    }

    // Mobile money
    const cleanPhone = phone.replace(/\s/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (!selectedMobileMethod) {
      toast.error("Select a mobile money provider");
      return;
    }

    setPaymentState("sending");
    setErrorMsg("");

    // Demo mode
    if (isSimulated) {
      await new Promise((r) => setTimeout(r, 1500));
      setSuccessSummary({ amount: numericAmount, type: "mobile_money", method: selectedMobileMethod });
      setPaymentState("success");
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#d4a017", "#2d8a56", "#7c3aed"] });
      toast.success("Contribution recorded! (Demo)");
      return;
    }

    try {
      const supabase = createSupabaseClient(getSession()?.access_token);
      const { data, error } = await supabase.functions.invoke("clickpesa-initiate", {
        body: {
          amount: numericAmount,
          phone: cleanPhone,
          userId: userId ?? null,
          reference: reference || null,
        },
      });

      if (error || !(data as any)?.success) {
        const msg = (data as any)?.error || error?.message || "Failed to start payment";
        setPaymentState("error");
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      const orderReference = (data as any).orderReference;
      setPaymentState("pending");
      toast.success("Check your phone and enter PIN to confirm");

      const finalStatus = await pollStatus(orderReference);
      if (finalStatus === "success") {
        setSuccessSummary({ amount: numericAmount, type: "mobile_money", method: selectedMobileMethod });
        setPaymentState("success");
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#d4a017", "#2d8a56", "#7c3aed"] });
        toast.success("Contribution received!");
      } else if (finalStatus === "timeout") {
        setPaymentState("error");
        setErrorMsg("We didn't receive a confirmation in time. Please check shortly.");
      } else {
        setPaymentState("error");
        setErrorMsg(`Payment ${finalStatus}. Please try again.`);
      }
    } catch (err: any) {
      setPaymentState("error");
      setErrorMsg(err?.message || "Unexpected error");
    }
  };

  // SUCCESS
  if (paymentState === "success" && successSummary) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-display text-white mb-2">
          {successSummary.type === "mobile_money" ? "Contribution Initiated!" : "Bank Transfer Details"}
        </h2>
        <p className="text-xs text-white/70 mb-4">
          {successSummary.type === "mobile_money"
            ? "Confirm on your phone to complete the payment."
            : "Use the bank details to complete your transfer."}
        </p>
        <div className="bg-white/10 rounded-xl p-3 mb-4 text-left border border-white/10">
          <div className="flex justify-between py-1.5 text-xs">
            <span className="text-white/60">Amount</span>
            <span className="font-semibold text-gold-light">TZS {formatCurrency(successSummary.amount)}</span>
          </div>
        </div>
        <button onClick={reset} className="w-full py-2.5 rounded-xl gradient-gold text-white font-semibold text-sm shadow-lg">
          Make Another Contribution
        </button>
      </motion.div>
    );
  }

  // ERROR
  if (paymentState === "error") {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/30 flex items-center justify-center">
          <X className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-display text-white mb-2">Payment Failed</h2>
        <p className="text-xs text-white/70 mb-4 break-words">{errorMsg}</p>
        <button onClick={() => setPaymentState("form")} className="w-full py-2.5 rounded-xl gradient-gold text-white font-semibold text-sm shadow-lg">
          Try Again
        </button>
      </div>
    );
  }

  // PROCESSING STATES (still show form below but with banner)
  return (
    <div className="space-y-3">
      {paymentState === "sending" && (
        <div className="bg-white/10 rounded-xl p-3 border border-white/10 text-center">
          <Loader2 className="w-6 h-6 mx-auto mb-2 text-gold animate-spin" />
          <p className="text-white text-sm">Sending payment request...</p>
        </div>
      )}
      {paymentState === "pending" && (
        <div className="bg-white/10 rounded-xl p-3 border border-gold/30 text-center">
          <Phone className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
          <p className="text-white text-sm font-medium">Check your phone</p>
          <p className="text-white/60 text-xs">Enter PIN to confirm</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl bg-white/10 p-1 border border-white/10">
        <button
          type="button"
          onClick={() => setPaymentType("mobile_money")}
          disabled={paymentState !== "form"}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all",
            paymentType === "mobile_money" ? "bg-white text-primary shadow-md" : "text-white/70 hover:text-white"
          )}
        >
          Mobile Money
        </button>
        <button
          type="button"
          onClick={() => setPaymentType("bank_transfer")}
          disabled={paymentState !== "form"}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all",
            paymentType === "bank_transfer" ? "bg-white text-primary shadow-md" : "text-white/70 hover:text-white"
          )}
        >
          Bank Transfer
        </button>
      </div>

      <AnimatePresence mode="wait">
        {paymentType === "mobile_money" ? (
          <motion.div
            key="mm"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="2557XXXXXXXX"
                disabled={paymentState !== "form"}
                className="w-full h-10 sm:h-11 mt-1 px-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
                maxLength={16}
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">
                Reference <span className="text-white/40 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g., Tithe, Offering"
                disabled={paymentState !== "form"}
                maxLength={100}
                className="w-full h-10 sm:h-11 mt-1 px-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">Provider</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {mobileMoneyMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMobileMethod(m.id)}
                    disabled={paymentState !== "form"}
                    className={cn(
                      "relative p-2 rounded-lg border-2 transition-all text-center",
                      selectedMobileMethod === m.id
                        ? "border-gold bg-gold/10"
                        : "border-white/20 bg-white/5 hover:border-white/40"
                    )}
                  >
                    <span className="font-medium text-white text-xs">{m.name}</span>
                    {selectedMobileMethod === m.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gold flex items-center justify-center">
                        <CheckCircle2 className="w-2.5 h-2.5 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="bank"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">Select Bank</label>
              <div className="grid grid-cols-1 gap-2 mt-1">
                {bankMethods.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBank(b.id)}
                    disabled={paymentState !== "form"}
                    className={cn(
                      "relative p-3 rounded-lg border-2 transition-all text-left",
                      selectedBank === b.id
                        ? "border-gold bg-gold/10"
                        : "border-white/20 bg-white/5 hover:border-white/40"
                    )}
                  >
                    <span className="font-semibold text-white text-sm block">{b.name}</span>
                    <span className="text-xs text-white/50">Acc: {b.acc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-white">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Your account number"
                disabled={paymentState !== "form"}
                maxLength={50}
                className="w-full h-10 sm:h-11 mt-1 px-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Amount */}
      <div>
        <label className="text-xs sm:text-sm font-semibold text-white">Amount (TZS)</label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">TZS</span>
          <input
            type="text"
            value={amount ? formatCurrency(parseInt(amount, 10) || 0) : ""}
            onChange={handleAmountChange}
            placeholder="500"
            disabled={paymentState !== "form"}
            className="w-full h-10 sm:h-11 pl-12 pr-3 rounded-xl border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold disabled:opacity-60"
            inputMode="numeric"
          />
        </div>
        <p className="text-xs text-white/50 mt-1">Min TZS 500</p>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={paymentState !== "form"}
        className={cn(
          "w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
          paymentState !== "form"
            ? "bg-white/20 text-white/50 cursor-not-allowed"
            : "gradient-gold text-primary-foreground shadow-lg"
        )}
      >
        {paymentState === "sending" || paymentState === "pending" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Contribute Now"
        )}
      </button>
    </div>
  );
};

export default PaymentForm;
