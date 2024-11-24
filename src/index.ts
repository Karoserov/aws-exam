import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class FileProcessingStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // VPC for EC2 instance
        const vpc = new ec2.Vpc(this, 'FileProcessingVPC', {
            maxAzs: 2,
            natGateways: 1
        });

        // Security group for EC2
        const webServerSG = new ec2.SecurityGroup(this, 'WebServerSG', {
            vpc,
            description: 'Security group for web server',
            allowAllOutbound: true
        });

        webServerSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(80),
            'Allow HTTP traffic'
        );

        webServerSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(22),
            'Allow SSH traffic'
        );

        // EC2 instance
        const instance = new ec2.Instance(this, 'WebServer', {
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC
            },
            securityGroup: webServerSG,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
            machineImage: new ec2.AmazonLinuxImage({
                generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
            }),
            keyName: 'file-processing-key-pair' // Make sure to create this key pair in AWS console
        });

        // S3 bucket with 30-minute TTL
        const bucket = new s3.Bucket(this, 'FileStorageBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            lifecycleRules: [
                {
                    expiration: cdk.Duration.minutes(30)
                }
            ]
        });

        // DynamoDB table
        const table = new dynamodb.Table(this, 'FileMetadataTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'uploadDate', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        // Add GSI for file extension queries
        table.addGlobalSecondaryIndex({
            indexName: 'FileExtensionIndex',
            partitionKey: { name: 'fileExtension', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'uploadDate', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });

        // SNS Topic for email notifications
        const notificationTopic = new sns.Topic(this, 'FileUploadNotificationTopic');
        new sns.Subscription(this, 'EmailSubscription', {
            topic: notificationTopic,
            protocol: sns.SubscriptionProtocol.EMAIL,
            endpoint: 'example@yahoo.com'
        });

        // Lambda for file processing
        const processingLambda = new lambda.Function(this, 'FileProcessingLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/processing')),
            environment: {
                TABLE_NAME: table.tableName,
                TOPIC_ARN: notificationTopic.topicArn
            }
        });

        // Lambda for email notifications
        const notificationLambda = new lambda.Function(this, 'NotificationLambda', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/notification')),
            environment: {
                TOPIC_ARN: notificationTopic.topicArn
            }
        });

        // Grant permissions
        bucket.grantRead(processingLambda);
        table.grantWriteData(processingLambda);
        table.grantReadData(notificationLambda);
        notificationTopic.grantPublish(notificationLambda);

        // Output the web server's public IP
        new cdk.CfnOutput(this, 'WebServerIP', {
            value: instance.instancePublicIp
        });
    }
}