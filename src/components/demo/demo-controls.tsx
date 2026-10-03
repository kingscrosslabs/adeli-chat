"use client";

import { FlaskConical, KeyRound, RotateCcw, ServerCog, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MOCK_ACCOUNTS, MOCK_PROFILE } from "@/lib/adeli/mock";
import { actions, useDemoState } from "@/lib/demo/store";

/**
 * Review helper for the frontend-only build: jump between app states without
 * clicking through every flow. Not part of the product. Delete with the mock
 * store when the backend lands.
 */
export function DemoControls() {
  const router = useRouter();
  const state = useDemoState();
  if (!state) return null;
  const key = state.adeliKey;

  return (
    <div className="fixed right-4 bottom-4 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="rounded-full bg-card shadow-md" />}>
          <FlaskConical /> Demo
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-64">
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Frontend preview. Data lives in this browser only.</p>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { actions.loadSamples(MOCK_ACCOUNTS[0], MOCK_PROFILE); router.push("/automations"); toast.success("Sample data loaded"); }}>
            <Sparkles /> Load sample automations
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { actions.resetFresh(); router.push("/login"); }}>
            <RotateCcw /> Start over as a new install
          </DropdownMenuItem>
          {key ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { actions.markKeyChecked(key.status === "valid" ? "invalid" : "valid"); toast(key.status === "valid" ? "Simulating a revoked key" : "Key working again"); }}>
                <KeyRound /> {key.status === "valid" ? "Simulate revoked Adeli key" : "Restore Adeli key"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.setKeySource(key.source === "env" ? "ui" : "env")}>
                <ServerCog /> {key.source === "env" ? "Key saved in the app" : "Key set by ADELI_API_KEY"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
