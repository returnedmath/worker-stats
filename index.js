export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const db = env.DB;

    // CORS headers to allow cross-origin requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Change "*" to your frontend domain in production
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle OPTIONS (CORS preflight) requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // POST /likes - register a like or dislike for a product
      if (url.pathname === "/likes" && request.method === "POST") {
        const data = await request.json();
        const { product_id, action } = data;

        if (!product_id || !["like", "dislike"].includes(action)) {
          return new Response("Invalid input", { status: 400, headers: corsHeaders });
        }

        if (action === "like") {
          await db
            .prepare(
              `
            INSERT INTO product_stats(product_id, likes, dislikes)
            VALUES (?, 1, 0)
            ON CONFLICT(product_id) DO UPDATE SET likes = likes + 1
          `
            )
            .bind(product_id)
            .run();
        } else if (action === "dislike") {
          await db
            .prepare(
              `
            INSERT INTO product_stats(product_id, likes, dislikes)
            VALUES (?, 0, 1)
            ON CONFLICT(product_id) DO UPDATE SET dislikes = dislikes + 1
          `
            )
            .bind(product_id)
            .run();
        }

        return new Response("OK", { headers: corsHeaders });
      }

      // GET /stats?product_id=xxx - return likes/dislikes counts for a product
      if (url.pathname === "/stats" && request.method === "GET") {
        const product_id = url.searchParams.get("product_id");
        if (!product_id) {
          return new Response("Missing product_id", { status: 400, headers: corsHeaders });
        }

        const res = await db
          .prepare(`SELECT likes, dislikes FROM product_stats WHERE product_id = ?`)
          .bind(product_id)
          .first();

        if (!res) {
          return new Response(JSON.stringify({ likes: 0, dislikes: 0 }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify(res), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Unknown route
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (e) {
      return new Response("Error: " + e.message, { status: 500, headers: corsHeaders });
    }
  },
};
