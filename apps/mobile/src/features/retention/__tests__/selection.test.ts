import { digestPlaceIds } from '../selection';
import { SavedPlace } from '../../places/model';
const place: SavedPlace = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  saved_item_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Cafe',
  address: 'Area',
  category: 'cafe',
  lat: 0,
  lng: 0,
  status: 'confirmed',
  coordinates_expire_at: '2099-01-01T00:00:00Z',
};
test('digest selects unique nearby unvisited IDs without transmitting device coordinates', () => {
  expect(
    digestPlaceIds(
      [
        place,
        place,
        { ...place, id: 'visited', status: 'visited' },
        { ...place, id: 'far', lat: 50 },
        { ...place, id: 'expired', coordinates_expire_at: '2000-01-01' },
        { ...place, id: 'missing', lat: null },
      ],
      { latitude: 0, longitude: 0 },
    ),
  ).toEqual([place.id]);
});
