import crypto from "crypto";

export const generateToken = () => crypto.randomBytes(32).toString("hex");

export const futureDate = (days = 7) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);
