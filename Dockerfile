# Stage 1: Node.js for Prisma
FROM public.ecr.aws/docker/library/node:18-slim

# Install Deno
COPY --from=denoland/deno:bin-2.2.6 /deno /usr/local/bin/deno

# The port that your application listens to.
# Bedrock Configuration
ENV BEDROCK_MODEL_ID=''
ENV STRANDS_KNOWLEDGE_BASE_ID=''
ENV BEDROCK_KNOWLEDGE_BASE_ID=''
ENV BEDROCK_DATA_SOURCE_ID=''
ENV AWS_REGION=''
ENV APIKEY=''
# FastAPI Configuration
ENV PORT=8000
ENV AWS_KNOWLEDGE_BASE_ID=''
ENV S3_BUCKET_NAME=''
ENV S3_DYNAMODB_TABLE=''
ENV VISUALIZATIONS_TABLE=''
ENV PRESENTATIONS_TABLE=''
ENV ABLY_API_KEY=''
ENV DYNAMODB_TABLE_NAME=''

EXPOSE 80

WORKDIR /app

# Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
# Ideally cache deps.ts will download and compile _all_ external files used in main.ts.
COPY src/deps.ts .
RUN deno install --entrypoint deps.ts


# These steps will be re-run upon each file change in your working directory:
COPY . .

# Generate Prisma client
RUN deno run --allow-scripts -A npm:prisma@latest generate --no-hints

# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache src/main.ts

# Start the application
CMD ["deno", "run", "--allow-all", "src/main.ts"]