"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ViewPage() {
  const [valid, setValid] = useState(false);
  const params = useParams<{ id: string }>();

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/share?id=${params.id}`)
      .then((res) => res.json())
      .then((data) => setValid(Boolean(data.valid)));
  }, [params?.id]);

  if (!valid) return <div className="p-6">❌ Invalid or expired link</div>;

  return <iframe src="/api/report" className="w-full h-screen" />;
}


