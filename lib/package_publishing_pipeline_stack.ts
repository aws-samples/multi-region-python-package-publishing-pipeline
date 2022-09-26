// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CfnOutput, Fn, Stack, StackProps, Arn } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as path from 'path';

import { GenerateCodeArtifactArns } from './helpers';
import { MyNagSuppressions } from './nag_suppressions';

export interface PublishPipelineStackProps extends StackProps {
  domainName: string;
  repositoryName: string;
  primaryRegion: string;
  replicaRegions: string[];
}

export class MultiRegionPackagePublishingPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: PublishPipelineStackProps) {
    super(scope, id, props);
    const accountId = Stack.of(this).account;

    /*
    Create encrypted S3 bucket for storing pipeline artifacts between stages (source, build, publish)
    */
    const encryptionKey = new kms.Key(this, 'PipelineArtifactsEncryptionKey', {
      enableKeyRotation: true,
    });

    const artifactBucket = new s3.Bucket(this, 'PipelineArtifactsBucket', {
      serverAccessLogsPrefix: 'access-logs/',
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    /*
    Create blank pipeline using the artifact bucket
    The pipeline stages are added in the code below
    */
    const packagePipeline = new codepipeline.Pipeline(this, 'PackagePipeline', {
      pipelineName: 'packagePipeline',
      artifactBucket,
    });

    /*
    Create Source Code Git Remote Repository 
    Add the first commit code base from the /lib/cusotm-package-source-code contents
    */
    const packageSourceRepo = new codecommit.Repository(
      this,
      'PackageSourceRepository',
      {
        repositoryName: 'PackageSourceCode',
        code: codecommit.Code.fromDirectory(
          path.join(__dirname, 'custom-package-source-code/')
        ),
      }
    );

    /*
    Create sourceOutput to track the artifact created by Source Stage
    Define the buildAction to be from above CodeCommit Source on "main" Branch
    */
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: packageSourceRepo,
      output: sourceOutput,
      branch: 'main',
    });

    /*
    Add the first stage Source to the pipeline
    */
    packagePipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    /*
    Define a code build container's environment
    */
    const codeBuildEnvironment = {
      computeType: codebuild.ComputeType.SMALL,
      image: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
    };

    /*
    Provide a code build container's build specifications
    This BuildSpec installs the libraries for building pip packages
    The output artifacts are located in the container's ./dist directory
    */
    const buildBuildSpec = {
      version: '0.2',
      phases: {
        install: {
          commands: [
            'echo Entered the install phase...',
            'python3 -m pip install --upgrade pip',
            'python3 -m pip install --upgrade build',
          ],
        },
        build: {
          commands: [
            'echo Entered the build phase...',
            'echo Build started on `date`',
            'ls',
            'python3 -m build',
          ],
          finally: ['ls ./dist'],
        },
        post_build: {
          commands: ['echo Build completed on `date`'],
        },
      },
      artifacts: { files: ['dist/*'] },
    };

    /*
    Define a CodeBuild Project for the CodePipeline Pipeline with above buildspec, environment, and encryption key
    */
    const packageBuildProject = new codebuild.PipelineProject(
      this,
      `CustomPackageCodeBuildProject`,
      {
        buildSpec: codebuild.BuildSpec.fromObject(buildBuildSpec),
        environment: codeBuildEnvironment,
        encryptionKey,
      }
    );

    /*
    Create buildOutput artifact to track the package created the /dist directory
    Define the buildAction for within the codePipeline's build stage
    */
    const buildOutput = new codepipeline.Artifact();
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'BuildPackage',
      project: packageBuildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    /*
    Add the second stage Build to the pipeline
    */
    packagePipeline.addStage({
      stageName: 'BuildPackage',
      actions: [buildAction],
    });

    /*
    Provide a CodeBuild container's build specifications for publishing
    This BuildSpec installs the libraries and command line tools for aws and twine
    The build phase logs in to the CodeArtifact and uploads the package through twine
    The output artifacts are located in the container's ./dist directory
    */
    const publishBuildSpec = {
      version: '0.2',
      phases: {
        install: {
          commands: [
            'echo Entered the install phase...',
            'curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"',
            'unzip -q awscliv2.zip',
            './aws/install',
            'pip3 install twine',
          ],
        },
        pre_build: {
          commands: [
            'echo Entered the pre_build phase...',
            '/usr/local/bin/aws --version',
            '/usr/local/bin/aws sts get-caller-identity',
          ],
        },
        build: {
          commands: [
            'echo Entered the build phase...',
            'echo Package Publishing to CodeArtifact in ${region} started on `date`',
            '/usr/local/bin/aws codeartifact login --tool twine --domain ${domainName} --domain-owner ${domainOwner} --repository ${repositoryName} --region ${region}',
            'python3 -m twine upload --skip-existing --repository codeartifact ./dist/* --verbose',
          ],
        },
        post_build: {
          command: ['echo Package Publishing completed on `date`'],
        },
      },
    };

    /*
    Define a CodeBuild Project for the CodePipeline Pipeline 
    Use above buildspec, environment, and encryption key for codebuild environment
    Add environment variables to reference in codebuild container
    */
    const publishPackageProject = new codebuild.PipelineProject(
      this,
      `PublishPackageProject`,
      {
        buildSpec: codebuild.BuildSpec.fromObject(publishBuildSpec),
        environment: codeBuildEnvironment,
        encryptionKey,
        environmentVariables: {
          domainName: { value: props.domainName },
          repositoryName: {
            value: props.repositoryName,
          },
          domainOwner: { value: accountId },
          region: { value: props.primaryRegion },
        },
      }
    );

    /*
    Create all publish actions to publish to all CodeArtifact regions
    Use above buildspec, environment, and encryption key for codebuild environment
    Add environment variables to reference in codebuild container
    */
    const publishActions = [];
    for (var region of [...props.replicaRegions, props.primaryRegion]) {
      const publishToRegionAction = new codepipeline_actions.CodeBuildAction({
        actionName: `PublishToRegion-${region}`,
        project: publishPackageProject,
        input: buildOutput,
        environmentVariables: {
          region: {
            value: region,
          },
        },
        runOrder: 1,
      });
      publishActions.push(publishToRegionAction);
    }

    /*
    Add the final stage Publish to the pipeline
    All publish actions will run in parallel to publish the package to CodeArtifact Repos in each region
    */
    packagePipeline.addStage({
      stageName: 'Publish',
      actions: publishActions,
    });

    /*
    Derive all necessary Arn's for codeArtifact resources to be used for access policy below
    */
    const codeArtifactArns = GenerateCodeArtifactArns(props, this);

    //Attach a new policy to the pipeline' publishing codebuild role to access the multi-region code artifact resources
    const codeArtifactAccessPolicy = new iam.Policy(
      this,
      'CodeArtifactAccessPolicy',
      {
        policyName: 'CodeArtifactAccessPolicy',
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['codeartifact:*'],
            resources: codeArtifactArns,
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['sts:GetServiceBearerToken'],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'sts:AWSServiceName': 'codeartifact.amazonaws.com',
              },
            },
          }),
        ],
        roles: [publishPackageProject.role!!],
      }
    );

    /*
    Output the URL in the CloudFormation Outputs tab for easier access to view the pipeline
    */
    new CfnOutput(this, 'CodePipelineURL', {
      value: `https://${props.primaryRegion}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${packagePipeline.pipelineName}/view`,
    });

    /*
    Add suppressions to the CDK-Nag Aspects evaluation with justified reasons
    */
    MyNagSuppressions({
      packageBuildProject,
      publishPackageProject,
      packagePipeline,
      codeArtifactAccessPolicy,
    });
  }
}
