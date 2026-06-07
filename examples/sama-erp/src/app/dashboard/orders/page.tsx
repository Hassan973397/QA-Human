// Illustrative merchant orders page (Next.js app-router style) for discovery.
export default function MerchantOrdersPage() {
  return (
    <main data-testid="orders-page">
      <h1>Orders</h1>
      <table>
        <tbody>
          <tr data-testid="order-row">
            <td>
              <a href="/dashboard/orders/1">Order #1</a>
            </td>
            <td>
              <button data-testid="order-status">Accept</button>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
