"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ViewPage() {
  const [valid, setValid] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const params = useParams<{ id: string }>();

  async function validate(pw?: string) {
    if (!params?.id) return;
    const url = `/api/share?token=${params.id}${pw ? `&password=${encodeURIComponent(pw)}` : ""}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.valid) {
      setValid(true);
      setNeedsPassword(false);
      const q = data.portfolioId ? `?portfolioId=${data.portfolioId}` : "";
      const iframe = document.querySelector("iframe#report-frame") as HTMLIFrameElement | null;
      if (iframe) iframe.src = `/api/report${q}`;
    } else if (res.status === 401) {
      setNeedsPassword(true);
      setValid(false);
    } else {
      setValid(false);
      setNeedsPassword(false);
    }
  }

  useEffect(() => {
    validate();
  }, [params?.id]);

  if (!valid && needsPassword) {
    return (
      <div className="p-6 max-w-md mx-auto flex gap-2">
        <Input
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button onClick={() => validate(password)}>Unlock</Button>
      </div>
    );
  }

  if (!valid) return <div className="p-6">❌ Invalid or expired link</div>;

  return <iframe id="report-frame" src="/api/report" className="w-full h-screen" />;
}


