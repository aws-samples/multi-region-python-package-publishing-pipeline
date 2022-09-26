import { Arn } from 'aws-cdk-lib';
import {
  MultiRegionPackagePublishingPipelineStack,
  PublishPipelineStackProps,
} from './package_publishing_pipeline_stack';

/*
  Add a helper function to iterate through all relevant codeartifact resources and return them in an array
*/
export const GenerateCodeArtifactArns = (
  props: PublishPipelineStackProps,
  stack: MultiRegionPackagePublishingPipelineStack
): string[] => {
  // hold the list of arns in an array called codeArtifactArns
  var codeArtifactArns: string[] = [];

  // iterate through each region to derive each resource Arn
  for (var region of [...props.replicaRegions, props.primaryRegion]) {
    //Arn for the repository
    const codeArtifactRepoArn = Arn.format(
      {
        service: 'codeartifact',
        resource: 'repository',
        region,
        resourceName: `${props.domainName}/${props.repositoryName}`,
      },
      stack
    );

    //Arn for the domain
    const codeArtifactDomainArn = Arn.format(
      {
        service: 'codeartifact',
        resource: 'domain',
        region,
        resourceName: props.domainName,
      },
      stack
    );

    //Arn for the packages
    const packageArn = Arn.format(
      {
        service: 'codeartifact',
        resource: 'package',
        region,
        resourceName: `${props.domainName}/${props.repositoryName}/*`,
      },
      stack
    );

    //add the Arns to the array
    codeArtifactArns.push(codeArtifactRepoArn);
    codeArtifactArns.push(codeArtifactRepoArn + '/*');
    codeArtifactArns.push(codeArtifactDomainArn);
    codeArtifactArns.push(packageArn);
  }

  //return the array of CodeArtifactArns
  return codeArtifactArns;
};
