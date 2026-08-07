import nodemailer from "nodemailer";

type PaymentEmailInput = {
  organisationId: string;
  organisationName: string;
  customerId: string;
  customerCode: string | null;
  customerName: string;
  cablePlan: string;
  internetPlan: string;
  amount: number;
  mode: string;
  collectorName: string;
  paidAt: Date;
  periods: string;
  recipients: string[];
};

const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const dateTime = (date: Date) => new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata"
}).format(date);

export async function sendPaymentReceivedEmail(input: PaymentEmailInput) {
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== "true") return;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM ?? user;
  const recipients = input.recipients.length ? input.recipients : emailList(process.env.EMAIL_ALERT_TO);

  if (!host || !user || !pass || !from || !recipients.length) return;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  const subject = `${input.organisationName}: Payment Received - ${input.customerCode ?? input.customerId}`;
  const text = [
    "Payment Received",
    "",
    `Organisation: ${input.organisationName}`,
    `Customer ID: ${input.customerCode ?? input.customerId}`,
    `Customer: ${input.customerName}`,
    `Cable Plan: ${input.cablePlan}`,
    `Internet Plan: ${input.internetPlan}`,
    `Bill Month: ${input.periods}`,
    `Amount: ${money(input.amount)}`,
    `Mode: ${input.mode}`,
    `Collector: ${input.collectorName}`,
    `Time: ${dateTime(input.paidAt)}`
  ].join("\n");

  await transporter.sendMail({
    from,
    to: recipients.join(","),
    subject,
    text
  });
}

function emailList(value: string | undefined) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}
