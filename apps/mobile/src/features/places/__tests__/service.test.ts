import { confirmationService, PlacePort } from '../service';
import { Capture } from '../../capture/types';
const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const item = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: uid,
} as Capture;
const candidate = {
  id: 'provider-id',
  name: 'Juniper Cafe',
  address: 'Lahore',
  lat: 31.5,
  lng: 74.3,
};
function setup() {
  const port: PlacePort = {
    ensure: jest.fn().mockResolvedValue('pending'),
    search: jest.fn().mockResolvedValue([candidate]),
    map: jest.fn(),
    confirm: jest.fn().mockResolvedValue(undefined),
  };
  return { port, service: confirmationService(port) };
}
test('manual matching needs an area and does not upload device location', async () => {
  const { port, service } = setup();
  await expect(service.search(item, 'Juniper Cafe', '', uid)).rejects.toThrow(
    'name and area',
  );
  await service.search(item, 'Juniper Cafe', 'Lahore', uid);
  expect(port.search).toHaveBeenCalledWith(
    item.id,
    'Juniper Cafe, Lahore',
    uid,
  );
});
test('confirmation validates coordinates and does not save before explicit invocation', async () => {
  const { port, service } = setup();
  await service.search(item, 'Juniper Cafe', 'Lahore', uid);
  expect(port.confirm).not.toHaveBeenCalled();
  await expect(
    service.confirm(
      {
        item,
        name: 'My cafe',
        area: 'Lahore',
        category: 'cafe',
        candidate: { ...candidate, lat: 100 },
      },
      uid,
    ),
  ).rejects.toThrow();
  expect(port.confirm).not.toHaveBeenCalled();
  await service.confirm(
    { item, name: 'My cafe', area: 'Lahore', category: 'cafe', candidate },
    uid,
  );
  expect(port.confirm).toHaveBeenCalledTimes(1);
});
