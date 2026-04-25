import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { signIn, sendOtp, verifyOtp, normalizePhone } from "@/lib/auth";
import { Phone, Shield, User, Loader2 } from "lucide-react";

type SignupStep = "phone" | "otp";

const Auth = () => {
  const [signupStep, setSignupStep] = useState<SignupStep>("phone");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignIn = async () => {
    if (!phone.trim()) {
      toast({ title: "Kosa", description: "Tafadhali ingiza namba ya simu", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await signIn(phone);
      toast({ title: "Umefanikiwa!", description: "Umeingia kikamilifu" });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Kosa", description: err?.message || "Imeshindwa kuingia", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      toast({ title: "Kosa", description: "Tafadhali ingiza namba ya simu", variant: "destructive" });
      return;
    }
    if (!fullName.trim()) {
      toast({ title: "Kosa", description: "Tafadhali ingiza jina lako kamili", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await sendOtp(phone, fullName);
      setSignupStep("otp");
      toast({ title: "OTP Imetumwa", description: `OTP imetumwa kwa ${normalizePhone(phone)}` });
    } catch (err: any) {
      toast({ title: "Kosa", description: err?.message || "Imeshindwa kutuma OTP", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      toast({ title: "Kosa", description: "Tafadhali ingiza OTP yenye tarakimu 6", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(phone, otp, fullName);
      toast({ title: "Umefanikiwa!", description: "Umesajiliwa kikamilifu" });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Kosa", description: err?.message || "OTP si sahihi au imekwisha muda", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetSignup = () => {
    setSignupStep("phone");
    setOtp("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Karibu</CardTitle>
          <CardDescription className="text-muted-foreground">
            {mode === "signin"
              ? "Ingiza namba yako ya simu kuingia"
              : signupStep === "phone"
              ? "Jisajili kwa namba yako ya simu"
              : "Ingiza OTP uliyotumwa kwenye simu yako"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as "signin" | "signup");
              resetSignup();
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Ingia</TabsTrigger>
              <TabsTrigger value="signup">Jisajili</TabsTrigger>
            </TabsList>

            {/* SIGN IN - Phone only */}
            <TabsContent value="signin" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Namba ya Simu</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="0712345678 au 255712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              <Button onClick={handleSignIn} className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ingia
              </Button>
            </TabsContent>

            {/* SIGN UP - Phone + OTP */}
            <TabsContent value="signup" className="space-y-4">
              {signupStep === "phone" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Jina Kamili</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Jina lako kamili"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Namba ya Simu</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="0712345678 au 255712345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <Button onClick={handleSendOtp} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Tuma OTP
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Namba ya OTP</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Ingiza OTP yenye tarakimu 6"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      OTP imetumwa kwa {normalizePhone(phone)}
                    </p>
                  </div>
                  <Button onClick={handleVerifyOtp} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Thibitisha OTP
                  </Button>
                  <Button variant="ghost" onClick={resetSignup} className="w-full" disabled={loading}>
                    Rudi nyuma
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
