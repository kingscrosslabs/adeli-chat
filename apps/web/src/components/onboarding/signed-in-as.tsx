import { LogOut } from "lucide-react";

import { Button } from "@adeli-chat/ui/components/button";
import { signOut } from "@/lib/actions";
import type { CurrentUser } from "@/lib/auth/session";

/** Who is setting up, with a way out (for example, to switch Google accounts). */
export function SignedInAs({ user }: { user: CurrentUser }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="min-w-0 truncate">Signed in as <span className="font-medium text-foreground">{user.email}</span></span>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm"><LogOut /> Sign out</Button>
      </form>
    </div>
  );
}
