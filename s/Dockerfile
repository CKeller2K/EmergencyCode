# Node version for runtime
FROM node:18.17.1

# Set working directory in the container
WORKDIR /app

COPY . .

ENV HOST=0.0.0.0
# Install dependencies
RUN npm install

# Install pdflatex and additional LaTeX packages
RUN apt-get update && \
 apt-get install -y texlive-latex-base texlive-fonts-recommended texlive-fonts-extra texlive-latex-extra && \
 pdflatex -v


# Expose port 8080 for the application
EXPOSE 8080

# Define the command to run the application
CMD [ "node", "index.js" ]
