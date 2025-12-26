import { type NextRequest, NextResponse } from "next/server";
import { redis } from "./lib/redis";
import { nanoid } from "nanoid";

export const proxy = async (req: NextRequest) => {
  //   console.log("req", req);

  // OVERVIEW: CHECK IF USER IS ALLOWED TO JOIN ROOM
  // IF THEY ARE: LET THEM PASS
  // IF THEY ARE NOT: SEND THEM BACK TO LOBBY

  const pathname = req.nextUrl.pathname;
  //   console.log("pathname", pathname);

  const roomMatch = pathname.match(/^\/room\/([^/]+)$/);
  //   console.log("roomMatch", roomMatch);

  if (!roomMatch) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const roomId = roomMatch[1];
  //   console.log("roomId", roomId);

  const meta = await redis.hgetall<{ connected: string[]; createdAt: number }>(
    `meta:${roomId}`,
  );
  //   console.log("meta", meta);

  if (!meta) {
    return NextResponse.redirect(new URL("/?error=room_not_found", req.url));
  }

  const existingToken = req.cookies.get("x-auth-token")?.value;
  //   console.log("existingToken", existingToken);

  //   USER IS ALLOWED TO JOIN ROOM
  if (existingToken && meta.connected.includes(existingToken)) {
    return NextResponse.next();
  }

  //   USER IS NOT ALLOWED TO JOIN ROOM
  if (meta.connected.length >= 2) {
    return NextResponse.redirect(new URL("/?error=room_full", req.url));
  }

  const response = NextResponse.next();
  //   console.log("response", response);
  const token = nanoid();
  response.cookies.set("x-auth-token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  //   console.log("response", response);

  await redis.hset(`meta:${roomId}`, {
    ...meta,
    connected: [...meta.connected, token],
  });

  return response;
};

export const config = {
  matcher: "/room/:path*",
};

// matcher: "/room/:path*" means that it will match any path that starts with /room/ and has any number of segments after it.
// pathname /room/rWwEKm7lMX84T5o6wrPGg
// roomMatch [
//   '/room/rWwEKm7lMX84T5o6wrPGg',
//   'rWwEKm7lMX84T5o6wrPGg',
//   index: 0,
//   input: '/room/rWwEKm7lMX84T5o6wrPGg',
//   groups: undefined
// ]
// meta { connected: [], createdAt: 1766765519639 }
// const response = NextResponse.next(); This means: “Everything is valid — load the page.”

// const token = nanoid();
// response.cookies.set("x-auth-token", token, {
//   path: "/",
//   httpOnly: true,
//   secure: process.env.NODE_ENV === "production",
//   sameSite: "strict",
// });
// Creates a secure random token
// Stores it as a cookie:
// Token can be used for:
// WebSocket auth
// Room actions
// Message validation
// httpOnly → JS cannot read it (XSS protection)
// sameSite: "strict" → CSRF protection
// secure → HTTPS only in production

// existingToken { name: 'x-auth-token', value: 'gEO4Ef7RRLaGbPzexCsoa' }

//   if (existingToken && meta.connected.includes(existingToken)) {
//     return NextResponse.next();
//   }
// that mean user is already in the room so allow him to join

//   if (meta.connected.length >= 2) {
//     return NextResponse.redirect(new URL("/?error=room_full", req.url));
//   }
// that mean room is full so redirect user to lobby we determine room number of users by 2

// req Request {
//   method: 'GET',
//   url: 'http://localhost:3000/room/rWwEKm7lMX84T5o6wrPGg',
//   headers: Headers {
//     host: 'localhost:3000',
//     connection: 'keep-alive',
//     pragma: 'no-cache',
//     'cache-control': 'no-cache',
//     'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
//     'sec-ch-ua-mobile': '?0',
//     'sec-ch-ua-platform': '"Windows"',
//     'upgrade-insecure-requests': '1',
//     'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
//     accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
//     'sec-fetch-site': 'same-origin',
//     'sec-fetch-mode': 'navigate',
//     'sec-fetch-user': '?1',
//     'sec-fetch-dest': 'document',
//     referer: 'http://localhost:3000/room/rWwEKm7lMX84T5o6wrPGg',
//     'accept-encoding': 'gzip, deflate, br, zstd',
//     'accept-language': 'en-US,en;q=0.9,ar;q=0.8',
//     cookie: 'ZAD_LOCALE=ar; authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiQUJybnRKd0N3WUQ1aE1LMEdITjhUbUJYUGdwS3lqMllmMnlKc1V4dTltdXZUd3ozZTNFTHdRQXVYMGJJWTd6eERIdkl0bnF2ZF9vZEU5YlpnSmt0Y2cifQ..FjcDkNtfEQntxVHk_Y_jFw.ijKeaLQtWcZ0C98bw2zIfh-Q7xcs1tsGOJC4OWoFPjHQBGtbsdUfIe5KaGEW5f2QBJ0HAxmNBGShS17pVtkaS-FUBkTuTKJEH5kjnMGRwPmP9JZXDEqB9cET3vLFVDS_HnpmB0QW5X_sZI9p9MfaiqT8gv37vv2elsiCbgHfXQiuXYEKfRw-oREXfVCVWnuew6OayyqFnfYZNW7f986Q2nR8kFCRmnXep4M-cBgQ4jrBwmv-IZbAqmvYqQGVhb3cdacW--kIhv-txBrkZeugvDvKVY5kHFYsyEl9LJqHpVvFSqce14Z3kwG07KpyK5m3brOcqZykN_SoiBk2dHcLGz_EYvhcqZMJ0CFFz0Yfb0MzPKiJh2RycSk4mkPSAwpyR4f0mY16h9fLEFHTwOHIDKW3mWzh1zUbvOFPdUssVImUVyzrQDlAc_SL5xdGy0fFJapFfSmzUZwR0RF2P7gkbaZMXJHguDLCw3mxKSN-0R4Tx3u0HwGwazDsiQvsFRBVddzH_MFKOSOiiUvVwwlk4EELd_Gyb4RMhm125s7wKloX82Jv97ljqHitrXP-TSnj350wFhxwDNe7Rt6UaMq0vTwuhE11B25IXdYJuUGOfzDooF6eAPPKe2BV6Q0nerTr.Q2X6CvZeANkfM8T2xqcGxz-M5BmiUJudccHzFpd9DFU; __clerk_db_jwt=dvb_36cmGoam7C4OklXg2j6zzjJkmjz; __clerk_db_jwt_sdFi8XfT=dvb_36cmGoam7C4OklXg2j6zzjJkmjz; __refresh_sdFi8XfT=ZpnMF9p07VPEBuR847Ua; __session=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zNmNqSlV4eWQzTVpVMXFaSmRWNkp1VGVjQXQiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NjU0MDEwMzYsImZ2YSI6WzQyLC0xXSwiaWF0IjoxNzY1NDAwOTc2LCJpc3MiOiJodHRwczovL2J1c3ktY2hpY2tlbi0zMS5jbGVyay5hY2NvdW50cy5kZXYiLCJuYmYiOjE3NjU0MDA5NjYsInNpZCI6InNlc3NfMzZmWDlrbXduVlpXWkcyQkh4R0tpNW5nMUllIiwic3RzIjoiYWN0aXZlIiwic3ViIjoidXNlcl8zNmZYOWhVTGZweW1iMXQzS2VMV3l6OEN6Q1IiLCJ2IjoyfQ.GeAujGy3i4kCSNBVbjN0b92qBDOT-qugbGEJLqDJHcXcjCipRNJiZkGPmB-t8-0WM_O_bG6LMZydldfPJFT2ndqNAmRsUp0Xk9_xYJ4aCw7n1xrtWL2GoxXmfwWR6GZuAi_aZctKBo5rzz1xBT4trYyJRcQe_HKeZ6yMqSV4GJp1D7XaMd5dx3zxwMddMGlj_KqD9YdGE8-bgV-gbglPpPYx8aYKvzmu_oVPdc1Mqzjr4Ks_YW4JeMEmTgkZ-uH6RxRdHMcPDCr3fn6hCPTLSmedgfKrHFa7DrpS642WWzTXGZc5U67kvTJb9b1BEXwQIQV9wKWetJ1-a4pC0q26nQ; __session_sdFi8XfT=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zNmNqSlV4eWQzTVpVMXFaSmRWNkp1VGVjQXQiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NjU0MDEwMzYsImZ2YSI6WzQyLC0xXSwiaWF0IjoxNzY1NDAwOTc2LCJpc3MiOiJodHRwczovL2J1c3ktY2hpY2tlbi0zMS5jbGVyay5hY2NvdW50cy5kZXYiLCJuYmYiOjE3NjU0MDA5NjYsInNpZCI6InNlc3NfMzZmWDlrbXduVlpXWkcyQkh4R0tpNW5nMUllIiwic3RzIjoiYWN0aXZlIiwic3ViIjoidXNlcl8zNmZYOWhVTGZweW1iMXQzS2VMV3l6OEN6Q1IiLCJ2IjoyfQ.GeAujGy3i4kCSNBVbjN0b92qBDOT-qugbGEJLqDJHcXcjCipRNJiZkGPmB-t8-0WM_O_bG6LMZydldfPJFT2ndqNAmRsUp0Xk9_xYJ4aCw7n1xrtWL2GoxXmfwWR6GZuAi_aZctKBo5rzz1xBT4trYyJRcQe_HKeZ6yMqSV4GJp1D7XaMd5dx3zxwMddMGlj_KqD9YdGE8-bgV-gbglPpPYx8aYKvzmu_oVPdc1Mqzjr4Ks_YW4JeMEmTgkZ-uH6RxRdHMcPDCr3fn6hCPTLSmedgfKrHFa7DrpS642WWzTXGZc5U67kvTJb9b1BEXwQIQV9wKWetJ1-a4pC0q26nQ; __client_uat_sdFi8XfT=1765398450; __client_uat=1765398450; __next_hmr_refresh_hash__=71',
//     'x-forwarded-host': 'localhost:3000',
//     'x-forwarded-port': '3000',
//     'x-forwarded-proto': 'http',
//     'x-forwarded-for': '::1'
//   },
//   destination: '',
//   referrer: 'about:client',
//   referrerPolicy: '',
//   mode: 'cors',
//   credentials: 'same-origin',
//   cache: 'default',
//   redirect: 'follow',
//   integrity: '',
//   keepalive: false,
//   isReloadNavigation: false,
//   isHistoryNavigation: false,
//   signal: AbortSignal { aborted: false }
// }

// response without token
// response Response {
//   status: 200,
//   statusText: '',
//   headers: Headers { 'x-middleware-next': '1' },
//   body: null,
//   bodyUsed: false,
//   ok: true,
//   redirected: false,
//   type: 'default',
//   url: ''
// }

// response with token
// response Response {
//   status: 200,
//   statusText: '',
//   headers: Headers {
//     'x-middleware-next': '1',
//     'set-cookie': 'x-auth-token=gEO4Ef7RRLaGbPzexCsoa; Path=/; HttpOnly; SameSite=strict',
//     'x-middleware-set-cookie': 'x-auth-token=gEO4Ef7RRLaGbPzexCsoa; Path=/; HttpOnly; SameSite=strict'
//   },
//   body: null,
//   bodyUsed: false,
//   ok: true,
//   redirected: false,
//   type: 'default',
//   url: ''
// }
