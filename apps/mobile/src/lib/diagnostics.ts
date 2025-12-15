import * as Crypto from 'expo-crypto';
import { diagnosticSchema, Diagnostic } from '../../../../shared/diagnostics';
import { diagnosticsEnabled } from '../features/analytics/client';
import { requireUser, supabase } from './supabase';
const recent = new Map<string, number>();
export async function reportIssue(
  uid: string | null,
  code: Diagnostic['code'],
) {
  try {
    if (!uid || !(await diagnosticsEnabled(uid))) return;
    const key = `${uid}:${code}`,
      now = Date.now();
    if (now - (recent.get(key) ?? 0) < 60000) return;
    recent.set(key, now);
    if (recent.size > 100) recent.delete(recent.keys().next().value!);
    const client = await requireUser(uid);
    await client.functions.invoke('report-error', {
      body: diagnosticSchema.parse({
        id: Crypto.randomUUID(),
        code,
        release: '0.1.0',
      }),
    });
  } catch {
    /* Reporting must never interrupt recovery. */
  }
}
export async function reportRenderFailure() {
  try {
    const uid =
      (await supabase?.auth.getSession())?.data.session?.user.id ?? null;
    await reportIssue(uid, 'render');
  } catch {
    /* No unhandled rejection from the boundary. */
  }
}
