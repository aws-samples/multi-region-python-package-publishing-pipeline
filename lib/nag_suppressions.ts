import { NagSuppressions } from 'cdk-nag';
import { PipelineProject } from 'aws-cdk-lib/aws-codebuild';

import { Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { Policy } from 'aws-cdk-lib/aws-iam';

/* 
  Add CDK Nag suppressions for this CDK Stack 
*/
export const MyNagSuppressions = ({
  packageBuildProject,
  publishPackageProject,
  packagePipeline,
  codeArtifactAccessPolicy,
}: {
  packageBuildProject: PipelineProject;
  publishPackageProject: PipelineProject;
  packagePipeline: Pipeline;
  codeArtifactAccessPolicy: Policy;
}) => {
  NagSuppressions.addResourceSuppressions(
    packageBuildProject,
    [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'CustomPackageBuildProject is an L3 Construct (aws_codebuild.PipelineProject) that orchestrates several IAM Roles/Policies. All wildcards are deeply prefixed',
      },
    ],
    true
  );
  NagSuppressions.addResourceSuppressions(
    publishPackageProject,
    [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'PublishPackageProject is an L3 Construct (aws_codebuild.PipelineProject) that orchestrates several IAM Roles/Policies. All wildcards are deeply prefixed',
      },
    ],
    true
  );
  NagSuppressions.addResourceSuppressions(
    packagePipeline,
    [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'PackagePipeline Resources use default policies that allow S3 and KMS actions',
      },
    ],
    true
  );
  NagSuppressions.addResourceSuppressions(
    codeArtifactAccessPolicy,
    [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Only allows access to the 2 CodeArtifact Repository Resources',
      },
    ],
    true
  );
};
