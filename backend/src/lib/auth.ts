import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role, User } from "@prisma/client";

const secret = process.env.JWT_SECRET ?? "development-secret";

export type AuthUser = {
  id: string;
  organisationId: string | null;
  role: Role;
  name: string;
  email: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(user: Pick<User, "id" | "organisationId" | "role" | "name" | "email">) {
  return jwt.sign(
    {
      id: user.id,
      organisationId: user.organisationId,
      role: user.role,
      name: user.name,
      email: user.email
    },
    secret,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string) {
  return jwt.verify(token, secret) as AuthUser;
}
