import { sendResponse } from "@/common/utils/send-response";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CloudinaryService } from "./cloudinary.service";
import { DeleteTempImageDto } from "./dto/delete-temp-image.dto";

@Controller("cloudinary")
export class CloudinaryController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  // Called by the frontend when a temp upload is abandoned (e.g. the user
  // picks an avatar but cancels instead of saving). Best-effort cleanup.
  @Post("delete-temp")
  @HttpCode(HttpStatus.OK)
  async deleteTemp(@Body() dto: DeleteTempImageDto) {
    await this.cloudinary.deleteTemp(dto.publicId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Temporary image deleted",
      data: null,
    });
  }
}
