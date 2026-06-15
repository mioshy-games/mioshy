/**
 * lib/billing/post-payment-target.ts (F3.2)
 *
 * Post-payment landing for the Cardcom success page. Journey-funnel buyers
 * continue IMMEDIATELY into the assessment (locked decision A) so they finish
 * the full set; the assessment page's own post-purchase guard sends them to
 * /my if their full is already complete. Every other pillar lands on /my
 * (PartnerShareCard / pair-conversion), unchanged.
 */
export function postPaymentTarget(product: string | null, locale: string): string {
  return product === "journey"
    ? `/${locale}/journey/assessment`
    : `/${locale}/my`;
}
