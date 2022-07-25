// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as codeartifact from 'aws-cdk-lib/aws-codeartifact';

import { CodeArtifactStackParams } from './types';

export class CodeArtifactStack extends Stack {
  public codeArtifactRepostory: codeartifact.CfnRepository;
  public codeArtifactDomain: codeartifact.CfnDomain;

  constructor(
    scope: Construct,
    id: string,
    params: CodeArtifactStackParams,
    props?: StackProps
  ) {
    super(scope, id, props);

    const codeArtifactDomain = new codeartifact.CfnDomain(
      this,
      'CodeArtifactDomain',
      {
        domainName: params.domainName,
      }
    );

    const codeArtifactRepostory = new codeartifact.CfnRepository(
      this,
      'CodeArtifactRepo',
      {
        domainName: codeArtifactDomain.domainName,
        repositoryName: params.repositoryName,
      }
    );

    codeArtifactRepostory.addDependsOn(codeArtifactDomain);

    new CfnOutput(this, 'CodeArtifactRepoArn', {
      value: codeArtifactRepostory.attrArn,
      exportName: 'CodeArtifactRepoArn',
    });
    new CfnOutput(this, 'CodeArtifactDomainArn', {
      value: codeArtifactDomain.attrArn,
      exportName: 'CodeArtifactDomainArn',
    });
  }
}
