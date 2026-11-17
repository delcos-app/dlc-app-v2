/**
 * Amounts, VAT and small number formats. Migrated from the legacy servicios/formato.js (v2.425.0); the legacy names (eur, eurI,
 * eurW, r2, pct, TIPOS_IVA…) stay as adapters.
 */
import { t } from '../i18n';
import { formatNumber } from './format';
import { formatDuration } from './dates';

export const number = (value: unknown): string => formatNumber(value || 0);
export const duration = (milliseconds: number): string => formatDuration(milliseconds);
/** «1.234,50 €» (up to two decimals). */
export const euros = (value: unknown): string => Number(value || 0).toLocaleString('es', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

/** Rounded to cents. */
/** Rounds to cents half away from zero, like the database: 1.005 → 1.01 (×100 in floating point gave 100.4999… → 1). */
export function round2(value: unknown): number {
  const amount = Number(value) || 0, cents = Math.round(Number((Math.abs(amount) * 100).toPrecision(12)));
  return (amount < 0 ? -cents : cents) / 100;
}

/** Decimals of an amount without VAT (prices, lines, shipping). With 6, every price with 21 % or 10 % VAT splits into base + VAT to the
 * cent (with 4, 1,70 € at 21 % gave 1,4050 → 1,41 + 0,30 = 1,71). Some prices at 4 % cannot split at all (0,13 €): no invoice can. */
export const BASE_DECIMALS = 6;

/** An amount without VAT as it is stored: 6 decimals. */
export const exactBase = (value: unknown): number => Number((Number(value) || 0).toFixed(BASE_DECIMALS));

/** The base of a price with VAT: 7,00 € at 21 % → 5,785124. */
export const baseFromGross = (gross: unknown, rate: unknown): number => exactBase((Number(gross) || 0) / (1 + (Number(rate) || 0) / 100));

export interface VatRow { iva: number; base: number; cuota: number }
export interface VatTotals { rows: VatRow[]; base: number; vat: number; total: number }

/**
 * v2.476.0 (SQL 199, importes_pedido): the single rule for the amounts of an order and its invoice. By VAT rate, the exact bases
 * (unrounded) are added; the base of the rate is rounded to cents and its VAT is the exact base by the rate, rounded. Base, VAT and
 * total are the sums of the rates, so total = base + VAT to the cent. 41,8182 at 10 % and 5,7851 at 21 % give 41,82 + 4,18 and
 * 5,79 + 1,21 = 53,00 (rounding the bases first gave 5,79 × 21 % = 1,22 and 53,01).
 */
export function vatByRate(items: readonly { base: number; rate: number }[]): VatTotals {
  const exact = new Map<number, number>();
  items.forEach(item => { const rate = Number(item.rate) || 0; exact.set(rate, (exact.get(rate) ?? 0) + (Number(item.base) || 0)); });
  const rows = [...exact.keys()].sort((first, second) => first - second)
    .map(rate => ({ iva: rate, base: round2(exact.get(rate)), cuota: round2((exact.get(rate) ?? 0) * rate / 100) }));
  const base = round2(rows.reduce((all, row) => all + row.base, 0)), vat = round2(rows.reduce((all, row) => all + row.cuota, 0));
  return { rows, base, vat, total: round2(base + vat) };
}

/** The total with VAT of an invoice line: the stored one (SQL 199) or, on older invoices, from its exact price when it matches the
 * base (5,7851 × 1,21 = 7,00, not 5,79 × 1,21 = 7,01). */
export function lineTotal(line: { precio?: number | null; unidades?: number | null; descuento?: number | null; iva?: number | null; base?: number | null; total?: number | null }): number {
  if (line.total !== null && line.total !== undefined) return round2(line.total);
  const rate = Number(line.iva) || 0, base = Number(line.base) || 0;
  const exact = (Number(line.precio) || 0) * (Number(line.unidades) || 0) * (1 - (Number(line.descuento) || 0) / 100);
  return round2((Math.abs(exact - base) < 0.006 ? exact : base) * (1 + rate / 100));
}

export const eurosRounded = (value: unknown): string => euros(round2(value));

/** Percentage of `part` in `whole` (0 without whole). */
export const percent = (part: number, whole: number): number => (whole ? Math.round(part / whole * 100) : 0);

/** «General · 21 %»: a VAT rate with its name («21 %» without one). */
export const vatRateText = (rate: number, name: string): string =>
  (name ? t('core.vat.rate', { name, rate: formatNumber(rate) }) : t('core.vat.rateOnly', { rate: formatNumber(rate) }));

/** Spain's VAT rates, with their names: the list of an organisation that has not set its own (core/organisation.ts, vatRates). */
export const VAT_RATES: readonly (readonly [number, string])[] = [
  [21, vatRateText(21, t('core.vat.general'))], [10, vatRateText(10, t('core.vat.reduced'))], [4, vatRateText(4, t('core.vat.superReduced'))],
  [0, vatRateText(0, t('core.vat.exempt'))],
];

const labelText = (input: HTMLInputElement): string => (input.id ? document.querySelector(`label[for="${input.id}"]`)?.textContent ?? '' : '');

/** A VAT field, found by its name or its label: it always gets the list of legal rates. */
export const isVatField = (input: HTMLInputElement): boolean =>
  /iva/i.test(`${input.id} ${input.dataset.f ?? ''} ${input.name}`) || /\bIVA\s*\(%\)|tipo de iva/i.test(labelText(input));

export const AMOUNT_FIELD = /imp|importe|total|base|precio|pvp|coste|cobro|con_iva|conIva|sin_iva/i;

/** 21 % of an amount, rounded to cents. */
export const vatOf = (amount: number): number => Math.round(amount * 21) / 100;

/** Euros without «,00» when the amount is whole (490 €), as on the website. */
export const eurosWeb = (value: unknown): string => {
  const text = euros(value);
  return Math.round(Number(value) * 100) % 100 === 0 ? text.replace(/,00(?=\s?€)/, '') : text;
};
