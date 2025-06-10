import redis from "./redis.js";
import { Worker } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import FormData from "form-data";

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ImageKit upload function
async function uploadToImageKit(imageUrl, reviewId) {
  try {
    const formData = new FormData();
    formData.append("file", imageUrl);
    formData.append("fileName", `${reviewId || "image"}-${Date.now()}.jpg`);
    formData.append("useUniqueFileName", "true");

    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from("private_GExVQvnuIrz00mR5vBR7CTdTxDU=" + ":").toString("base64"),
      },
      body: formData,
    });

    const data = await response.json();

    if (!data || !data.url) {
      console.error("❌ ImageKit upload failed:", data);
      return null;
    }
    console.log("✅ ImageKit upload successful:", data.url);
    return data.url;
  } catch (error) {
    console.error("🔥 Error uploading to ImageKit:", error);
    return null;
  }
}

console.log("🚀 Worker starting up...");

const imageWorker = new Worker(
  "myQueue",
  async (job) => {
    console.log("📥 Processing job:", job.id, job.data);
    const { review_id: reviewId, image_url: imageUrl } = job.data;

    if (!reviewId || !imageUrl) {
      console.error("❌ Missing reviewId or imageUrl in job data.");
      return;
    }

    const imageKitUrl = await uploadToImageKit(imageUrl, reviewId);
    if (!imageKitUrl) {
      console.error("❌ Upload failed, skipping DB insert");
      return;
    }

    // Check if photo already exists
    const { data: existingPhoto, error: photoLookupError } = await supabase
      .from("review_photos")
      .select("id")
      .eq("review_id", reviewId)
      .eq("photo_url", imageKitUrl)
      .maybeSingle();

    if (photoLookupError) {
      console.error("❌ Error looking up existing photo:", photoLookupError);
      return;
    }

    if (!existingPhoto) {
      console.log("📷 Photo does not exist. Inserting to Supabase...");

      const photoData = {
        review_id: reviewId,
        photo_url: imageKitUrl,
        photo_type: "review_photo",
        google_photo_url: imageUrl,
        caption: `Review ${reviewId} photo`,
        is_before_photo: false,
        is_after_photo: false,
      };

      const { error: photoInsertError } = await supabase
        .from("review_photos")
        .insert(photoData);

      if (photoInsertError) {
        console.error("❌ Error inserting review photo:", photoInsertError);
      } else {
        console.log(`✅ Saved ImageKit photo for review ${reviewId}`);
      }
    } else {
      console.log("⚠️ Photo already exists in Supabase.");
    }
  },
  {
    connection: redis,
  }
);

imageWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed!`);
});

imageWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

imageWorker.on("error", (err) => {
  console.error("❌ Worker error:", err);
});

redis.on("connect", () => {
  console.log("🔌 Redis connected");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});
