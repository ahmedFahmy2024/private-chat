import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { authMiddleware } from "./auth";
import { realtime, RealtimeMessage } from "@/lib/realtime";

const ROOM_TTL_SECONDS = 60 * 10; // 10 minutes

const rooms = new Elysia({ prefix: "/room" }).post("/create", async () => {
  const roomId = nanoid();

  await redis.hset(`meta:${roomId}`, {
    connected: [],
    createdAt: Date.now(),
  });

  await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS);

  return { roomId };
});

const messages = new Elysia({ prefix: "/messages" }).use(authMiddleware).post(
  "/",
  async ({ body, auth }) => {
    const { sender, text } = body;
    const { roomId } = auth;
    const roomExists = await redis.exists(`meta:${roomId}`);

    if (!roomExists) {
      throw new Error("Room does not exist");
    }

    const message: RealtimeMessage = {
      id: nanoid(),
      sender,
      text,
      timestamp: Date.now(),
      roomId,
    };

    // add message to history
    await redis.rpush(`messages:${roomId}`, { ...message, token: auth.token });
    await realtime.channel(roomId).emit("chat.message", message);

    // houseKeeping
    const remaining = await redis.ttl(`meta:${roomId}`);

    await redis.expire(`messages:${roomId}`, remaining);
    await redis.expire(`history:${roomId}`, remaining);
    await redis.expire(roomId, remaining);
  },
  {
    query: z.object({
      roomId: z.string(),
    }),
    body: z.object({
      sender: z
        .string()
        .max(100, "Sender name must be at most 100 characters long"),
      text: z
        .string()
        .max(1000, "Message must be at most 1000 characters long"),
    }),
  },
);

export const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages);

export type App = typeof app;

export const GET = app.fetch;
export const POST = app.fetch;
