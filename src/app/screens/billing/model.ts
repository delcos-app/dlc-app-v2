/**
 * Facturación: the payment states of an invoice, its pill and the money format. Migrated from the legacy pillCobro (v2.413.0).
 */
import { escapeHtml, formatCurrency } from '../../services/format';
import { round2 } from '../../services/money';

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
  totales?: { bruto?: number | null; base_productos?: number | null } | null;
  lineas?: readonly { importe?: number | null; descuento?: number | null; iva?: number | null }[] | null;
}
export interface VatBreakdown { desglose: { iva: number; base: number; cuota: number }[]; base: number; total: number }

/** v2.475.0 (SQL 198): the VAT breakdown of the invoice of an order, from the exact bases by rate (lines with the general discount
 * spread, and the shipping unrounded), as the order total and emitir_factura. 7,00 € of shipping with VAT (base 5,7851) gives
 * 5,79 + 1,21; rounding the base first gave 5,79 + 1,22 and the invoice was 1 cent dearer than the order. */
export function vatBreakdown(detail: BreakdownOrder): VatBreakdown {
  const amount = (value: unknown): number => Number(value) || 0, order = detail.pedido, byRate = new Map<number, number>();
  const gross = amount(detail.totales?.bruto), share = gross ? amount(detail.totales?.base_productos) / gross : 1;
  const add = (rate: number, base: number): void => { byRate.set(rate, (byRate.get(rate) ?? 0) + base); };
  (detail.lineas ?? []).forEach(line => { add(amount(line.iva), amount(line.importe) * (1 - amount(line.descuento) / 100) * share); });
  if (order.envio) add(amount(order.envio_iva), amount(order.envio_base));
  const desglose = [...byRate.keys()].sort((first, second) => first - second)
    .map(rate => ({ iva: rate, base: round2(byRate.get(rate) ?? 0), cuota: round2((byRate.get(rate) ?? 0) * rate / 100) }));
  return { desglose, base: round2(desglose.reduce((all, item) => all + item.base, 0)), total: round2(desglose.reduce((all, item) => all + item.base + item.cuota, 0)) };
}
