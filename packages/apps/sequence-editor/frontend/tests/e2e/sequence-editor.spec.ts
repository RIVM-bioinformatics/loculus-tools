import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

const remoteFastaUrl = 'https://raw.githubusercontent.com/nextstrain/nextclade_data/refs/heads/master/data_output/nextstrain/rsv/a/EPI_ISL_412866/2026-04-14--11-55-23Z/sequences.fasta';

test('autoloads a remote FASTA from the input-fasta query parameter', async ({ page }) => {
  await page.goto(`/?input-fasta=${encodeURIComponent(remoteFastaUrl)}`);

  const dialog = page.getByRole('dialog', { name: 'Import FASTA' });
  const urlField = dialog.getByRole('textbox', { name: 'Load FASTA from URL' });
  const main = page.getByRole('main');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(urlField).toHaveValue(remoteFastaUrl);
  await expect(main.getByText('Loaded 32 sequences.')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/sequences\.fasta · 32 sequences × \d+ bases/)).toBeVisible();
  await expect(dialog).not.toBeVisible({ timeout: 30_000 });
});

test('loads, edits, searches, exports, and responds at tablet width', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true);

  await page.getByRole('button', { name: 'Import FASTA' }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Import FASTA' });
  await dialog.getByRole('button', { name: 'Load SARS-CoV-2 demo' }).click();

  const grid = page.getByRole('grid', { name: 'Nucleotide alignment grid' });
  const main = page.getByRole('main');
  await expect(grid).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('sarscov2_demo.fasta · 165 sequences × 29903 bases', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'No alignment loaded' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import FASTA' }).last().click();
  const pastedDialog = page.getByRole('dialog', { name: 'Import FASTA' });
  await pastedDialog.getByRole('textbox').fill('>alpha\nACGT\n>beta\nACGT');
  await pastedDialog.getByRole('button', { name: 'Load FASTA' }).click();
  await expect(grid).toBeVisible({ timeout: 30_000 });
  await expect(main.getByText('Loaded 2 sequences.')).toBeVisible({ timeout: 30_000 });

  const search = page.getByRole('textbox', { name: 'Search alignment' });
  await expect(search).toBeEnabled({ timeout: 30_000 });
  await search.fill('ACGT');
  await search.press('Enter');
  await expect(page.getByText(/1 \/ \d+/)).toBeVisible();
  await page.getByRole('button', { name: 'Next match' }).click();
  await page.getByRole('button', { name: 'Previous match' }).click();

  await grid.click({ position: { x: 205, y: 35 } });
  await grid.press('r');
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  await grid.press('Space');
  await expect(main.getByText('Gaps inserted.')).toBeVisible();
  await grid.press('Backspace');
  await expect(main.getByText('Gaps deleted.')).toBeVisible();
  await grid.press('Backspace');
  await expect(main.getByRole('alert').getByText('Delete failed: the selected position is not a gap.')).toBeVisible();

  await grid.press('Delete');
  await expect(main.getByText('Edit applied.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(main.getByText('Undo complete.')).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(main.getByText('Redo complete.')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  const foreground = page.getByLabel('Foreground').first();
  await foreground.fill('#123456');
  await expect(foreground).toHaveValue('#123456');
  await page.getByRole('button', { name: 'Reset to AliView Default' }).click();
  await expect(foreground).toHaveValue('#018001');

  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pasted-alignment.fasta');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = await readFile(downloadPath!, 'utf8');
  expect(exported).toMatch(/^>alpha\n/);
  expect(exported.endsWith('\n')).toBe(true);

  await page.screenshot({ path: 'test-results/sequence-editor-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No alignment loaded' })).toBeVisible({ timeout: 30_000 });

  await page.setViewportSize({ height: 900, width: 768 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: 'Close settings' })).toBeVisible();
  await page.screenshot({ path: 'test-results/sequence-editor-tablet.png', fullPage: true });
});
