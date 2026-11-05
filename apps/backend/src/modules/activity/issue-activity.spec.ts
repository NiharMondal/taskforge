import { IssueSnapshot, issueChanges } from "./issue-activity";

describe("issueChanges", () => {
  const bug = { id: "label-bug", name: "Bug", color: "#ef4444" };
  const ui = { id: "label-ui", name: "UI", color: "#3b82f6" };
  const before: IssueSnapshot = {
    title: "Login fails",
    description: "<p>Steps</p>",
    status: "TODO",
    priority: "MEDIUM",
    type: "TASK",
    timeEstimate: 3,
    assignee: { id: "user-a", name: "Alice" },
    sprint: null,
    labels: [bug],
  };

  it("reports nothing when nothing was sent", () => {
    expect(issueChanges(before, {})).toEqual([]);
  });

  it("reports nothing when every sent value equals the stored one", () => {
    expect(
      issueChanges(before, {
        title: "Login fails",
        description: "<p>Steps</p>",
        status: "TODO",
        timeEstimate: 3,
        assignee: { id: "user-a", name: "Alice (renamed since)" },
        sprint: null,
        labels: [bug],
      }),
    ).toEqual([]);
  });

  it("reports each changed field with its old and new value", () => {
    expect(
      issueChanges(before, {
        title: "Login fails on Safari",
        status: "IN_PROGRESS",
        priority: "HIGH",
        type: "BUG",
        timeEstimate: null,
      }),
    ).toEqual([
      { field: "title", from: "Login fails", to: "Login fails on Safari" },
      { field: "status", from: "TODO", to: "IN_PROGRESS" },
      { field: "priority", from: "MEDIUM", to: "HIGH" },
      { field: "type", from: "TASK", to: "BUG" },
      { field: "timeEstimate", from: 3, to: null },
    ]);
  });

  it("notes a description change without keeping the text", () => {
    expect(issueChanges(before, { description: "<p>New</p>" })).toEqual([
      { field: "description" },
    ]);
  });

  it("treats a cleared description the same as an empty one", () => {
    expect(
      issueChanges({ ...before, description: null }, { description: "" }),
    ).toEqual([]);
  });

  it("names people and sprints, and records clearing them as null", () => {
    expect(
      issueChanges(before, {
        assignee: null,
        sprint: { id: "sprint-1", name: "Sprint 1" },
      }),
    ).toEqual([
      { field: "assignee", from: { id: "user-a", name: "Alice" }, to: null },
      { field: "sprint", from: null, to: { id: "sprint-1", name: "Sprint 1" } },
    ]);
  });

  it("reports labels as added and removed, not as whole lists", () => {
    expect(issueChanges(before, { labels: [ui] })).toEqual([
      { field: "labels", added: [ui], removed: [bug] },
    ]);
    expect(issueChanges(before, { labels: [] })).toEqual([
      { field: "labels", added: [], removed: [bug] },
    ]);
  });
});
