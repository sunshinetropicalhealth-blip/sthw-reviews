const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function (event) {
  try {
    const token = event.queryStringParameters?.token;

    if (!token) {
      return {
        statusCode: 400,
        body: "Missing token."
      };
    }

    const decoded = jwt.verify(token, process.env.REVIEW_ACTION_SECRET);
    const { review_id, action, admin_email } = decoded;

    if (!review_id || !action) {
      return {
        statusCode: 400,
        body: "Invalid token."
      };
    }

    if (action === "approve") {
      const { error } = await supabase
        .from("reviews")
        .update({
          approved: true,
          rejected: false,
          approved_at: new Date().toISOString(),
          approved_by: admin_email || "gmail-link"
        })
        .eq("id", review_id);

      if (error) throw error;

      return {
        statusCode: 302,
        headers: {
          Location: "https://www.sunshinetropicalhealth.com/review-approved.html"
        }
      };
    }

    if (action === "reject") {
      const { error } = await supabase
        .from("reviews")
        .update({
          approved: false,
          rejected: true,
          rejected_at: new Date().toISOString(),
          rejected_by: admin_email || "gmail-link"
        })
        .eq("id", review_id);

      if (error) throw error;

      return {
        statusCode: 302,
        headers: {
          Location: "https://www.sunshinetropicalhealth.com/review-rejected.html"
        }
      };
    }

    return {
      statusCode: 400,
      body: "Invalid action."
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 403,
      body: "Invalid or expired approval link."
    };
  }
};