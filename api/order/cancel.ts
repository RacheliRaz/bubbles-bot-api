import type { VercelRequest, VercelResponse } from "vercel";
import fetch from "node-fetch";

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN as string;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN as string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { orderNumber, email, reason } = req.body || {};
    if (!orderNumber) return res.status(400).json({ error: "orderNumber is required" });

    const name = String(orderNumber).startsWith("#") ? String(orderNumber) : `#${orderNumber}`;

    // מביאים עד 250 הזמנות, אפשר גם בלי אימייל
    const findUrl = new URL(`https://${SHOP}/admin/api/2024-10/orders.json`);
    findUrl.searchParams.set("status", "any");
    findUrl.searchParams.set("limit", "250");
    if (email) findUrl.searchParams.set("email", String(email));

    const fr = await fetch(findUrl.toString(), {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json"
      }
    });
    if (!fr.ok) return res.status(fr.status).json({ success: false, message: await fr.text() });

    const data: any = await fr.json();
    const orders: any[] = data?.orders ?? [];
    const order = orders.find((o) => o?.name === name);
    if (!order) return res.json({ success: false, message: "Order not found" });

    // מבטלים רק אם לא מולא/נשלח
    const fs = order.fulfillment_status; // null = unfulfilled
    if (fs && fs !== "null") {
      return res.json({ success: false, message: "Order already in fulfillment/shipped" });
    }

    const cancelUrl = `https://${SHOP}/admin/api/2024-10/orders/${order.id}/cancel.json`;
    const cr = await fetch(cancelUrl, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reason: reason || "customer" })
    });
    if (!cr.ok) return res.status(cr.status).json({ success: false, message: await cr.text() });

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (e: any) {
    res.status(500).json({ success: false, message: String(e?.message || e) });
  }
}
