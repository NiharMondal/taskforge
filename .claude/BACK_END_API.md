# Backend endpoint

Update always implement PATCH Method

- Root endpoint: http://localhost:5001/api/v1
- Users: /users
- Auth: /auth -> register: /register, login: login
- Workspaces: /workspaces(GET,POST) (workspace create when user register),
    - :workspaceId(GET, UPDATE, DELETE)
- Memberships: /memberships(GET-> all members of a workspace) @workspaceId from header: x-workspace-Id
    - :userId(GET, UPDATE, DELETE)
- Invitations: /invitations(GET, POST)
    - /validate(GET)
    - /accept(POST)
    - :id(DELETE)
- Projects: /projects(GET, POST)
    - :projectId(GET, UPDATE, DELETE)
- Sprints: /projects/:projectId/sprints(GET, POST),
    - :sprintId/start(UPDATE)
    - :sprintId/end(UPDATE)
- Issues: /projects/:projectId/issues(GET, POST)
    - :issueId(GET, UPDATE, DELETE)
    - board order: POST assigns `rank` itself (end of the lane, client value ignored);
      PATCH accepts `rank` (base-62 fractional index) with `status` and stores it as sent —
      a status change with no `rank` is appended to the target lane. `?sort=rank` is allowed.

**Upcoming**

- Comments: /comments(GET, POST)
    - :commentId(GET, UPDATE, DELETE)
- Label: /labels(GET, POST)
    - :commentId(GET, UPDATE, DELETE)
- Subscriptions: /labels(GET, POST)
    - :commentId(GET, UPDATE, DELETE)
- AuditLog: /audit-log(GET, POST)
    - :commentId(GET, UPDATE, DELETE)
