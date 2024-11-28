import { Redis } from '@upstash/redis';

if (!process.env.REDIS_URL || !process.env.REDIS_SECRET) {
  throw new Error('REDIS_URL and REDIS_SECRET environment variables are required');
}

export const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_SECRET
});