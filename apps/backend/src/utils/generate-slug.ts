import { BadRequestException } from "@nestjs/common";
import slugify from "slugify";

export const generateSlug = (text: string): string => {
  if (!text) {
    throw new BadRequestException("Text is required for slug generation");
  }
  return slugify(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()"!:@]/g,
  });
};
