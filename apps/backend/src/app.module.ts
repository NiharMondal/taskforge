import { AppController } from "@/app.controller";
import { AppService } from "@/app.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { AuthModule } from "@/modules/auth/auth.module";
import { UserModule } from "@/modules/user/user.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { CloudinaryModule } from "@/cloudinary/cloudinary.module";
import { InvitationModule } from "./modules/invitations/invitation.module";
import { IssueModule } from "./modules/issues/issue.module";
import { MembershipModule } from "./modules/memberships/membership.module";
import { ProjectModule } from "./modules/projects/project.module";
import { SprintModule } from "./modules/sprints/sprint.module";
import { WorkspaceModule } from "./modules/workspace/workspace.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CloudinaryModule,
    AuthModule,
    UserModule,
    WorkspaceModule,
    MembershipModule,
    InvitationModule,
    ProjectModule,
    IssueModule,
    SprintModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
