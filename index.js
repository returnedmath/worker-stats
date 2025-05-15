export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const db = env.DB;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // LIKE/DISLIKE HANDLING
      if (url.pathname === "/likes" && request.method === "POST") {
        const { product_id, action } = await request.json();

        if (!product_id || !["like", "dislike", "unlike", "undislike"].includes(action)) {
          return new Response("Invalid input", { status: 400, headers: corsHeaders });
        }

        let field = action.includes("like") ? "likes" : "dislikes";
        let delta = action.startsWith("un") ? -1 : 1;

        await db
          .prepare(`
            INSERT INTO product_stats(product_id, likes, dislikes)
            VALUES (?, 0, 0)
            ON CONFLICT(product_id) DO UPDATE SET ${field} = MAX(0, ${field} + ${delta})
          `)
          .bind(product_id)
          .run();

        return new Response("OK", { headers: corsHeaders });
      }

      if (url.pathname === "/stats" && request.method === "GET") {
        const product_id = url.searchParams.get("product_id");
        if (!product_id) {
          return new Response("Missing product_id", { status: 400, headers: corsHeaders });
        }

        const stats = await db
          .prepare(`SELECT likes, dislikes FROM product_stats WHERE product_id = ?`)
          .bind(product_id)
          .first();

        return new Response(JSON.stringify(stats || { likes: 0, dislikes: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // COMMENTS
      if (url.pathname === "/comments" && request.method === "POST") {
        const { product_id, content } = await request.json();

        if (!product_id || !content) {
          return new Response("Missing fields", { status: 400, headers: corsHeaders });
        }

        await db
          .prepare(`INSERT INTO comments (product_id, content) VALUES (?, ?)`)
          .bind(product_id, content)
          .run();

        return new Response("Comment added", { headers: corsHeaders });
      }

      if (url.pathname === "/comments" && request.method === "GET") {
        const product_id = url.searchParams.get("product_id");
        if (!product_id) {
          return new Response("Missing product_id", { status: 400, headers: corsHeaders });
        }

        const comments = await db
          .prepare(`SELECT id, content, created_at FROM comments WHERE product_id = ? ORDER BY created_at DESC`)
          .bind(product_id)
          .all();

        return new Response(JSON.stringify(comments.results), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (e) {
      return new Response("Error: " + e.message, { status: 500, headers: corsHeaders });
    }
  },
};
