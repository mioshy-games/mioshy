/**
 * /billing/success
 *
 * Browser redirect landing page after a successful Cardcom payment.
 * The indicator callback has already (or will soon) process the payment
 * server-side and activate the subscription.
 *
 * We poll the checkout session status to give the user live feedback.
 */

import { Suspense } from "react"
import { BillingSuccessContent } from "./content"

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-fuchsia-500 border-t-transparent" />
        </div>
      }
    >
      <BillingSuccessContent />
    </Suspense>
  )
}
