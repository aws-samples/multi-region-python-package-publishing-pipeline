// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as codeartifact from 'aws-cdk-lib/aws-codeartifact';

export interface CodeArtifactStackProps extends StackProps {
  domainName: string;
  repositoryName: string;
}

/*
  Create a stack to create a CodeArtifact Domain and Repository using L1 Constructs
*/
export class CodeArtifactStack extends Stack {
  public codeArtifactRepostory: codeartifact.CfnRepository;
  public codeArtifactDomain: codeartifact.CfnDomain;

  constructor(scope: Construct, id: string, props: CodeArtifactStackProps) {
    super(scope, id, props);

    const codeArtifactDomain = new codeartifact.CfnDomain(
      this,
      'CodeArtifactDomain',
      {
        domainName: props.domainName,
      }
    );

    const codeArtifactRepostory = new codeartifact.CfnRepository(
      this,
      'CodeArtifactRepo',
      {
        domainName: codeArtifactDomain.domainName,
        repositoryName: props.repositoryName,
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
