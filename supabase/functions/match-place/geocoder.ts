import { z } from 'zod';
import { readLimited } from '../_shared/io.ts';
export const candidateSchema = z
  .object({
    id: z.string().min(1).max(300),
    name: z.string().min(1).max(200),
    address: z.string().max(500),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();
export type Candidate = z.infer<typeof candidateSchema>;
export interface Geocoder {
  search(query: string): Promise<Candidate[]>;
}
const googleResponse = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }),
        formattedAddress: z.string().optional(),
        location: z.object({ latitude: z.number(), longitude: z.number() }),
      }),
    )
    .max(5)
    .default([]),
});
export function googleGeocoder(
  key: string,
  transport: typeof fetch = fetch,
): Geocoder {
  return {
    async search(query) {
      const response = await transport(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location',
          },
          body: JSON.stringify({
            textQuery: query,
            pageSize: 5,
            includePureServiceAreaBusinesses: false,
          }),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error('geocoding_unavailable');
      }
      const data = googleResponse.parse(
        JSON.parse(
          new TextDecoder().decode(await readLimited(response.body, 32768)),
        ),
      );
      return data.places.map((p) =>
        candidateSchema.parse({
          id: p.id,
          name: p.displayName.text,
          address: p.formattedAddress ?? '',
          lat: p.location.latitude,
          lng: p.location.longitude,
        }),
      );
    },
  };
}
