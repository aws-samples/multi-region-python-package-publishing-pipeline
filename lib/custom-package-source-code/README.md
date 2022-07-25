# Custom Package Source Code

This is a repository to define your custom pip packages. Deploy them to CodeCommit's main branch and watch as the MultiRegionPackagePublishing CodePipeline begins execution and deploys to CodeArtifact Repositories in multiple regions.

## Publish a package change

#### Option 1

Make a commit directly in the CodeCommit Service Console

- Navigate to CodeCommit > Repositories > PackageSourceCode > `setup.py`
- Click the **Edit** button
- Update the line defining the package version to now be `version = '1.1.0'`
- Commit Changes to Main Branch
  - Add your name as **Author Name**
  - Add your email address as ** Email Address**
  - Click the **Commit** button to directly update the `main` branch

#### Option 2

Clone this repository to your local environment (using the [git-remote-codecommit](https://docs.aws.amazon.com/codecommit/latest/userguide/setting-up-git-remote-codecommit.html?icmpid=docs_acc_console_connect) tool)

- `git clone codecommit::us-east-1://PackageSourceCode`
- Modify `./PackageSourceCode/setup.py` to mark this package version as `1.1.0`
- `git add .`
- `git commit -m "Updating version of my custom pip package"`
- `git push`

## Watch the Pipeline

Navigate to `CodePipeline > Pipelines > packagePipeline` to watch your updated source code trigger the building and publishing of your custom pip package to multiple regions!
**Note:** provisioning the build container in the build and publish phases can take around 3 minutes. Total pipeline should finish in **~7 minutes**.

Upon pipeline completion, navigate to `CodeArtifact > Repositories > package-artifact-repo` to see your `mypippackage` with your the newest version published
