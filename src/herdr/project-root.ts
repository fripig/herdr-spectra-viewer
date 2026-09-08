import type { HerdrClient } from "./client.js";
import { paneCwd } from "./client.js";
import type { InvocationContext } from "./context.js";

/** Context JSON cwd → invoking pane cwd → process cwd. */
export async function resolveProjectRoot(context: InvocationContext, client: HerdrClient): Promise<string> {
  if (context.projectRootFromContext) return context.projectRoot;
  if (context.paneId && context.herdrBin) {
    const cwd = await paneCwd(client, context.paneId);
    if (cwd) return cwd;
  }
  return context.projectRoot;
}
