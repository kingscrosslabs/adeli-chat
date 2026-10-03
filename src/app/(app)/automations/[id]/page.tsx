"use client";

import Link from "next/link";
import { use, Suspense } from "react";

import { AutomationEditor } from "@/components/editor/automation-editor";
import { FullPageLoader, Guard } from "@/components/guard";
import { buttonVariants } from "@/components/ui/button";
import { useDemoState } from "@/lib/demo/store";

export default function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Guard require="ready">
      <Suspense fallback={<FullPageLoader />}>
        <EditorLoader id={id} />
      </Suspense>
    </Guard>
  );
}

function EditorLoader({ id }: { id: string }) {
  const state = useDemoState();
  const automation = state?.automations.find((item) => item.id === id);
  if (!automation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-lg font-semibold">This automation doesn&apos;t exist</h1>
        <p className="text-sm text-muted-foreground">It may have been deleted.</p>
        <Link href="/automations" className={buttonVariants({ variant: "outline" })}>Back to automations</Link>
      </div>
    );
  }
  // Keyed by id so switching automations resets the draft.
  return <AutomationEditor key={automation.id} automation={automation} />;
}
