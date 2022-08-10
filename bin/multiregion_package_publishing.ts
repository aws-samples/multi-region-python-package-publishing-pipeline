#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { MultiRegionPackagePublishingPipelineStack } from '../lib/package_publishing_pipeline_stack';
import { CodeArtifactStack } from '../lib/code_artifact_stack';
import { CodeArtifactStackParams, PipelineStackParams } from '../lib/types';

const app = new cdk.App();
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

//parameters for the CDK Custom Package Publishing Pipeline
const domainName = 'custom-package-domain'; //CodeArtifact Domain
const repositoryName = 'package-artifact-repo'; //CodeArtifact Repository
const primaryRegion = 'us-east-1'; //Primary CodeArtifact Repo Region
const replicaRegions = ['us-west-2', 'us-east-2']; //Replica CodeArtifact Repo Regions

const artifactParams: CodeArtifactStackParams = {
  domainName,
  repositoryName,
};

const primaryCodeArtifactStack = new CodeArtifactStack(
  app,
  `CodeArtifactPrimaryStack-${primaryRegion}`,
  artifactParams,
  {
    env: { region: primaryRegion },
  }
);

for (var replicaRegion of replicaRegions) {
  const replicaRegionCodeArtifact = new CodeArtifactStack(
    app,
    `CodeArtifactReplicaStack-${replicaRegion}`,
    artifactParams,
    {
      env: { region: replicaRegion },
    }
  );
}

const accountId = cdk.Stack.of(primaryCodeArtifactStack).account;

const params: PipelineStackParams = {
  domainName,
  repositoryName,
  primaryRegion,
  replicaRegions,
  accountId,
};

new MultiRegionPackagePublishingPipelineStack(
  app,
  'PackagePublishingPipelineStack',
  params,
  {
    env: { region: params.primaryRegion },
  }
);
