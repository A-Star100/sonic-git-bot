/**
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log("Yay! The app was loaded!");

  app.on("issues.opened", async (context) => {
    return context.octokit.issues.createComment(
      context.issue({ body: "Hey there! Thanks for opening your issue! We'll review it faster than the speed of sound!" })
    );
  });

  // Pull Requests opened
  app.on("pull_request.opened", async (context) => {
    const pr = context.payload.pull_request;
    const sender = context.payload.sender.login;

    return context.octokit.issues.createComment({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      issue_number: pr.number,
      body: `Thanks for the PR, @${sender}! We'll review it soon! Gotta go fast! 🚀`,
    });
  });
};
