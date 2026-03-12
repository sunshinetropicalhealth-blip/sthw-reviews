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
  return BLOCKED_WORDS.some((word) => lowerText.includes(word));
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return null;
  }
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    const body = parseJsonSafe(event.body);
    if (!body) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Invalid request body." })
      };
    }

    const {
      review_name,
      review_email,
      review_relationship,
      review_title,
      review_message,
      rating,
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

    const normalizedRating = Number(rating || review_rating || 5);

    if (cleanWebsite !== "") {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Spam detected." })
      };
    }

    if (
      !cleanReviewName ||
      !cleanReviewEmail ||
      !cleanReviewTitle ||
      !cleanReviewMessage
    ) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Missing required fields." })
      };
    }

    if (cleanReviewMessage.length < 20) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Please enter at least 20 characters in your review."
        })
      };
    }

    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Please select a valid rating."
        })
      };
    }

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanReviewEmail);
    if (!emailIsValid) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Please enter a valid email address."
        })
      };
    }

    const blockedInMessage = containsBlockedWords(cleanReviewMessage);
    const blockedInTitle = containsBlockedWords(cleanReviewTitle);
    const blockedInName = containsBlockedWords(cleanReviewName);
    const blockedInEmail = containsBlockedWords(cleanReviewEmail);

    if (blockedInMessage || blockedInTitle || blockedInName || blockedInEmail) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Your review contains blocked content."
        })
      };
    }

    const moderationValue = yesNo(review_consent_moderation);
    const privacyValue = yesNo(review_consent_privacy);
    const publishValue = yesNo(review_consent_publish);

    const { data, error } = await supabase
      .from("reviews")
      .insert([{
        review_name: cleanReviewName,
        review_email: cleanReviewEmail,
        review_relationship: cleanReviewRelationship,
        review_title: cleanReviewTitle,
        review_message: cleanReviewMessage,
        rating: normalizedRating,
        review_consent_moderation: moderationValue,
        review_consent_privacy: privacyValue,
        review_consent_publish: publishValue,
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
      review_rating: normalizedRating,
      rating: normalizedRating,
      review_consent_moderation: moderationValue,
      review_consent_privacy: privacyValue,
      review_consent_publish: publishValue,
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error("submit-review error:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Unable to submit review." })
    };
  }
};