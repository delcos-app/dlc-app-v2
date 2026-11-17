/**
 * Facturación: the payment states of an invoice, its pill and the money format. Migrated from the legacy pillCobro (v2.413.0).
 */
import { escapeHtml, formatCurrency } from '../../services/format';
import { round2, vatByRate, type VatRow } from '../../services/money';

/** Payment states as the database names them. */
export const PAYMENT = { paid: 'Cobrada', overdue: 'Vencida', pending: 'Pendiente' } as const;

/** Euros with up to two decimals, rounded to the cent (the legacy eurI). */
export const euros = (value: unknown): string => formatCurrency(round2(value));

export function paymentPill(state: string): string {
  const kind = state === PAYMENT.paid ? 'p-est' : state === PAYMENT.overdue ? 'p-anu' : 'p-bor';
  return `<span class="pill ${kind}">${escapeHtml(state)}</span>`;
}

export const errorMessage = (error: unknown): string => (error as { message?: string } | null)?.message ?? '';

export interface InvoiceLine { descripcion: string; unidades: number; precio: number; descuento?: number | null; iva: number; base: number }
export interface InvoiceParty { nombre?: string | null; nif?: string | null; direccion?: string | null; cp?: string | null; municipio?: string | null; provincia?: string | null; razon_social?: string | null }
export interface Invoice {
  id: string; numero: string; fecha: string; vencimiento?: string | null; forma_pago?: string | null; total: number; cobrado: number;
  rectifica_id?: string | null; motivo_rectificacion?: string | null; pedido_id?: string | null; huella?: string | null;
  verifactu?: { estado?: string | null } | null; cliente: InvoiceParty; emisor: InvoiceParty; lineas: InvoiceLine[]; desglose_iva: { iva: number; base: number; cuota: number }[];
}

interface BreakdownOrder {
  pedido: { envio?: boolean | null; envio_base?: number | null; envio_iva?: number | null };
  totales?: { bruto?: number | null; base_productos?: number | null; factor?: number | null } | null;
  lineas?: readonly { importe?: number | null; descuento?: number | null; iva?: number | null }[] | null;
}
export interface VatBreakdown { desglose: VatRow[]; base: number; total: number }

/** The general discount factor of an order: the one from the database (SQL 199) or, before it, base of the products ÷ gross. */
export function discountFactor(detail: Pick<BreakdownOrder, 'totales'>): number {
  const amount = (value: unknown): number => Number(value) || 0, stored = detail.totales?.factor;
  if (stored !== null && stored !== undefined) return amount(stored);
  const gross = amount(detail.totales?.bruto);
  return gross ? amount(detail.totales?.base_productos) / gross : 1;
}

/** v2.475.0–v2.476.0 (SQL 198–199): the VAT breakdown of the invoice of an order, with the single rule (vatByRate): lines with the
 * general discount and the shipping, unrounded. 7,00 € of shipping with VAT (base 5,7851) gives 5,79 + 1,21, not 5,79 + 1,22. */
export function vatBreakdown(detail: BreakdownOrder): VatBreakdown {
  const amount = (value: unknown): number => Number(value) || 0, order = detail.pedido, share = discountFactor(detail);
  const items = (detail.lineas ?? []).map(line => ({ base: amount(line.importe) * (1 - amount(line.descuento) / 100) * share, rate: amount(line.iva) }));
  if (order.envio) items.push({ base: amount(order.envio_base), rate: amount(order.envio_iva) });
  const vat = vatByRate(items);
  return { desglose: vat.rows, base: vat.base, total: vat.total };
}
