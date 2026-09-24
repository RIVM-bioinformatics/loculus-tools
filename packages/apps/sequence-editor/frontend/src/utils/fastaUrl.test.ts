import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  fastaLabelFromUrl,
  fastaUrlFromSearch,
  validateFastaUrl,
} from './fasta';

const exampleUrl = 'https://raw.githubusercontent.com/nextstrain/nextclade_data/refs/heads/master/data_output/nextstrain/rsv/a/EPI_ISL_412866/2026-04-14--11-55-23Z/sequences.fasta';

describe('FASTA URL helpers', () => {
  it('reads and decodes the input-fasta query parameter', () => {
    expect(fastaUrlFromSearch(`?input-fasta=${encodeURIComponent(exampleUrl)}`)).toBe(exampleUrl);
    expect(fastaUrlFromSearch('?other=value')).toBeNull();
  });

  it('accepts HTTP(S) URLs and derives a download label', () => {
    expect(validateFastaUrl(` ${exampleUrl} `)).toBe(exampleUrl);
    expect(fastaLabelFromUrl(exampleUrl)).toBe('sequences.fasta');
  });

  it('rejects invalid and non-HTTP URLs', () => {
    expect(() => validateFastaUrl('not a URL')).toThrow('valid FASTA URL');
    expect(() => validateFastaUrl('file:///tmp/alignment.fasta')).toThrow('HTTP or HTTPS');
  });
});
