// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

interface PipelineStackParams {
  domainName: string;
  repositoryName: string;
  primaryRegion: string;
  replicaRegion: string;
  accountId: string;
}

interface CodeArtifactStackParams {
  domainName: string;
  repositoryName: string;
}

export { PipelineStackParams, CodeArtifactStackParams };
