import { render, screen, fireEvent } from '@testing-library/react-native';
import { CaptureScreen } from '../CaptureScreen';
import { SavedPlace } from '../../places/model';
jest.mock('../../places/SavedMap', () => ({ SavedMap: () => null }));
test('large saved list renders a window and category/navigation actions retain the selected place', async () => {
  const places: SavedPlace[] = Array.from({ length: 100 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    saved_item_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: `Place ${String(i).padStart(3, '0')}`,
    address: 'Area',
    category: i % 2 === 0 ? 'cafe' : 'shop',
    status: 'confirmed',
    lat: 31,
    lng: 74,
    coordinates_expire_at: '2099-01-01T00:00:00Z',
  }));
  const navigate = jest.fn(),
    noop = jest.fn();
  await render(
    <CaptureScreen
      uid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      items={[]}
      places={places}
      busy={false}
      error={null}
      near={null}
      onGallery={noop}
      onManual={noop}
      onOpen={noop}
      onRetry={noop}
      onRefresh={noop}
      onSettings={noop}
      onRetryShare={noop}
      onNearMe={noop}
      onNavigate={navigate}
      onVisit={noop}
      onDelete={noop}
      onRefreshPlace={noop}
      onReminders={noop}
    />,
  );
  expect(screen.getByText('Place 000')).toBeTruthy();
  expect(screen.queryByText('Place 099')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'cafe' }));
  expect(screen.queryByText('Place 001')).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: 'Navigate to Place 000' }),
  );
  expect(navigate).toHaveBeenCalledWith(places[0]);
});
