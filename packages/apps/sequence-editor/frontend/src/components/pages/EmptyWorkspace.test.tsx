import {
  render,
  screen,
} from '@testing-library/react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { EmptyWorkspace } from './EmptyWorkspace';

describe('EmptyWorkspace', () => {
  it('offers the FASTA import action on an empty alignment', () => {
    render(
      <EmptyWorkspace onImport={vi.fn()} />,
    );

    expect(screen.getByText('No alignment loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import FASTA' })).toBeInTheDocument();
  });
});
