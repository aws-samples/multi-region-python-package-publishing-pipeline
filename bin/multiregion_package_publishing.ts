#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
  MultiRegionPackagePublishingPipelineStack,
  PublishPipelineStackProps,
} from '../lib/package_publishing_pipeline_stack';
import {
  CodeArtifactStack,
  CodeArtifactStackProps,
} from '../lib/code_artifact_stack';

/*
  Create the CDK Application
*/
const app = new cdk.App();

/*
  Optionally remove the below line to not evaluate the CDK-Nag Aspects in this CDK Application
*/
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

/*
  Define the parameters for the CDK stacks here
*/
const domainName = 'custom-package-domain'; //CodeArtifact Domain
const repositoryName = 'package-artifact-repo'; //CodeArtifact Repository
const primaryRegion = 'us-east-1'; //Primary CodeArtifact Repo Region
const replicaRegions = ['us-west-2', 'us-east-2']; //Replica CodeArtifact Repo Regions

/*
  Create the CodeArtifact stack with a domain and repository in each region
*/
for (var region of [...replicaRegions, primaryRegion]) {
  const codeArtifactProps: CodeArtifactStackProps = {
    domainName,
    repositoryName,
    env: { region },
  };
  new CodeArtifactStack(app, `CodeArtifactStack-${region}`, codeArtifactProps);
}

/*
  Create the props object of interface Pipeline Stack Props for the PackagePublishingPipeline
*/
const props: PublishPipelineStackProps = {
  domainName,
  repositoryName,
  primaryRegion,
  replicaRegions,
  env: { region: primaryRegion },
};

/*
  Create the Package Publishing Pipeline for Multiple Regions with above properties
*/
new MultiRegionPackagePublishingPipelineStack(
  app,
  'PackagePublishingPipelineStack',
  props
);
