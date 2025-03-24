# Professional Text Processor

A comprehensive web application for text processing with grammar correction, translation, and text-to-speech capabilities using Azure AI services.

## Features

- **Text Input**: Enter text directly or upload documents (TXT, DOCX, PDF)
- **Grammar Correction**: Uses Azure OpenAI API to correct and improve text
- **Translation**: Translates text to multiple languages using Azure Translator
- **Text-to-Speech**: Reads processed text aloud with Azure Speech Service
- **PDF Export**: Download processed text as PDF
- **History**: Stores and retrieves previous text processing sessions using Azure Cosmos DB

## Project Structure

```
project/
│
├── static/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── script.js
│
├── templates/
│   └── index.html
│
├── app.py
├── requirements.txt
├── .env
└── README.md
```

## Setup Instructions

### Prerequisites

- Python 3.8+
- Azure account with the following services:
  - Azure Cosmos DB
  - Azure OpenAI
  - Azure Translator
  - Azure Speech Service

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/text-processor.git
   cd text-processor
   ```

2. Create and activate a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install the required packages:
   ```
   pip install -r requirements.txt
   ```

4. Create a `.env` file in the project root and add your Azure service credentials:
   ```
   # Azure Cosmos DB Configuration
   COSMOS_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
   COSMOS_KEY=your-cosmos-primary-key
   COSMOS_DATABASE=TextProcessorDB
   COSMOS_CONTAINER=TextHistory

   # Azure OpenAI Configuration
   AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
   AZURE_OPENAI_KEY=your-openai-key
   AZURE_OPENAI_API_VERSION=2023-05-15
   AZURE_OPENAI_DEPLOYMENT=gpt-35-turbo

   # Azure Translator Text API
   AZURE_TRANSLATOR_KEY=your-translator-key
   AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
   AZURE_TRANSLATOR_LOCATION=global

   # Azure Speech Service
   AZURE_SPEECH_KEY=your-speech-key
   AZURE_SPEECH_REGION=eastus
   ```

5. Run the application:
   ```
   python app.py
   ```

6. Open a web browser and navigate to `http://localhost:5000`

## Azure Service Setup

### Azure Cosmos DB

1. Create an Azure Cosmos DB account with SQL API
2. Create a database named "TextProcessorDB"
3. Create a container named "TextHistory" with partition key "/id"
4. Get the endpoint and primary key from the "Keys" section

### Azure OpenAI

1. Create an Azure OpenAI resource
2. Deploy a model (e.g., gpt-35-turbo)
3. Get the endpoint and key from the "Keys and Endpoint" section

### Azure Translator

1. Create a Translator resource
2. Get the key and endpoint from the "Keys and Endpoint" section

### Azure Speech Service

1. Create a Speech resource
2. Get the key and region from the "Keys and Endpoint" section

## Usage

1. **Enter Text**: Type directly into the text area or upload a document
2. **Select Options**: Choose to correct grammar and/or translate to another language
3. **Process Text**: Click the "Process Text" button
4. **View Results**: See the processed text in the results area
5. **Download or Listen**: Download the processed text as PDF or listen to it with text-to-speech
6. **View History**: Access previously processed texts from the history section

## License

This project is licensed under the MIT License - see the LICENSE file for details.