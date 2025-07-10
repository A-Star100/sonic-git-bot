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

  // === ISSUE COMMENTS ===
  app.on("issue_comment.created", async (context) => {
    const comment = context.payload.comment.body.toLowerCase();

    const labels = [];
    if (comment.includes("help")) labels.push("help wanted");
    if (comment.includes("bug")) labels.push("bug");

    if (labels.length) {
      await context.octokit.issues.addLabels(
        context.issue({ labels })
      );

      await context.octokit.issues.createComment({
        ...context.issue(),
        body: `Heard you! I've tagged this with: ${labels.join(", ")}. This game of tag is starting to become a bit tiring, actually.`,
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
