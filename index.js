// server.ts
import express from "express";
import { Queue } from "bullmq";
import Redis from "ioredis";

// 🔧 Redis connection
const redis = new Redis({
  host: "redis-12535.c239.us-east-1-2.ec2.redns.redis-cloud.com",
  port: 12535,
  username: "default",
  password: "Zh53FQHrGfyo0Y9Q8RENHYzl9cNHZnef",
  maxRetriesPerRequest: null,
  reconnectOnError: (err) => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'EPIPE'];
    return targetErrors.some((e) => err.message.includes(e));
  },
});

redis.on("error", (err) => console.error("Redis Client Error", err));

// 🐮 BullMQ Queue setup
const queue = new Queue("myQueue", {
  connection: redis,
});

// 🚀 Express setup
const app = express();
app.use(express.json());

// 📬 POST endpoint to add job to queue
app.post("/add-job", async (req, res) => {
  const { review_id, image_url } = req.body;

  if (!review_id || !image_url) {
    return res.status(400).json({ error: "Missing review_id or image_url" });
  }

  try {
    await queue.add("myQueue", {
      review_id,
      image_url,
    });

    console.log("✅ Job added to the queue!", { review_id, image_url });
    res.status(200).json({ success: true, message: "Job added to queue" });
  } catch (err) {
    console.error("❌ Failed to add job to queue", err);
    res.status(500).json({ error: "Failed to add job" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Producer API running on http://localhost:${PORT}`);
});
