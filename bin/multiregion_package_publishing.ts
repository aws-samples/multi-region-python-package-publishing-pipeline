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
const replicaRegion = 'us-west-2'; //Replica CodeArtifact Repo Region

const artifactParams: CodeArtifactStackParams = {
  domainName,
  repositoryName,
};

const primaryCodeArtifactStack = new CodeArtifactStack(
  app,
  'CodeArtifactStack',
  artifactParams,
  {
    env: { region: primaryRegion },
  }
);

const replicaCodeArtifactStack = new CodeArtifactStack(
  app,
  'CodeArtifactReplicaStack',
  artifactParams,
  {
    env: { region: replicaRegion },
  }
);

const accountId = cdk.Stack.of(primaryCodeArtifactStack).account;

const params: PipelineStackParams = {
  domainName,
  repositoryName,
  primaryRegion,
  replicaRegion,
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
