const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const emailjs = require("@emailjs/nodejs");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeReviewActionToken(reviewId, action, adminEmail) {
  return jwt.sign(
    {
      review_id: reviewId,
      action,
      admin_email: adminEmail
    },
    process.env.REVIEW_ACTION_SECRET,
    { expiresIn: "7d" }
  );
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: "Method not allowed"
      };
    }

    const body = JSON.parse(event.body || "{}");

    const {
      review_name,
      review_email,
      review_relationship,
      review_title,
      review_message,
      review_rating,
      review_consent_moderation,
      review_consent_privacy,
      review_consent_publish
    } = body;

    if (!review_name || !review_email || !review_title || !review_message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields." })
      };
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert([{
        review_name,
        review_email,
        review_relationship,
        review_title,
        review_message,
        rating: Number(review_rating || 5),
        review_consent_moderation,
        review_consent_privacy,
        review_consent_publish,
        approved: false,
        rejected: false
      }])
      .select("id")
      .single();

    if (error) throw error;

    const reviewId = data.id;

    const approveToken = makeReviewActionToken(
      reviewId,
      "approve",
      process.env.ADMIN_EMAIL
    );

    const rejectToken = makeReviewActionToken(
      reviewId,
      "reject",
      process.env.ADMIN_EMAIL
    );

    const approve_link = `${process.env.SITE_URL}/.netlify/functions/review-action?token=${encodeURIComponent(approveToken)}`;
    const reject_link = `${process.env.SITE_URL}/.netlify/functions/review-action?token=${encodeURIComponent(rejectToken)}`;

    const templateParams = {
      review_name,
      review_email,
      review_relationship,
      review_title,
      review_message,
      review_rating,
      review_consent_moderation,
      review_consent_privacy,
      review_consent_publish,
      approve_link,
      reject_link
    };

    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_PROVIDER_TEMPLATE_ID,
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY
      }
    );

    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_PATIENT_TEMPLATE_ID,
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Unable to submit review." })
    };
  }
};
