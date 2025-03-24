document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const inputText = document.getElementById('input-text');
    const documentUpload = document.getElementById('document-upload');
    const uploadStatus = document.getElementById('upload-status');
    const correctGrammar = document.getElementById('correct-grammar');
    const translateText = document.getElementById('translate-text');
    const translateOptions = document.getElementById('translate-options');
    const languageSelect = document.getElementById('language-select');
    const processBtn = document.getElementById('process-btn');
    const processSpinner = document.getElementById('process-spinner');
    const resultContainer = document.getElementById('result-container');
    const downloadPdfBtn = document.getElementById('download-pdf');
    const readAloudBtn = document.getElementById('read-aloud');
    const stopReadingBtn = document.getElementById('stop-reading');
    const showHistoryBtn = document.getElementById('show-history');
    const historyContainer = document.getElementById('history-container');
    const historyItems = document.getElementById('history-items');
    
    // Modal elements
    const modalOriginal = document.getElementById('modal-original');
    const modalProcessed = document.getElementById('modal-processed');
    const modalDownload = document.getElementById('modal-download');
    const modalRead = document.getElementById('modal-read');
    
    // Speech synthesis
    const synth = window.speechSynthesis;
    let speaking = false;
    let currentUtterance = null;

    // Toggle translation options visibility
    translateText.addEventListener('change', function() {
        if (this.checked) {
            translateOptions.classList.remove('d-none');
        } else {
            translateOptions.classList.add('d-none');
        }
    });

    // Document upload handling
    documentUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        uploadStatus.innerHTML = `<div class="alert alert-info">Reading file: ${file.name}</div>`;
        
        const allowedTypes = [
            'text/plain', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/pdf'
        ];
        
        if (!allowedTypes.includes(file.type)) {
            uploadStatus.innerHTML = `<div class="alert alert-danger">Unsupported file type. Please upload .txt, .doc, .docx, or .pdf files.</div>`;
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                inputText.value = data.text;
                uploadStatus.innerHTML = `<div class="alert alert-success">File uploaded and text extracted successfully.</div>`;
                // Switch to text tab
                const textTab = document.getElementById('text-tab');
                const bsTab = new bootstrap.Tab(textTab);
                bsTab.show();
            } else {
                uploadStatus.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
            }
        })
        .catch(error => {
            uploadStatus.innerHTML = `<div class="alert alert-danger">Error processing file: ${error.message}</div>`;
        });
    });

    // Process text
    processBtn.addEventListener('click', function() {
        const text = inputText.value.trim();
        if (!text) {
            alert('Please enter or upload some text first.');
            return;
        }
        
        // Show loading spinner
        processSpinner.classList.remove('d-none');
        processBtn.disabled = true;
        
        // Prepare request data
        const requestData = {
            text: text,
            correct_grammar: correctGrammar.checked,
            translate: translateText.checked,
            target_language: translateText.checked ? languageSelect.value : null
        };
        
        // Send request to backend
        fetch('/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                resultContainer.innerHTML = `<div>${data.processed_text}</div>`;
                downloadPdfBtn.disabled = false;
                readAloudBtn.disabled = false;
            } else {
                resultContainer.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
            }
        })
        .catch(error => {
            resultContainer.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
        })
        .finally(() => {
            processSpinner.classList.add('d-none');
            processBtn.disabled = false;
        });
    });

    // Read text aloud
    readAloudBtn.addEventListener('click', function() {
        if (speaking) return;
        
        const textToRead = resultContainer.textContent.trim();
        if (!textToRead || textToRead === 'Processed text will appear here.') {
            alert('No processed text to read.');
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(textToRead);
        
        // Set language if translation was done
        if (translateText.checked) {
            utterance.lang = languageSelect.value;
        }
        
        currentUtterance = utterance;
        synth.speak(utterance);
        speaking = true;
        
        readAloudBtn.classList.add('d-none');
        stopReadingBtn.classList.remove('d-none');
        
        utterance.onend = function() {
            speaking = false;
            readAloudBtn.classList.remove('d-none');
            stopReadingBtn.classList.add('d-none');
        };
    });

    // Stop reading
    stopReadingBtn.addEventListener('click', function() {
        if (speaking) {
            synth.cancel();
            speaking = false;
            readAloudBtn.classList.remove('d-none');
            stopReadingBtn.classList.add('d-none');
        }
    });

    // Download PDF
    downloadPdfBtn.addEventListener('click', function() {
        const processedText = resultContainer.textContent.trim();
        if (!processedText || processedText === 'Processed text will appear here.') {
            alert('No processed text to download.');
            return;
        }
        
        fetch('/generate-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: processedText
            })
        })
        .then(response => {
            if (response.ok) {
                return response.blob();
            }
            throw new Error('Error generating PDF');
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'processed_text.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            alert(`Error downloading PDF: ${error.message}`);
        });
    });

    // Show history
    showHistoryBtn.addEventListener('click', function() {
        if (historyContainer.classList.contains('d-none')) {
            // Show history
            historyContainer.classList.remove('d-none');
            showHistoryBtn.textContent = 'Hide History';
            
            // Fetch history
            fetch('/history')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayHistory(data.history);
                } else {
                    historyItems.innerHTML = `<tr><td colspan="4" class="text-center">Error: ${data.error}</td></tr>`;
                }
            })
            .catch(error => {
                historyItems.innerHTML = `<tr><td colspan="4" class="text-center">Error fetching history: ${error.message}</td></tr>`;
            });
        } else {
            // Hide history
            historyContainer.classList.add('d-none');
            showHistoryBtn.textContent = 'Show History';
        }
    });

    // Display history items
    function displayHistory(history) {
        if (!history || history.length === 0) {
            historyItems.innerHTML = '<tr><td colspan="4" class="text-center">No history items found.</td></tr>';
            return;
        }
        
        historyItems.innerHTML = '';
        
        history.forEach(item => {
            const row = document.createElement('tr');
            row.classList.add('history-item');
            
            // Format date
            const date = new Date(item.timestamp);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            
            // Truncate text previews
            const originalPreview = item.original_text.length > 50 ? 
                item.original_text.substring(0, 50) + '...' : 
                item.original_text;
                
            const processedPreview = item.processed_text.length > 50 ? 
                item.processed_text.substring(0, 50) + '...' : 
                item.processed_text;
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td class="truncate-text">${originalPreview}</td>
                <td class="truncate-text">${processedPreview}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-btn">View</button>
                </td>
            `;
            
            historyItems.appendChild(row);
            
            // Add click event for view button
            const viewBtn = row.querySelector('.view-btn');
            viewBtn.addEventListener('click', function() {
                modalOriginal.textContent = item.original_text;
                modalProcessed.textContent = item.processed_text;
                
                // Store current item ID for download and read functions
                modalDownload.dataset.itemId = item.id;
                modalRead.dataset.text = item.processed_text;
                
                // Show modal
                const historyModal = new bootstrap.Modal(document.getElementById('historyModal'));
                historyModal.show();
            });
        });
    }
    
    // Modal download button
    modalDownload.addEventListener('click', function() {
        const text = modalProcessed.textContent;
        
        fetch('/generate-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text
            })
        })
        .then(response => {
            if (response.ok) {
                return response.blob();
            }
            throw new Error('Error generating PDF');
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'history_item.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            alert(`Error downloading PDF: ${error.message}`);
        });
    });
    
    // Modal read button
    modalRead.addEventListener('click', function() {
        if (speaking) return;
        
        const textToRead = this.dataset.text;
        if (!textToRead) return;
        
        const utterance = new SpeechSynthesisUtterance(textToRead);
        synth.speak(utterance);
        speaking = true;
        
        modalRead.disabled = true;
        
        utterance.onend = function() {
            speaking = false;
            modalRead.disabled = false;
        };
    });
});