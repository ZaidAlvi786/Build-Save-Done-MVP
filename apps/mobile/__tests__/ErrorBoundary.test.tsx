import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../src/lib/ErrorBoundary';
import { reportRenderFailure } from '../src/lib/diagnostics';
jest.mock('../src/lib/diagnostics', () => ({
  reportRenderFailure: jest.fn().mockResolvedValue(undefined),
}));
test('render failure is recoverable without revealing error contents or deleting saves', async () => {
  let fail = true;
  function Child() {
    if (fail) throw new Error('private screenshot location');
    return <Text>Saves restored</Text>;
  }
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    await render(
      <ErrorBoundary>
        <Child />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Let’s reopen your saves.')).toBeTruthy();
    expect(screen.queryByText('private screenshot location')).toBeNull();
    expect(reportRenderFailure).toHaveBeenCalled();
    fail = false;
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Saves restored')).toBeTruthy();
  } finally {
    log.mockRestore();
  }
});
