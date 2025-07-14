import boto3
client = boto3.client('bedrock', region_name='us-west-2')
response = client.list_foundation_models()
print(response)