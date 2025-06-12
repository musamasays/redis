import express from "express";
import { Queue } from "bullmq";
import Redis from "ioredis";

// 🔧 Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  reconnectOnError: (err) => {
    const targetErrors = ["READONLY", "ECONNRESET", "EPIPE"];
    return targetErrors.some((e) => err.message.includes(e));
  },
});

redis.on("error", (err) => console.error("❌ Redis Client Error:", err));

// 🐮 BullMQ Queue setup
const queues = {
  myQueue: new Queue("myQueue", { connection: redis }),
  profileImage: new Queue("profileImage", { connection: redis }),
};

// 🚀 Express setup
const app = express();
app.use(express.json());

// 🔒 Auth check middleware
const authMiddleware = (req, res, next) => {
  const { key } = req.body;
  if (key !== process.env.KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// 📦 Generic Job Adder
const addJobToQueue = async (queueName, data) => {
  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue "${queueName}" not found`);
  }

  await queue.add(queueName, data);
  console.log(`✅ Job added to queue "${queueName}"`, data);
  return { success: true, message: `Job added to queue "${queueName}"` };
};

// 🚚 Generic POST handler
const jobHandler = (queueName) => async (req, res) => {
  const { review_id, image_url } = req.body;

  if (!review_id || !image_url) {
    return res.status(400).json({ error: "Missing review_id or image_url" });
  }

  try {
    const result = await addJobToQueue(queueName, { review_id, image_url });
    res.status(200).json(result);
  } catch (error) {
    console.error(`❌ Failed to add job to queue "${queueName}":`, error);
    res.status(500).json({ error: "Failed to add job" });
  }
};

// 🛤️ Routes
app.post("/add-job", authMiddleware, jobHandler("myQueue"));
app.post("/add-profile-image", authMiddleware, jobHandler("profileImage"));

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Producer API running on http://localhost:${PORT}`);
});
