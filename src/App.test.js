import { render, screen } from '@testing-library/react';
import App from './App';

test('renders throw button', () => {
  render(<App />);
  const throwButton = screen.getByRole('button', { name: /throw yut sticks/i });
  expect(throwButton).toBeInTheDocument();
});
