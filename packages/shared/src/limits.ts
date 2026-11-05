/**
 * Field limits the backend's DTOs enforce and the web's forms check before
 * sending. One value per rule, so a form can't accept what the API refuses.
 */

/** Names of workspaces, projects, sprints and people. */
export const MAX_NAME_LENGTH = 100;
export const MIN_WORKSPACE_NAME_LENGTH = 3;
export const MIN_PROJECT_NAME_LENGTH = 2;
export const MIN_USER_NAME_LENGTH = 2;

/** Workspace and project descriptions, and sprint goals. */
export const MAX_DESCRIPTION_LENGTH = 500;

export const MIN_ISSUE_TITLE_LENGTH = 2;
export const MAX_ISSUE_TITLE_LENGTH = 255;
/** The editor's HTML, so formatting counts toward it. */
export const MAX_ISSUE_DESCRIPTION_LENGTH = 2000;
/** The editor's HTML, like an issue description. */
export const MAX_COMMENT_LENGTH = 2000;

/** Upper bound for `Issue.timeEstimate`, which holds story points. */
export const MAX_STORY_POINTS = 100;
/** How many labels one issue can carry. */
export const MAX_ISSUE_LABELS = 10;
export const MAX_LABEL_NAME_LENGTH = 30;
export const MAX_ROLE_NAME_LENGTH = 50;

/** For new passwords. bcrypt only reads the first 72 bytes. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/** `?limit=` on paginated lists: the default page and the most one page holds. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
