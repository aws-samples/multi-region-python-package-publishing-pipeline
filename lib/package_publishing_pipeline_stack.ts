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

import { PipelineStackParams } from './types';

import { NagSuppressions } from 'cdk-nag';

export class MultiRegionPackagePublishingPipelineStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    params: PipelineStackParams,
    props?: StackProps
  ) {
    super(scope, id, props);

    /*
    Derive all necessary Arn's
    */
    const primaryCodeArtifactRepoArn = Arn.format(
      {
        service: 'codeartifact',
        resource: 'repository',
        resourceName: `${params.domainName}/${params.repositoryName}`,
      },
      this
    );
    const primaryCodeArtifactDomainArn = Arn.format(
      {
        service: 'codeartifact',
        resource: 'domain',
        resourceName: params.domainName,
      },
      this
    );
    const packageDestinationArn = Arn.format(
      {
        service: 'codeartifact',
        resource: 'package',
        resourceName: `${params.domainName}/${params.repositoryName}/*`,
      },
      this
    );

    var codeArtifactArns = [
      primaryCodeArtifactRepoArn,
      primaryCodeArtifactRepoArn + '/*',
      primaryCodeArtifactDomainArn,
      packageDestinationArn,
    ];

    for (var replicaRegion of params.replicaRegions) {
      const replicaCodeArtifactRepoArn = Arn.format(
        {
          service: 'codeartifact',
          resource: 'repository',
          region: replicaRegion,
          resourceName: `${params.domainName}/${params.repositoryName}`,
        },
        this
      );
      const replicaCodeArtifactDomainArn = Arn.format(
        {
          service: 'codeartifact',
          resource: 'domain',
          region: replicaRegion,
          resourceName: params.domainName,
        },
        this
      );
      const packageReplicaDestinationArn = Arn.format(
        {
          service: 'codeartifact',
          resource: 'package',
          resourceName: `${params.domainName}/${params.repositoryName}/*`,
          region: replicaRegion,
        },
        this
      );
      const replicaArns = [
        replicaCodeArtifactRepoArn,
        replicaCodeArtifactRepoArn + '/*',
        replicaCodeArtifactDomainArn,
        packageReplicaDestinationArn,
      ];
      replicaArns.map((arn) => codeArtifactArns.push(arn));
    }

    /* 
    Create S3 bucket for storing pipeline artifacts between stages
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
    Create Source Code Git Repository 
    Create the pipeline's source stage constructs
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

    const sourceOutput = new codepipeline.Artifact();

    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: packageSourceRepo,
      output: sourceOutput,
      branch: 'main',
    });

    /*
    Create pipeline's Build phase constructs
    */
    const codeBuildEnvironment = {
      computeType: codebuild.ComputeType.SMALL,
      image: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
    };

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
            //python3 ./src/setup.py bdist_wheel',
          ],
          finally: ['ls ./dist'],
        },
        post_build: {
          commands: ['echo Build completed on `date`'],
        },
      },
      artifacts: { files: ['dist/*'] },
    };

    const packageBuildProject = new codebuild.PipelineProject(
      this,
      `CustomPackageCodeBuildProject`,
      {
        buildSpec: codebuild.BuildSpec.fromObject(buildBuildSpec),
        environment: codeBuildEnvironment,
        encryptionKey,
      }
    );

    const buildOutput = new codepipeline.Artifact();

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'BuildPackage',
      project: packageBuildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    /*
    Create the pipeline's publish phase constructs
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
      artifacts: { files: ['dist/*'] },
    };

    const publishPackageProject = new codebuild.PipelineProject(
      this,
      `PublishPackageProject`,
      {
        buildSpec: codebuild.BuildSpec.fromObject(publishBuildSpec),
        environmentVariables: {
          domainName: { value: params.domainName },
          repositoryName: {
            value: params.repositoryName,
          },
          domainOwner: { value: params.accountId },
          region: { value: params.primaryRegion },
        },
        environment: codeBuildEnvironment,
        encryptionKey,
      }
    );

    const publishPrimaryAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'PublishPrimaryRegion',
      project: publishPackageProject,
      input: buildOutput,
      runOrder: 1,
    });

    const publishReplicaActions = [];
    for (var replicaRegion of params.replicaRegions) {
      const publishReplicaAction = new codepipeline_actions.CodeBuildAction({
        actionName: `PublishReplicaRegion-${replicaRegion}`,
        project: publishPackageProject,
        input: buildOutput,
        environmentVariables: {
          region: {
            value: replicaRegion,
          },
        },
        runOrder: 1,
      });
      publishReplicaActions.push(publishReplicaAction);
    }

    //allow the role for this phase's codebuild project to publish to codeartifact
    const CodeArtifactAccessPolicy = new iam.Policy(
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
    Create the multi region private pip package publishing pipeline
    */
    const packagePipeline = new codepipeline.Pipeline(this, 'PackagePipeline', {
      pipelineName: 'packagePipeline',
      artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Build',
          actions: [buildAction],
        },
        {
          stageName: 'Publish',
          actions: [publishPrimaryAction, ...publishReplicaActions],
        },
      ],
    });

    new CfnOutput(this, 'CodePipelineURL', {
      value: `https://${params.primaryRegion}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${packagePipeline.pipelineName}/view`,
    });

    /* 
    Add CDK Nag suppressions for this project 
    */
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
      CodeArtifactAccessPolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'Only allows access to the 2 CodeArtifact Repository Resources',
        },
      ],
      true
    );
  }
}
