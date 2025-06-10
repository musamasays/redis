import Redis from "ioredis";

// Create a connection instance
export const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  // Add this if BullMQ throws `maxRetriesPerRequest` error
  maxRetriesPerRequest: null,
  // Optional: helps with debugging and connection stability
  reconnectOnError: (err) => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'EPIPE'];
    return targetErrors.some((e) => err.message.includes(e));
  },
});

redis.on("error", (err) => console.error("Redis Client Error", err));

export default redis;
