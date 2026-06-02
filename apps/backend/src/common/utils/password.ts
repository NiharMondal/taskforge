import bcryptjs from "bcryptjs";

const hashPassword = async (password: string) => {
  return await bcryptjs.hash(password, 12);
};

const comparePassword = async (password: string, hash: string) => {
  return await bcryptjs.compare(password, hash);
};

export const passwordUtils = {
  hashPassword,
  comparePassword,
};
