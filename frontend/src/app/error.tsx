"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";
import { StatePlaceholder } from "@/components/StatePlaceholder";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatePlaceholder
      kind="error"
      title="页面出错了"
      description="可以重试一次；如果仍然出错，请刷新页面。"
      action={<Button onClick={() => retry()}>重试</Button>}
      className="mx-auto mt-16 max-w-lg"
    />
  );
}
