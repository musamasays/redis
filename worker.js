

import redis from "./redis.js";
import { Worker } from "bullmq";

// Define the worker
const emailWorker = new Worker(
    'myQueue', 
    async (job) => {
        const { to, subject, message } = job.data;

        try {
           
            console.log(`Email sent to: ${to}`);
        } catch (err) {
            console.error('Error sending email:', err);
        }
    }, 
    {
        connection: redis,  // Provide the Redis connection to the worker
    }
);