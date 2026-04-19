import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { verifyToken } from "./lib/auth";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Activity logging middleware ──────────────────────────────────
// Logs every mutating API request (POST/PUT/PATCH/DELETE) after the response is sent
app.use((req: Request, res: Response, next: NextFunction) => {
  // Only log write operations on /api routes
  if (!["POST","PUT","PATCH","DELETE"].includes(req.method) || !req.path.startsWith("/api")) {
    return next();
  }

  // Skip auth endpoints to avoid noise
  if (req.path.startsWith("/api/auth/")) return next();

  res.on("finish", () => {
    try {
      // Extract user from JWT (best effort, don't fail request if missing)
      let userEmail = "anonymous";
      let userName = "";
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) {
        try {
          const payload = verifyToken(auth.slice(7)) as any;
          userEmail = payload?.email ?? "anonymous";
          userName  = payload?.name ?? payload?.email ?? "";
        } catch {}
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
               ?? req.socket?.remoteAddress
               ?? "";

      const action = `${req.method} ${req.path.replace(/\/api\/?/, "").split("/").slice(0, 3).join("/")}`;

      pool.query(
        `INSERT INTO activity_logs (user_email, user_name, method, url, action, status_code, ip_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userEmail, userName, req.method, req.path, action, res.statusCode, ip]
      ).catch(() => {}); // silent fail — don't break the app if logging fails
    } catch {}
  });

  next();
});

app.use("/api", router);

export default app;
