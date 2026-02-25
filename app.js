/**
 * @param {import('probot').Probot} app
 */

// moderation
function decodeBase64Array(base64) {
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
}

const toxicWords = decodeBase64Array(
  "WyJzdHVwaWQiLCJpZGlvdCIsImR1bWIiLCJzaHV0IHVwIiwiaGF0ZSIsImtpbGwiLCJtb3JvbiIsInlvdSBzdWNrIiwic3Vja3MiLCJzdWNrZXIiLCJzdWNrZXJzIiwiZG9yayJd"
);



module.exports = (app) => {
  app.log("App loaded!");

  // issues
  app.on("issues.opened", async (context) => {
  const { data: comments } = await context.octokit.issues.listComments(context.issue());
  const hasComments = comments.length > 0;
    
    const { title, body } = context.payload.issue;
  const content = `${title} ${body}`.toLowerCase();

  // matches toxic regex? if so send msg
  const toxicRegex = new RegExp(`\\b(${toxicWords.join("|")})\\b`, "i");
  const toxicMatch = toxicRegex.test(content);
  if (toxicMatch) {
    await context.octokit.issues.createComment(
      context.issue({
        body: `⚠️ Whoa, slow down there! That kind of talk doesn’t fly in this zone. You could get spindashed outta here!`,
      })
    );
    return;
  }

    const labels = [];
    const fixedBug = content.includes("fix") && !content.includes("prefix");

    if (!hasComments) {
    if (content.includes("help")) labels.push("help wanted");
    if (content.includes("bump")) labels.push("version bump");
    if (content.includes("bug") && !fixedBug) labels.push("bug");   
    }



    if (labels.length && !fixedBug) {
      await context.octokit.issues.addLabels(context.issue({ labels }));
      await context.octokit.issues.createComment(
        context.issue({ body: `Thanks! I've added the label(s): ${labels.join(", ")}. Gotta go fast!` })
      );
    } else if (fixedBug) {
      await context.octokit.issues.createComment(
        context.issue({ body: `Thanks for your fix! A maintainer'll review it real fast!` })
      );
    } else {
      await context.octokit.issues.createComment(
        context.issue({ body: `Hey there 👋! Thanks for opening this issue! Contributions are as good as chilli dogs to me! Gotta go fast!` })
      );
    }
  });

  // issue comments
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

  // regex matches (again)
  const toxicRegex = new RegExp(`\\b(${toxicWords.join("|")})\\b`, "i");
  if (toxicRegex.test(commentBody)) {
    await context.octokit.issues.createComment({
      ...issue,
      body: `⚠️ Whoa, slow down there! That kind of talk doesn’t fly in this zone. You could get spindashed outta here!`,
    });
    return;
  }

  const comment = commentBody;

  const { data: currentLabels } = await context.octokit.issues.listLabelsOnIssue(issue);
  const currentLabelNames = currentLabels.map(label => label.name);

  const labelsToAdd = [];
  const labelsToRemove = [];

  // detect remove [label] commands
  const removeRegex = /remove\s+(?:the\s+)?label\s+([\w\s-]+)/gi;
  let match;
  while ((match = removeRegex.exec(comment)) !== null) {
    const labelToRemove = match[1].trim().toLowerCase();
    const existingLabel = currentLabelNames.find(l => l.toLowerCase() === labelToRemove);
    if (existingLabel && !labelsToRemove.includes(existingLabel)) {
      labelsToRemove.push(existingLabel);
    }
  }

  // add labels only if not already there
  if (
    comment.includes("help") &&
    !currentLabelNames.includes("help wanted") &&
    !labelsToRemove.includes("help wanted")
  ) {
    await ensureLabelExists(context, "help wanted");
    labelsToAdd.push("help wanted");
  }

  if (
    comment.includes("bug") &&
    !comment.includes("fix") &&
    !currentLabelNames.includes("bug") &&
    !labelsToRemove.includes("bug")
  ) {
    await ensureLabelExists(context, "bug");
    labelsToAdd.push("bug");
  }

  if (
    comment.includes("fixed") &&
    !comment.includes("prefix") &&
    !currentLabelNames.includes("fix") &&
    !labelsToRemove.includes("fix")
  ) {
    await ensureLabelExists(context, "fix");
    labelsToAdd.push("fix");
  }

  // === Apply label additions ===
  if (labelsToAdd.length) {
    await context.octokit.issues.addLabels({
      ...issue,
      labels: labelsToAdd,
    });

    await context.octokit.issues.createComment({
      ...issue,
      body: `Heard ya, dude! I added label(s): ${labelsToAdd.join(", ")}! I'm excited for some chilli dogs!`,
    });
  }

  // remove the labels
  if (labelsToRemove.length) {
    for (const label of labelsToRemove) {
      try {
        await context.octokit.issues.removeLabel({
          ...issue,
          name: label,
        });
      } catch {
        // ignore err
      }
    }

    await context.octokit.issues.createComment({
      ...issue,
      body: `I removed these labels: ${labelsToRemove.join(", ")}. They've been spindashed outta here, but they can return whenever you want.`,
    });
  }
});


  
  // PRs
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
          body: "Hey guy! Thanks for the fix! 🚀 I added the `fix` label! Take care!",
        });
      }
    } else {
      await context.octokit.issues.createComment(
        context.issue({ body: `Hey there 👋! Thanks for opening your pull request! Contributions are as good as chilli dogs to me! Gotta go fast!` })
      );
    }
  });
};
