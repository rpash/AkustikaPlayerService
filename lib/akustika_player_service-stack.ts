import { Stack, StackProps } from 'aws-cdk-lib';
import { AppsyncFunction, Code, FunctionRuntime, GraphqlApi, Resolver, SchemaFile } from 'aws-cdk-lib/aws-appsync';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class AkustikaPlayerServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const api = new GraphqlApi(this, "AkustikaApi", {
      name: "AkustikaApi",
      schema: SchemaFile.fromAsset('schema/schema.graphql')
    });

    const usersTable = new Table(this, "AkustikaUsersTable", {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      }
    });
    
    const usersDataSource = api.addDynamoDbDataSource("AkustikaUsersSource", usersTable);

    const getPostsFunc = new AppsyncFunction(this, 'AkustikaGetPosts', {
      name: 'GetPosts',
      api,
      dataSource: usersDataSource,
      code: Code.fromInline(`
        export function request(ctx) {
          return { operation: 'Scan' };
        }

        export function response(ctx) {
          return ctx.result.items;
        }
      `),
      runtime: FunctionRuntime.JS_1_0_0,
    });

    const addPostsFunc = new AppsyncFunction(this, 'AkustikaAddPosts', {
      name: 'AddPosts',
      api,
      dataSource: usersDataSource,
      code: Code.fromInline(`
        export function request(ctx) {
          return {
            operation: 'PutItem',
            key: util.dynamodb.toMapValues({ id: util.autoId() }),
            attributeValues: util.dynamodb.toMapValues(ctx.args.input),
          };
        }

        export function response(ctx) {
          return ctx.result;
        }
      `),
      runtime: FunctionRuntime.JS_1_0_0,
    });

    new Resolver(this, 'AkustikaPipelineResolverGetPosts', {
      api,
      typeName: 'Query',
      fieldName: 'getPost',
      code: Code.fromInline(`
        export function request(ctx) {
          return { };
        }

        export function response(ctx) {
          return ctx.prev.result;
        }
      `),
      runtime: FunctionRuntime.JS_1_0_0,
      pipelineConfig: [getPostsFunc],
    });

    new Resolver(this, 'AkustikaPipelineResolverAddPosts', {
      api,
      typeName: 'Mutation',
      fieldName: 'createPost',
      code: Code.fromInline(`
        export function request(ctx) {
          return { };
        }

        export function response(ctx) {
          return ctx.prev.result;
        }
      `),
      runtime: FunctionRuntime.JS_1_0_0,
      pipelineConfig: [addPostsFunc],
    });
  }
}
