/**
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log("App loaded!");

  // === ISSUES ===
  app.on("issues.opened", async (context) => {
    const { title, body } = context.payload.issue;
    const content = `${title} ${body}`.toLowerCase();

    const labels = [];
    if (content.includes("help")) labels.push("help wanted");
    if (content.includes("bug")) labels.push("bug");

    if (labels.length) {
      await context.octokit.issues.addLabels(
        context.issue({ labels })
      );

      await context.octokit.issues.createComment(
        context.issue({ body: `Thanks! I've added the label(s): ${labels.join(", ")}. Gotta go fast!` })
      );
    }
  });

async function ensureLabelExists(context, label) {
  const { owner, repo } = context.repo();
  try {
    await context.octokit.issues.getLabel({ owner, repo, name: label });
  } catch (error) {
    if (error.status === 404) {
      // Label doesn't exist, so create it
      await context.octokit.issues.createLabel({
        owner,
        repo,
        name: label,
        color: "ededed", // Pick any color you like
        description: `Automatically created label: ${label}`,
      });
    } else {
      throw error;
    }
  }
}


app.on("issue_comment.created", async (context) => {
  const comment = context.payload.comment.body.toLowerCase();
  const issue = context.issue();

  const labelsToAdd = [];
  const labelsToRemove = [];

  if (comment.includes("help")) labelsToAdd.push("help wanted");
  if (comment.includes("bug")) labelsToAdd.push("bug");
  if (comment.includes("fixed")) {
    await ensureLabelExists(context, "fix");
    labelsToAdd.push("fix");
  }

  const removeRegex = /remove\s+([\w\s-]+)/g;
  let match;
  while ((match = removeRegex.exec(comment)) !== null) {
    labelsToRemove.push(match[1].trim());
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
      } catch (error) {
        // Ignore if label doesn't exist on issue
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
