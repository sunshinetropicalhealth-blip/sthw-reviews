const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const emailjs = require("@emailjs/nodejs");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BLOCKED_WORDS = [
  "bitcoin",
  "crypto",
  "loan",
  "casino",
  "viagra",
  "http://",
  "https://",
  "www."
];

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

function containsBlockedWords(text) {
  const lowerText = String(text || "").toLowerCase();
  return BLOCKED_WORDS.some(word => lowerText.includes(word));
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
      review_consent_publish,
      website
    } = body;

    const cleanReviewName = String(review_name || "").trim();
    const cleanReviewEmail = String(review_email || "").trim();
    const cleanReviewRelationship = String(review_relationship || "").trim();
    const cleanReviewTitle = String(review_title || "").trim();
    const cleanReviewMessage = String(review_message || "").trim();
    const cleanWebsite = String(website || "").trim();

    // A. Honeypot field check
    if (cleanWebsite !== "") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Spam detected." })
      };
    }

    // Required fields
    if (!cleanReviewName || !cleanReviewEmail || !cleanReviewTitle || !cleanReviewMessage) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields." })
      };
    }

    // B. Minimum review length
    if (cleanReviewMessage.length < 20) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Please enter at least 20 characters in your review."
        })
      };
    }

    // C. Blocked keywords
    const blockedInMessage = containsBlockedWords(cleanReviewMessage);
    const blockedInTitle = containsBlockedWords(cleanReviewTitle);
    const blockedInName = containsBlockedWords(cleanReviewName);

    if (blockedInMessage || blockedInTitle || blockedInName) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Your review contains blocked content."
        })
      };
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert([{
        review_name: cleanReviewName,
        review_email: cleanReviewEmail,
        review_relationship: cleanReviewRelationship,
        review_title: cleanReviewTitle,
        review_message: cleanReviewMessage,
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
      review_name: cleanReviewName,
      review_email: cleanReviewEmail,
      review_relationship: cleanReviewRelationship,
      review_title: cleanReviewTitle,
      review_message: cleanReviewMessage,
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