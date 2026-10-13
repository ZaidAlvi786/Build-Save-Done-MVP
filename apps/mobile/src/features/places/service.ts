import { z } from 'zod';
import { Capture, Category } from '../capture/types';
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
export type ConfirmInput = {
  item: Capture;
  name: string;
  area: string;
  category: Category;
  candidate: Candidate;
};
export interface PlacePort {
  ensure(item: Capture, userId: string): Promise<unknown>;
  search(itemId: string, query: string, userId: string): Promise<Candidate[]>;
  map(itemId: string, candidate: Candidate, userId: string): Promise<string>;
  confirm(input: ConfirmInput, userId: string): Promise<void>;
}
export function confirmationService(port: PlacePort) {
  return {
    async search(item: Capture, name: string, area: string, uid: string) {
      if (item.ownerId && item.ownerId !== uid)
        throw new Error('Wrong account');
      if (!name.trim() || !area.trim())
        throw new Error('Enter a name and area');
      await port.ensure(item, uid);
      return port.search(item.id, `${name.trim()}, ${area.trim()}`, uid);
    },
    async confirm(input: ConfirmInput, uid: string) {
      if (input.item.ownerId && input.item.ownerId !== uid)
        throw new Error('Wrong account');
      if (
        !input.name.trim() ||
        input.name.trim().length > 200 ||
        input.area.trim().length > 500
      )
        throw new Error('Invalid place');
      candidateSchema.parse(input.candidate);
      await port.ensure(input.item, uid);
      await port.confirm(input, uid);
    },
  };
}
