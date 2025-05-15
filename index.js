export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const db = env.DB;

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      if (url.pathname === "/likes" && request.method === "POST") {
        const data = await request.json();
        const { product_id, action } = data;
        if (!product_id || !["like", "dislike"].includes(action)) {
          return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers });
        }

        if (action === "like") {
          await db.prepare(`
            INSERT INTO product_stats(product_id, likes, dislikes)
            VALUES (?, 1, 0)
            ON CONFLICT(product_id) DO UPDATE SET likes = likes + 1
          `).bind(product_id).run();
        } else if (action === "dislike") {
          await db.prepare(`
            INSERT INTO product_stats(product_id, likes, dislikes)
            VALUES (?, 0, 1)
            ON CONFLICT(product_id) DO UPDATE SET dislikes = dislikes + 1
          `).bind(product_id).run();
        }

        return new Response(JSON.stringify({ success: true }), { status: 200, headers });
      }

      if (url.pathname === "/stats" && request.method === "GET") {
        const product_id = url.searchParams.get("product_id");
        if (!product_id) {
          return new Response(JSON.stringify({ error: "Missing product_id" }), { status: 400, headers });
        }

        const res = await db.prepare(`SELECT likes, dislikes FROM product_stats WHERE product_id = ?`)
          .bind(product_id)
          .first();

        return new Response(JSON.stringify(res || { likes: 0, dislikes: 0 }), { status: 200, headers });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  }
}
