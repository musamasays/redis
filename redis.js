import Redis from "ioredis";

// Create a connection instance
export const redis = new Redis({
  host: "redis-12535.c239.us-east-1-2.ec2.redns.redis-cloud.com",
  port: 12535,
  username: "default",
  password: "Zh53FQHrGfyo0Y9Q8RENHYzl9cNHZnef",
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
