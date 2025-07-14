#!/bin/bash

# Set default region or use provided argument
REGION=${1:-"us-east-1"}

echo "=== AWS Bedrock Models in $REGION ==="

# Direct table output with just the model name and ID
aws bedrock list-foundation-models --region $REGION \
  --query "modelSummaries[].{Name:modelName,ID:modelId}" \
  --output table

echo "Usage: ./list-models.sh [region-name]"
