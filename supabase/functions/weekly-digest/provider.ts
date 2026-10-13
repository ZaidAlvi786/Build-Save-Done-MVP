import { z } from 'zod';
import { readLimited } from '../_shared/io.ts';
const ticket = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), id: z.string().min(1).max(200) }),
  z.object({
    status: z.literal('error'),
    details: z.object({ error: z.string() }).optional(),
  }),
]);
export type PushResult = {
  state: 'accepted' | 'failed' | 'unknown';
  ticketId: string | null;
  invalidToken: boolean;
};
export type ReceiptResult = {
  state: 'delivered' | 'receipt_error';
  invalidToken: boolean;
};
async function responseJson(response: Response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('push_unavailable');
  }
  return JSON.parse(
    new TextDecoder().decode(await readLimited(response.body, 128 * 1024)),
  );
}
export function expoPush(accessToken: string, transport: typeof fetch = fetch) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  return {
    async send(
      rows: { token: string; count: number; leaseId: string; owner: string }[],
    ): Promise<PushResult[]> {
      if (rows.length > 100) throw new Error('batch_too_large');
      const response = await transport('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(
          rows.map((row) => ({
            to: row.token,
            title: 'Saved → Done',
            body: `${row.count} saved ${row.count === 1 ? 'place' : 'places'} near you this weekend. Based on your last location check.`,
            data: { kind: 'digest', owner: row.owner, digestId: row.leaseId },
            channelId: 'saved-places',
          })),
        ),
        signal: AbortSignal.timeout(8000),
      });
      const parsed = z
        .object({ data: z.array(ticket) })
        .parse(await responseJson(response));
      if (parsed.data.length !== rows.length)
        throw new Error('ticket_mismatch');
      return parsed.data.map((item) =>
        item.status === 'ok'
          ? { state: 'accepted', ticketId: item.id, invalidToken: false }
          : {
              state: 'failed',
              ticketId: null,
              invalidToken: item.details?.error === 'DeviceNotRegistered',
            },
      );
    },
    async receipts(ids: string[]): Promise<Record<string, ReceiptResult>> {
      if (ids.length > 100) throw new Error('batch_too_large');
      const response = await transport(
        'https://exp.host/--/api/v2/push/getReceipts',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ ids }),
          signal: AbortSignal.timeout(8000),
        },
      );
      const parsed = z
        .object({
          data: z.record(
            z.discriminatedUnion('status', [
              z.object({ status: z.literal('ok') }),
              z.object({
                status: z.literal('error'),
                details: z.object({ error: z.string() }).optional(),
              }),
            ]),
          ),
        })
        .parse(await responseJson(response));
      return Object.fromEntries(
        Object.entries(parsed.data).map(([id, item]) => [
          id,
          {
            state: item.status === 'ok' ? 'delivered' : 'receipt_error',
            invalidToken:
              item.status === 'error' &&
              item.details?.error === 'DeviceNotRegistered',
          },
        ]),
      );
    },
  };
}
