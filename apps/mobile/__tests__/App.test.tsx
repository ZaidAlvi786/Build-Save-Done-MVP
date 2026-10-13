import { render, screen, fireEvent } from '@testing-library/react-native';
import { AuthScreen } from '../src/features/auth/AuthScreen';
import { useAuth } from '../src/features/auth/useAuth';
jest.mock('../src/features/auth/useAuth', () => ({ useAuth: jest.fn() }));
test('email sign-in screen communicates retained shares and dispatches code request', async () => {
  const send = jest.fn().mockResolvedValue(undefined);
  const auth = {
    session: null,
    ready: true,
    busy: false,
    error: null,
    sentTo: null,
    configured: true,
    send,
    verify: jest.fn(),
    signOut: jest.fn(),
  } as ReturnType<typeof useAuth>;
  await render(<AuthScreen auth={auth} pendingCount={1} />);
  expect(screen.getByText('1 save is kept on this phone')).toBeTruthy();
  fireEvent.changeText(
    screen.getByLabelText('Email address'),
    'person@example.com',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
  expect(send).toHaveBeenCalledWith('person@example.com');
});
test('missing backend has a graceful sign-in state', async () => {
  const auth = {
    session: null,
    ready: true,
    busy: false,
    error: null,
    sentTo: null,
    configured: false,
    send: jest.fn(),
    verify: jest.fn(),
    signOut: jest.fn(),
  } as ReturnType<typeof useAuth>;
  await render(<AuthScreen auth={auth} pendingCount={0} />);
  expect(
    screen.getByText(
      'Sign-in is unavailable right now. Shared screenshots are kept on this phone.',
    ),
  ).toBeTruthy();
});
