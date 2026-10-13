import { json } from '../_shared/http.ts';
import { PushResult, ReceiptResult } from './provider.ts';
export type DigestClaim = {
  user_id: string;
  token: string;
  lease_id: string;
  place_count: number;
};
export type Receipt = {
  user_id: string;
  lease_id: string;
  ticket_id: string;
  expired: boolean;
};
export interface DigestDependencies {
  authorize: (token: string) => Promise<boolean>;
  claim: () => Promise<DigestClaim[]>;
  allowed: (row: DigestClaim) => Promise<boolean>;
  pending: () => Promise<Receipt[]>;
  finish: (
    uid: string,
    lease: string,
    state: PushResult['state'] | ReceiptResult['state'],
    ticket: string | null,
    invalid: boolean,
  ) => Promise<void>;
  send: (rows: DigestClaim[]) => Promise<PushResult[]>;
  receipts: (ids: string[]) => Promise<Record<string, ReceiptResult>>;
}
export async function cronAuthorization(expected: string, actual: string) {
  if (expected.length < 32 || actual.length > 256) return false;
  const encode = new TextEncoder();
  const a = new Uint8Array(
      await crypto.subtle.digest('SHA-256', encode.encode(expected)),
    ),
    b = new Uint8Array(
      await crypto.subtle.digest('SHA-256', encode.encode(actual)),
    );
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}
export function createDigestHandler(deps: DigestDependencies) {
  return async (request: Request) => {
    if (request.method !== 'POST')
      return json(405, { error: 'method_not_allowed' });
    const token =
      /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1] ??
      '';
    try {
      if (!(await deps.authorize(token)))
        return json(401, { error: 'unauthorized' });
      let receiptErrors = 0;
      try {
        const pending = await deps.pending();
        if (pending.length) {
          const results = await deps.receipts(pending.map((r) => r.ticket_id));
          for (const row of pending) {
            const result = results[row.ticket_id];
            try {
              if (result)
                await deps.finish(
                  row.user_id,
                  row.lease_id,
                  result.state,
                  null,
                  result.invalidToken,
                );
              else if (row.expired)
                await deps.finish(
                  row.user_id,
                  row.lease_id,
                  'receipt_error',
                  null,
                  false,
                );
            } catch {
              receiptErrors++;
            }
          }
        }
      } catch {
        receiptErrors++;
      }
      const claimed = await deps.claim(),
        eligible: DigestClaim[] = [];
      for (const row of claimed) {
        if (await deps.allowed(row)) eligible.push(row);
        else
          await deps.finish(row.user_id, row.lease_id, 'failed', null, false);
      }
      let results: PushResult[] = [];
      try {
        if (eligible.length) {
          results = await deps.send(eligible);
          if (results.length !== eligible.length) throw new Error('mismatch');
        }
      } catch {
        for (const row of eligible)
          try {
            await deps.finish(
              row.user_id,
              row.lease_id,
              'unknown',
              null,
              false,
            );
          } catch {
            receiptErrors++;
          }
        return json(503, {
          error: 'digest_delivery_uncertain',
          claimed: claimed.length,
        });
      }
      let accepted = 0;
      for (let i = 0; i < eligible.length; i++) {
        const row = eligible[i]!,
          result = results[i]!;
        if (result.state === 'accepted') accepted++;
        try {
          await deps.finish(
            row.user_id,
            row.lease_id,
            result.state,
            result.ticketId,
            result.invalidToken,
          );
        } catch {
          receiptErrors++;
        }
      }
      return json(200, {
        claimed: claimed.length,
        accepted,
        receipt_errors: receiptErrors,
      });
    } catch {
      return json(503, { error: 'digest_unavailable' });
    }
  };
}
