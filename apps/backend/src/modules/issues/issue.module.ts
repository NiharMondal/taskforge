import { Module } from "@nestjs/common";
import { AssignedIssuesController } from "./assigned-issues.controller";
import { IssueController } from "./issue.controller";
import { IssueService } from "./issue.service";

@Module({
  controllers: [IssueController, AssignedIssuesController],
  providers: [IssueService],
  exports: [IssueService],
})
export class IssueModule {}
