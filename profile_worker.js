import redis from "./redis.js";
import { Worker } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import FormData from "form-data";

// Supabase setup
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// ImageKit upload function
async function uploadToImageKit(imageUrl, reviewId) {
    try {
        const formData = new FormData();
        formData.append("file", imageUrl);
        formData.append("fileName", `${reviewId || "image"}-${Date.now()}.jpg`);
        formData.append("useUniqueFileName", "true");

        const response = await fetch(process.env.IMAGEKIT_URL, {
            method: "POST",
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(process.env.IMAGEKIT_PRIVATE_KEY + ":").toString("base64"),
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
    "profileImage",
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

        // Check if review already exists
        const { data: existingPhoto, error: photoLookupError } = await supabase
            .from("reviews")
            .select("id")
            .eq("google_review_id", reviewId)
            .maybeSingle();

        if (photoLookupError) {
            console.error("❌ Error looking up existing photo:", photoLookupError);
            return;
        }

        if (existingPhoto) {
            console.log("📷 Photo exists. Updating in Supabase...");

            const { error: photoUpdateError } = await supabase
                .from("reviews")
                .update({ profile_photo_url: imageKitUrl })
                .eq("google_review_id", reviewId);

            if (photoUpdateError) {
                console.error("❌ Error updating review photo:", photoUpdateError);
            } else {
                console.log(`✅ Updated ImageKit photo for review ${reviewId}`);
            }
        } else {
            console.log("⚠️ Photo does not exist in Supabase. Inserting new row...");

            // Insert full NOT NULL required fields
            const photoData = {
                profile_photo_url: imageKitUrl,
                google_review_id: reviewId,
                google_place_id: '',
                author_title: '',
                author_url: '',
                rating: 0, // default rating
                text: '',
                review_timestamp: new Date().toISOString(), // ISO date string
                language: 'en',
                location_city: '',
                location_zip: '',
                pagination_id: '',
                owner_response: ''
            };

            const { error: photoInsertError } = await supabase
                .from("reviews")
                .insert(photoData);

            if (photoInsertError) {
                console.error("❌ Error inserting review photo:", photoInsertError);
            } else {
                console.log(`✅ Inserted ImageKit photo for review ${reviewId}`);
            }
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
