/**
 * /billing/error
 *
 * Browser redirect landing page after a failed / cancelled Cardcom payment.
 */

import { Suspense } from "react"
import { BillingErrorContent } from "./content"

export default function BillingErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-fuchsia-500 border-t-transparent" />
        </div>
      }
    >
      <BillingErrorContent />
    </Suspense>
  )
}
