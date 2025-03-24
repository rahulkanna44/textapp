from flask import Flask, render_template, request, jsonify, send_file
import os
import uuid
import json
from datetime import datetime
import io
import docx2txt
import PyPDF2
import tempfile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from azure.cosmos import CosmosClient
import azure.cognitiveservices.speech as speechsdk
from dotenv import load_dotenv
import openai
import requests

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Initialize Azure Cosmos DB client
cosmos_endpoint = os.getenv("COSMOS_ENDPOINT")
cosmos_key = os.getenv("COSMOS_KEY")
cosmos_database = os.getenv("COSMOS_DATABASE", "TextProcessorDB")
cosmos_container = os.getenv("COSMOS_CONTAINER", "TextHistory")

cosmos_client = CosmosClient(cosmos_endpoint, cosmos_key)
database = cosmos_client.create_database_if_not_exists(id=cosmos_database)
container = database.create_container_if_not_exists(
    id=cosmos_container,
    partition_key="/id",
    offer_throughput=400
)

# Initialize Azure OpenAI client
openai.api_type = "azure"
openai.api_base = os.getenv("AZURE_OPENAI_ENDPOINT")
openai.api_key = os.getenv("AZURE_OPENAI_KEY")
openai.api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2023-05-15")
openai_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-35-turbo")

# Initialize Azure Speech Service
speech_key = os.getenv("AZURE_SPEECH_KEY")
speech_region = os.getenv("AZURE_SPEECH_REGION")

# Azure Translator Text API
translator_key = os.getenv("AZURE_TRANSLATOR_KEY")
translator_endpoint = os.getenv("AZURE_TRANSLATOR_ENDPOINT", "https://api.cognitive.microsofttranslator.com")
translator_location = os.getenv("AZURE_TRANSLATOR_LOCATION", "global")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file part'})
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No selected file'})
        
        # Process different file types
        if file.filename.endswith('.txt'):
            text = file.read().decode('utf-8')
        elif file.filename.endswith('.docx'):
            text = docx2txt.process(file)
        elif file.filename.endswith('.doc'):
            # For .doc files, you might need additional libraries like pywin32 or antiword
            return jsonify({'success': False, 'error': '.doc files require additional processing. Please convert to .docx or .txt'})
        elif file.filename.endswith('.pdf'):
            text = extract_text_from_pdf(file)
        else:
            return jsonify({'success': False, 'error': 'Unsupported file type'})
        
        return jsonify({'success': True, 'text': text})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def extract_text_from_pdf(file):
    try:
        pdf_reader = PyPDF2.PdfReader(file)
        text = ""
        for page_num in range(len(pdf_reader.pages)):
            text += pdf_reader.pages[page_num].extract_text()
        return text
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")

@app.route('/process', methods=['POST'])
def process_text():
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'success': False, 'error': 'No text provided'})
        
        original_text = data['text']
        processed_text = original_text
        
        # Grammar correction using Azure OpenAI
        if data.get('correct_grammar', False):
            processed_text = correct_grammar(processed_text)
        
        # Translation if requested
        if data.get('translate', False) and data.get('target_language'):
            processed_text = translate_text(processed_text, data['target_language'])
        
        # Save to Cosmos DB
        item_id = str(uuid.uuid4())
        history_item = {
            'id': item_id,
            'original_text': original_text,
            'processed_text': processed_text,
            'corrections': data.get('correct_grammar', False),
            'translation': data.get('translate', False),
            'target_language': data.get('target_language') if data.get('translate', False) else None,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        container.create_item(body=history_item)
        
        return jsonify({
            'success': True,
            'processed_text': processed_text
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def correct_grammar(text):
    try:
        # Using Azure OpenAI to correct grammar
        response = openai.ChatCompletion.create(
            deployment_id=openai_deployment,
            messages=[
                {"role": "system", "content": "You are a professional text editor. Correct grammar, spelling and improve the text while preserving its original meaning."},
                {"role": "user", "content": f"Please correct the following text:\n\n{text}"}
            ],
            temperature=0.0,
            max_tokens=2000
        )
        
        corrected_text = response.choices[0].message.content.strip()
        return corrected_text
    except Exception as e:
        # If there's an error, return the original text
        print(f"Error correcting grammar: {str(e)}")
        return text

def translate_text(text, target_language):
    try:
        # Using Azure Translator Text API
        url = f"{translator_endpoint}/translate"
        params = {
            'api-version': '3.0',
            'to': target_language
        }
        headers = {
            'Ocp-Apim-Subscription-Key': translator_key,
            'Ocp-Apim-Subscription-Region': translator_location,
            'Content-type': 'application/json'
        }
        body = [{'text': text}]
        
        response = requests.post(url, headers=headers, params=params, json=body)
        response.raise_for_status()  # Raise exception for HTTP errors
        
        translations = response.json()
        translated_text = translations[0]['translations'][0]['text']
        
        return translated_text
    except Exception as e:
        # If there's an error, return the original text
        print(f"Error translating text: {str(e)}")
        return text

@app.route('/generate-pdf', methods=['POST'])
def generate_pdf():
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'success': False, 'error': 'No text provided'})
        
        text = data['text']
        
        # Create a BytesIO object to store the PDF
        buffer = io.BytesIO()
        
        # Create the PDF
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # Set title
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, height - 72, "Processed Text")
        
        # Add timestamp
        c.setFont("Helvetica", 10)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        c.drawString(72, height - 90, f"Generated on: {timestamp}")
        
        # Add main text
        c.setFont("Helvetica", 12)
        text_object = c.beginText(72, height - 120)
        
        # Split text into lines and add to text object
        for line in text.split('\n'):
                # Handle long lines by wrapping
                words = line.split()
                current_line = ""
                for word in words:
                    test_line = current_line + " " + word if current_line else word
                    if c.stringWidth(test_line, "Helvetica", 12) < width - 144:  # 72pt margin on each side
                        current_line = test_line
                    else:
                        text_object.textLine(current_line)
                        current_line = word
                if current_line:
                    text_object.textLine(current_line)
                if not words:  # Empty line
                    text_object.textLine("")
        
        c.drawText(text_object)
        c.save()
        
        # Get the PDF from the buffer
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='processed_text.pdf'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/history', methods=['GET'])
def get_history():
    try:
        # Query Cosmos DB for history items
        query = "SELECT * FROM c ORDER BY c.timestamp DESC"
        items = list(container.query_items(query=query, enable_cross_partition_query=True))
        
        return jsonify({
            'success': True,
            'history': items
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/text-to-speech', methods=['POST'])
def text_to_speech():
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'success': False, 'error': 'No text provided'})
        
        text = data['text']
        language = data.get('language', 'en-US')
        
        # Configure speech synthesis
        speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=speech_region)
        speech_config.speech_synthesis_language = language
        
        # Use a temporary file to store the audio
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        file_name = temp_file.name
        temp_file.close()
        
        # Create a file config for the audio output
        file_config = speechsdk.audio.AudioOutputConfig(filename=file_name)
        
        # Create a speech synthesizer
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=file_config)
        
        # Generate audio from text
        result = synthesizer.speak_text_async(text).get()
        
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            # Send the audio file
            return send_file(
                file_name,
                mimetype='audio/wav',
                as_attachment=True,
                download_name='speech_output.wav'
            )
        else:
            return jsonify({
                'success': False,
                'error': f'Speech synthesis failed: {result.reason}'
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
    finally:
        # Clean up the temporary file
        if 'file_name' in locals() and os.path.exists(file_name):
            os.remove(file_name)

if __name__ == '__main__':
    app.run(debug=True)