/**
 * @param {import('probot').Probot} app
 */

// for moderation
const toxicWords = [
  "stupid",
  "idiot",
  "dumb",
  "shut up",
  "hate",
  "kill",
  "moron",
  "you suck",
    "sucks"
    ];

module.exports = (app) => {
  app.log("App loaded!");

  // === ISSUES ===
  app.on("issues.opened", async (context) => {
    const { title, body } = context.payload.issue;
  const content = `${title} ${body}`.toLowerCase();

  // === Toxicity Check ===
  const toxicRegex = new RegExp(`\\b(${toxicWords.join("|")})\\b`, "i");
  const toxicMatch = toxicRegex.test(content);
  if (toxicMatch) {
    await context.octokit.issues.createComment(
      context.issue({
        body: `⚠️ Please keep discussions respectful. This issue may violate our Code of Conduct.`,
      })
    );
    return; // Stop further processing if toxic
  }

    const labels = [];
    const fixedBug = content.includes("fix") && !content.includes("prefix");

    if (content.includes("help")) labels.push("help wanted");
    if (content.includes("bug") && !fixedBug) labels.push("bug");

    if (labels.length && !fixedBug) {
      await context.octokit.issues.addLabels(context.issue({ labels }));
      await context.octokit.issues.createComment(
        context.issue({ body: `Thanks! I've added the label(s): ${labels.join(", ")}. Gotta go fast!` })
      );
    } else if (fixedBug) {
      await context.octokit.issues.createComment(
        context.issue({ body: `Thanks for your fix! A maintainer will review it real fast!` })
      );
    }
  });

  // === ISSUE COMMENTS ===
  async function ensureLabelExists(context, label) {
    const { owner, repo } = context.repo();
    try {
      await context.octokit.issues.getLabel({ owner, repo, name: label });
    } catch (error) {
      if (error.status === 404) {
        await context.octokit.issues.createLabel({
          owner,
          repo,
          name: label,
          color: "ededed",
          description: `Automatically created label: ${label}`,
        });
      } else {
        throw error;
      }
    }
  }

  app.on("issue_comment.created", async (context) => {
  const commentBody = context.payload.comment.body.toLowerCase();
  const issue = context.issue();

  // === Basic Toxicity Detection ===
  const toxicRegex = new RegExp(`\\b(${toxicWords.join("|")})\\b`, "i");
  const toxicMatch = toxicRegex.test(content);
  if (toxicMatch) {
    await context.octokit.issues.createComment({
      ...issue,
      body: `⚠️ Please keep discussions respectful. This comment may violate our Code of Conduct.`,
    });
    return; // Skip labeling if it's toxic
  }
    
  const comment = context.payload.comment.body.toLowerCase();
    
  // Get current labels on the issue
  const { data: currentLabels } = await context.octokit.issues.listLabelsOnIssue(issue);
  const currentLabelNames = currentLabels.map(label => label.name);

  const labelsToAdd = [];
  const labelsToRemove = [];

  if (comment.includes("help") && !currentLabelNames.includes("help wanted")) labelsToAdd.push("help wanted");
  if (comment.includes("bug") && !comment.includes("fix") && !currentLabelNames.includes("bug")) labelsToAdd.push("bug");

  if (comment.includes("fixed") && !comment.includes("prefix") && !currentLabelNames.includes("fix")) {
    await ensureLabelExists(context, "fix");
    labelsToAdd.push("fix");
  }

  // Detect "remove [label]" commands
  const removeRegex = /remove\s+([\w\s-]+)/g;
  let match;
  while ((match = removeRegex.exec(comment)) !== null) {
    if (currentLabelNames.includes(match[1].trim())) {
      labelsToRemove.push(match[1].trim());
    }
  }

  if (labelsToAdd.length) {
    await context.octokit.issues.addLabels({
      ...issue,
      labels: labelsToAdd,
    });

    await context.octokit.issues.createComment({
      ...issue,
      body: `Added label(s): ${labelsToAdd.join(", ")}`,
    });
  }

  if (labelsToRemove.length) {
    for (const label of labelsToRemove) {
      try {
        await context.octokit.issues.removeLabel({
          ...issue,
          name: label,
        });
      } catch {
        // Ignore errors if label was not on issue
      }
    }

    await context.octokit.issues.createComment({
      ...issue,
      body: `Removed label(s): ${labelsToRemove.join(", ")}`,
    });
  }
});
  // === PULL REQUESTS ===
  app.on("pull_request.opened", async (context) => {
    const { title, body, labels } = context.payload.pull_request;
    const content = `${title} ${body}`.toLowerCase();

    if (content.includes("fix") || content.includes("fixed")) {
      const existingLabels = labels.map(label => label.name);
      if (!existingLabels.includes("fix")) {
        await context.octokit.issues.addLabels({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          issue_number: context.payload.pull_request.number,
          labels: ["fix"],
        });

        await context.octokit.issues.createComment({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          issue_number: context.payload.pull_request.number,
          body: "Hey guy! Thanks for the fix! 🚀 I've added the `fix` label. Take care!",
        });
      }
    }
  });
};
