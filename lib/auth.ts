import { prisma } from "./prisma";

export async function auth() {
  const user = await prisma.user.findUnique({
    where: {
      id: "827a2a72-ffc2-443b-ae91-f6ea1b7f1b33",
    },
  });
  return user;
}
