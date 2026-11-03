// Apply one PayPal purchase_unit (its capture + shipping) to a store order.
export function applyUnit(o: any, j: any, pu: any, ship: any) {
  const cap = pu?.payments?.captures?.[0];
  if (j?.status) o.status = j.status === 'COMPLETED' && cap?.status !== 'COMPLETED' && cap?.status !== 'PENDING' ? 'FAILED' : j.status;
  if (cap) { o.captureId = cap.id; o.captureStatus = cap.status; o.capturedAmount = Number(cap.amount?.value ?? o.total); }
  if (j?.payer) o.payer = { email: j.payer.email_address, name: [j.payer.name?.given_name, j.payer.name?.surname].filter(Boolean).join(' ') };
  if (j?.payment_source) o.paymentSource = Object.keys(j.payment_source)[0];
  // Ship physical items to the address the buyer gave PayPal (Printful drafts only; never confirmed). One address for every store.
  const sh = pu?.shipping?.address?.address_line_1 ? pu.shipping : ship;
  if (sh?.address?.address_line_1 && !o.shipping) o.shipping = { name: String(sh.name?.full_name || o.payer?.name || 'HollowCo Buyer').slice(0, 80), address1: sh.address.address_line_1, address2: sh.address.address_line_2, city: sh.address.admin_area_2, state_code: sh.address.admin_area_1, country_code: sh.address.country_code, zip: sh.address.postal_code };
}
