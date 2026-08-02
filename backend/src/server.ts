import "dotenv/config";
import "express-async-errors";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { customersRouter } from "./routes/customers.js";
import { paymentsRouter } from "./routes/payments.js";
import { reportsRouter } from "./routes/reports.js";
import { superAdminRouter } from "./routes/superAdmin.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/super-admin", superAdminRouter);
app.use("/api/admin", adminRouter);
app.use("/api/customers", customersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/reports", reportsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof z.ZodError) {
    const issue = err.issues[0];
    const field = issue?.path.join(" ");
    const message = issue?.message.startsWith("Please ")
      ? issue.message
      : issue?.message.toLowerCase().includes("email")
      ? "Please Enter A Valid Email Address."
      : field
        ? `Please Check ${field}.`
        : "Please Check The Details And Try Again.";
    return res.status(400).json({ message });
  }
  res.status(400).json({ message: err instanceof Error ? err.message : "Something went wrong." });
});

app.listen(port, () => {
  console.log(`Customer Management API running on http://localhost:${port}`);
});
