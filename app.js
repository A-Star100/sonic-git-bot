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

  app.on("issue_comment.created", async (context) => {
  const commentBody = context.payload.comment.body.toLowerCase();

  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;

  // Determine issue or PR number
  const issueNumber =
    context.payload.issue?.number ??
    context.payload.pull_request?.number;

  if (!issueNumber) {
    app.log.warn("No issue or PR number found on comment event.");
    return;
  }

  // === Labeling logic for help and bug ===
  const labels = [];
  if (commentBody.includes("help")) labels.push("help wanted");
  if (commentBody.includes("bug")) labels.push("bug");

  if (labels.length) {
    await context.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });

    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `Heard you! I've tagged this with: ${labels.join(
        ", "
      )}. This game of tag is starting to become a bit tiring, actually.`,
    });

    // Return early so the release logic doesn't run on these comments
    return;
  }

  // === Release creation conversation ===
  const triggerWords = ["create release", "release changes", "release"];
  const isTrigger = triggerWords.some((word) =>
    commentBody.includes(word)
  );

  const isConfirmation = commentBody.trim() === "yes";

 // Fetch last 5 comments sorted newest first
const comments = await context.octokit.issues.listComments({
  owner,
  repo,
  issue_number: issueNumber,
  per_page: 5,
  direction: "desc",
});

// Get the very latest comment
const lastComment = comments.data[0];
const botAskedForConfirmation =
  lastComment &&
  lastComment.user.type === "Bot" &&
  lastComment.body.includes(
    "Do you want to create a release? Reply with yes or no."
  );
    
  if (isTrigger && !botAskedForConfirmation) {
    // Ask for confirmation
    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body:
        "I see you want to create a release. Do you want to create a release? Reply with yes or no.",
    });
    return;
  }

  if (isConfirmation && botAskedForConfirmation) {
    const tagName = "v1.0.0"; // customize as needed
    const releaseName = `Release ${tagName}`;
    const releaseBody = "This release was created automatically via Probot.";

    try {
      const release = await context.octokit.repos.createRelease({
        owner,
        repo,
        tag_name: tagName,
        name: releaseName,
        body: releaseBody,
        draft: false,
        prerelease: false,
      });

      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `Release created successfully: ${release.data.html_url}`,
      });
    } catch (error) {
      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `Oops! Something went wrong while creating the release: ${error.message}`,
      });
    }
  }
});


  // pull requests
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
