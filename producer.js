import { Queue } from "bullmq";
import redis from "./redis.js"; // use `.js` explicitly in imports

const queue = new Queue("myQueue", {
  connection: redis,
});

(async () => {
  await queue.add("myQueue", {
    to: "test@gmail.com",
    subject: "test",
    message: "test",
  });
  console.log("✅ Job added to the queue!");
})();
