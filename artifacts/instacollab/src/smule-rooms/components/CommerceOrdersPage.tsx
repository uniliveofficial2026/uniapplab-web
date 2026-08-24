import { useMemo, useState } from 'react';
import { CommerceOrdersWorkspace } from '../../smule-rooms/components/CommerceOrdersWorkspace';
import {
  listCommerceOrders,
  markCommerceOrderShipped,
} from '../../lib/commerce/commerceOrderStore';
import { useCurrentUser } from '../../lib/useCurrentUser';

export function CommerceOrdersPage({ role }: { role: 'host' | 'buyer' }) {
  const me = useCurrentUser();
  const [revision, setRevision] = useState(0);
  const orders = useMemo(() => {
    void revision;
    return listCommerceOrders(
      role === 'host' ? { hostUserId: me.id } : { buyerUserId: me.id },
    );
  }, [me.id, revision, role]);

  return (
    <CommerceOrdersWorkspace
      role={role}
      orders={orders}
      onMarkShipped={(order) => {
        markCommerceOrderShipped(order.id);
        setRevision((value) => value + 1);
      }}
      onContactCustomer={() => {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Opening customer message thread' }));
      }}
      onTrackOrder={() => {
        window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Shipment tracking is shown on the order' }));
      }}
    />
  );
}
