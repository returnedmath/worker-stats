export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const db = env.DB;

    if (url.pathname === "/likes" && request.method === "POST") {
      // Example: POST /likes with JSON { "product_id": "123", "action": "like" }
      try {
        const data = await request.json();
        const { product_id, action } = data;
        if (!product_id || !["like", "dislike"].includes(action)) {
          return new Response("Invalid input", { status: 400 });
        }

        // Upsert likes/dislikes count for the product
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

        return new Response("OK");
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      // Example: GET /stats?product_id=123
      const product_id = url.searchParams.get("product_id");
      if (!product_id) {
        return new Response("Missing product_id", { status: 400 });
      }
      try {
        const res = await db.prepare(`SELECT likes, dislikes FROM product_stats WHERE product_id = ?`)
          .bind(product_id)
          .first();

        if (!res) {
          return new Response(JSON.stringify({ likes: 0, dislikes: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify(res), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
