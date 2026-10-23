'use client';

import { useParams } from 'next/navigation';
import { SaleDetail } from '../../../../../components/SalesManager';

export default function VyapaarInvoicePage() {
  const params = useParams();
  return <SaleDetail invoiceNumber={String(params.invoiceNumber)} />;
}
