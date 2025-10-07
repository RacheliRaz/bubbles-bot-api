import type { VercelRequest, VercelResponse } from "vercel";
import fetch from "node-fetch";
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN as string;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN as string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
    const { orderNumber, email } = req.body || {};
    if (!orderNumber) return res.status(400).json({ error: "orderNumber is required" });

    const url = new URL(`https://${SHOP}/admin/api/2024-10/orders.json`);
    url.searchParams.set("name", orderNumber.startsWith("#") ? orderNumber : `#${orderNumber}`);
    if (email) url.searchParams.set("email", String(email));

    const r = await fetch(url.toString(), {
      headers: { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" }
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });

    const data: any = await r.json();
    const order = data?.orders?.[0];
    if (!order) return res.json({ found: false });

    const f = order.fulfillments?.[0];
    const tracking = f?.tracking_numbers?.[0] || f?.tracking_number || null;

    res.json({
      found: true,
      orderNumber: order.name,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      tracking,
      trackingUrl: f?.tracking_url || null,
      items: (order.line_items || []).map((li: any) => ({ title: li.title, qty: li.quantity })),
      createdAt: order.created_at || null
    });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
}
