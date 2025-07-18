# Stage 1: Node.js for Prisma
FROM public.ecr.aws/docker/library/node:18-slim

# Install curl for health checks and other dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install Deno
COPY --from=denoland/deno:bin-2.2.6 /deno /usr/local/bin/deno

# The port that your application listens to.
# Bedrock Configuration
ENV BEDROCK_MODEL_ID='anthropic.claude-3-sonnet-20240229-v1:0'
ENV BEDROCK_KNOWLEDGE_BASE_ID=''
ENV BEDROCK_DATA_SOURCE_ID=''
ENV AWS_REGION=''
ENV API_KEY=''
# API Configuration
ENV NODE_ENV='prod'
ENV PORT=80
# S3 Configuration
ENV S3_BUCKET_NAME=''
# DynamoDB Configuration
ENV DYNAMODB_CHATS_TABLE=''
ENV DYNAMODB_S3_TABLE=''
ENV DYNAMODB_VISUALIZATIONS_TABLE=''
ENV VITE_BASE_URL=''

EXPOSE 80

WORKDIR /app

# These steps will be re-run upon each file change in your working directory:
COPY . .

# Clean up any existing node_modules symlinks to prevent conflicts
RUN rm -rf node_modules

# Cache dependencies with --reload flag to ensure fresh dependencies
RUN deno cache --reload main.ts

# Start the application using the same flags as in deno.json tasks
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-sys", "--allow-write", "--allow-run", "main.ts"]