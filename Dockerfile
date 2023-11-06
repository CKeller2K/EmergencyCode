# Node version for runtime
FROM node:18.17.1

# Set working directory in the container
WORKDIR /app

COPY . .

ENV HOST=0.0.0.0
# Install dependencies
RUN npm install

# Install pdflatex
RUN apt-get update && \
    apt-get install -y texlive-full && \
    pdflatex -v

# Install Google Cloud SDK
RUN curl -sSL https://sdk.cloud.google.com | bash
ENV PATH $PATH:/root/google-cloud-sdk/bin

RUN chmod 600 ServiceAccountKey.json
# Authenticate with Google Cloud
RUN gcloud auth activate-service-account --key-file=ServiceAccountKey.json
RUN gcloud --quiet config set project csc-131-project-398318

# Expose port 8080 for the application
EXPOSE 8080

# Define the command to run the application
CMD [ "node", "localindex.js" ]
