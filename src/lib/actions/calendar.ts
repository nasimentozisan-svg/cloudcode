"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function generateCalendarTokenAction() {
  const user = await requireAdmin();

  if (user.calendarToken) return user.calendarToken;

  const token = crypto.randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { calendarToken: token },
  });

  revalidatePath("/dashboard");
  return token;
}

export async function resetCalendarTokenAction() {
  const user = await requireAdmin();

  const token = crypto.randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { calendarToken: token },
  });

  revalidatePath("/dashboard");
  return token;
}
